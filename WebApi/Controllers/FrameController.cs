using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/frames")]
    [ApiController]
    public class FrameController : ControllerBase
    {
        private static readonly Regex SlugPattern = new(@"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$", RegexOptions.Compiled);
        private static readonly Regex DayPattern = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.Compiled);
        private static readonly Regex FilePattern = new(@"^[0-9A-Za-z_-]+\.jpg$", RegexOptions.Compiled);

        private const string ArchiveDir = "archive";
        private const string MetaFile = "meta.json";

        // How many recent frames a camera card shows (1 main + the rest as thumbnails).
        private const int RecentFrameCount = 3;

        private readonly IConfiguration _configuration;
        private readonly ILogger<FrameController> _logger;

        public FrameController(IConfiguration configuration, ILogger<FrameController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        private bool IsEnabled() =>
            _configuration.GetValue<bool>("CameraWall:Enabled");

        private string GetFramesRoot()
        {
            var configured = _configuration["CameraWall:FramesRoot"];
            return string.IsNullOrWhiteSpace(configured)
                ? Path.Combine(Directory.GetCurrentDirectory(), "frames")
                : configured;
        }

        private string GetUploadToken() =>
            _configuration["CameraWall:UploadToken"] ?? string.Empty;

        private long GetMaxArchiveBytes()
        {
            var gb = _configuration.GetValue<double?>("CameraWall:MaxArchiveGB") ?? 30d;
            return gb <= 0 ? 0 : (long)(gb * 1024 * 1024 * 1024);
        }

        // POST /api/frames/{pc}/{cameraId}
        //   Body    : raw JPEG bytes (Content-Type: image/jpeg)
        //   Headers : X-Upload-Token (required) + optional camera metadata, cached per camera:
        //             X-Cam-Name   → friendly name shown on the card (e.g. "Box 1")
        //             X-Cam-Model  → camera model (e.g. "Hikvision DS-2CD2347G3-LIS2UY/SL")
        //             X-Cam-Ip     → camera IP (e.g. "192.168.1.101")
        //             X-Cam-Serial → serial / hardware id (e.g. "HIK-CAM-001")
        // Every frame is archived under archive/{day}; there is no single "latest" file anymore —
        // the newest archived frame is what the wall shows.
        [HttpPost("{pc}/{cameraId}")]
        public async Task<IActionResult> Upload(string pc, string cameraId)
        {
            if (!IsEnabled()) return NotFound();

            if (!Request.Headers.TryGetValue("X-Upload-Token", out var token) || token != GetUploadToken())
                return Unauthorized("Невірний токен");

            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId))
                return BadRequest("Невірний ідентифікатор ПК або камери");

            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms);
            var bytes = ms.ToArray();
            if (bytes.Length == 0) return BadRequest("Порожнє тіло");

            var now = DateTime.UtcNow;
            var camFolder = Path.Combine(GetFramesRoot(), pc, cameraId);
            Directory.CreateDirectory(camFolder);

            // Cache any metadata that came in with this frame (only non-empty fields overwrite).
            WriteMeta(pc, cameraId, new CameraMeta(
                CleanHeader(Request.Headers["X-Cam-Name"]),
                CleanHeader(Request.Headers["X-Cam-Model"]),
                CleanHeader(Request.Headers["X-Cam-Ip"]),
                CleanHeader(Request.Headers["X-Cam-Serial"])));

            var day = now.ToString("yyyy-MM-dd");
            var dayFolder = Path.Combine(camFolder, ArchiveDir, day);
            Directory.CreateDirectory(dayFolder);
            var archiveName = now.ToString("HHmmss-fffffff") + ".jpg";
            var archivePath = Path.Combine(dayFolder, archiveName);
            var tempPath = archivePath + ".tmp";
            await using (var dest = new FileStream(tempPath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }
            System.IO.File.Move(tempPath, archivePath, overwrite: true);

            MaybeEnforceQuota();

            return Ok(new { pc, cameraId, size = bytes.Length, at = now });
        }

        // GET /api/frames/pcs → folders that hold camera frames.
        [HttpGet("pcs")]
        public IActionResult Pcs()
        {
            if (!IsEnabled()) return NotFound();

            var root = GetFramesRoot();
            if (!Directory.Exists(root)) return Ok(Array.Empty<object>());

            var pcs = Directory.EnumerateDirectories(root)
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => SlugPattern.IsMatch(name))
                .Select(name => new {
                    pc = name,
                    cameras = CameraFolders(name).Count
                })
                .Where(x => x.cameras > 0)
                .OrderBy(x => x.pc, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(pcs);
        }

        // GET /api/frames/{pc}/cameras → cameras with metadata, recent frames and counts.
        [HttpGet("{pc}/cameras")]
        public IActionResult Cameras(string pc)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc)) return BadRequest("Невірний ідентифікатор ПК");

            var cameras = CameraFolders(pc)
                .Select(cameraId =>
                {
                    var meta = ReadMeta(pc, cameraId);
                    var recent = RecentFrameFiles(pc, cameraId, RecentFrameCount)
                        .Select(r => new {
                            imageUrl = FrameUrl(pc, cameraId, r.day, r.file),
                            timeUtc = ParseFrameTime(r.day, r.file),
                        })
                        .ToList();

                    return new {
                        cameraId,
                        name = meta.Name,
                        model = meta.Model,
                        ip = meta.Ip,
                        serial = meta.Serial,
                        lastSeenUtc = recent.Count > 0 ? recent[0].timeUtc : null,
                        todayCount = TodayCount(pc, cameraId),
                        totalCount = TotalCount(pc, cameraId),
                        frames = recent,
                    };
                })
                .OrderBy(x => x.name ?? x.cameraId, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(cameras);
        }

        // GET /api/frames/{pc}/{cameraId}/image → newest archived frame (convenience/back-compat).
        [HttpGet("{pc}/{cameraId}/image")]
        public async Task<IActionResult> Image(string pc, string cameraId)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId)) return NotFound();

            var recent = RecentFrameFiles(pc, cameraId, 1);
            if (recent.Count == 0) return NotFound("Ще немає кадру");

            var path = Path.Combine(ArchiveRoot(pc, cameraId), recent[0].day, recent[0].file);
            return await ServeImage(path, "Ще немає кадру");
        }

        // GET /api/frames/{pc}/{cameraId}/days → days that have archived frames, newest first.
        [HttpGet("{pc}/{cameraId}/days")]
        public IActionResult Days(string pc, string cameraId)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId)) return NotFound();

            var archiveRoot = Path.Combine(GetFramesRoot(), pc, cameraId, ArchiveDir);
            if (!Directory.Exists(archiveRoot)) return Ok(Array.Empty<object>());

            var days = Directory.EnumerateDirectories(archiveRoot)
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => DayPattern.IsMatch(name))
                .Select(day => new {
                    day,
                    count = Directory.EnumerateFiles(Path.Combine(archiveRoot, day), "*.jpg").Count()
                })
                .Where(x => x.count > 0)
                .OrderByDescending(x => x.day)
                .ToList();

            return Ok(days);
        }

        // GET /api/frames/{pc}/{cameraId}/days/{day} → archived frames for a day, oldest first.
        [HttpGet("{pc}/{cameraId}/days/{day}")]
        public IActionResult DayFrames(string pc, string cameraId, string day)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId)) return NotFound();
            if (!DayPattern.IsMatch(day)) return BadRequest("Невірна дата");

            var dayFolder = Path.Combine(GetFramesRoot(), pc, cameraId, ArchiveDir, day);
            if (!Directory.Exists(dayFolder)) return Ok(Array.Empty<object>());

            var frames = Directory.EnumerateFiles(dayFolder, "*.jpg")
                .Select(Path.GetFileName)
                .Where(name => name != null && FilePattern.IsMatch(name))
                .OrderBy(name => name, StringComparer.Ordinal)
                .Select(name => new {
                    file = name,
                    timeUtc = ParseFrameTime(day, name!),
                    imageUrl = $"/api/frames/{pc}/{cameraId}/archive/{day}/{name}"
                })
                .ToList();

            return Ok(frames);
        }

        // GET /api/frames/{pc}/{cameraId}/archive/{day}/{file} → a specific archived frame.
        [HttpGet("{pc}/{cameraId}/archive/{day}/{file}")]
        public async Task<IActionResult> Archive(string pc, string cameraId, string day, string file)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId)) return NotFound();
            if (!DayPattern.IsMatch(day) || !FilePattern.IsMatch(file)) return NotFound();

            var path = Path.Combine(GetFramesRoot(), pc, cameraId, ArchiveDir, day, file);
            return await ServeImage(path, "Кадр не знайдено");
        }

        // GET /api/frames/storage → disk usage of the archive + retention estimate (admin dashboard).
        [Authorize(Roles = "Superadmin,Admin")]
        [HttpGet("storage")]
        public IActionResult Storage()
        {
            if (!IsEnabled()) return NotFound();

            var maxBytes = GetMaxArchiveBytes();
            var root = GetFramesRoot();

            long usedBytes = 0;
            long frameCount = 0;
            DateTime? oldestUtc = null;
            DateTime? newestUtc = null;

            if (Directory.Exists(root))
            {
                foreach (var f in new DirectoryInfo(root)
                    .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
                    .Where(f => string.Equals(f.Directory?.Parent?.Name, ArchiveDir, StringComparison.Ordinal)))
                {
                    usedBytes += f.Length;
                    frameCount++;
                    var w = f.LastWriteTimeUtc;
                    if (oldestUtc is null || w < oldestUtc) oldestUtc = w;
                    if (newestUtc is null || w > newestUtc) newestUtc = w;
                }
            }

            // Середній розмір кадру з наявних даних; запасний варіант — 275 КБ.
            double avgBytes = frameCount > 0 ? (double)usedBytes / frameCount : 275d * 1024;

            // Темп зйомки за вікном архіву → скільки часу протримається ліміт при поточній швидкості.
            double? retentionHours = null;
            if (frameCount > 1 && oldestUtc is not null && newestUtc is not null
                && newestUtc > oldestUtc && maxBytes > 0 && avgBytes > 0)
            {
                var spanHours = (newestUtc.Value - oldestUtc.Value).TotalHours;
                var framesPerHour = frameCount / spanHours;
                if (framesPerHour > 0)
                    retentionHours = (maxBytes / avgBytes) / framesPerHour;
            }

            return Ok(new
            {
                enabled = true,
                quotaEnabled = maxBytes > 0,
                maxBytes,
                usedBytes,
                freeBytes = maxBytes > 0 ? Math.Max(0, maxBytes - usedBytes) : 0,
                usedPct = maxBytes > 0 ? Math.Round(usedBytes * 100.0 / maxBytes, 1) : 0,
                frameCount,
                avgFrameBytes = (long)avgBytes,
                oldestUtc,
                newestUtc,
                retentionHours = retentionHours.HasValue ? Math.Round(retentionHours.Value, 1) : (double?)null,
                cleaning = Interlocked.CompareExchange(ref _quotaRunning, 0, 0) == 1,
                recentCleanups = RecentCleanups().Select(e => new
                {
                    atUtc = e.AtUtc,
                    deletedFrames = e.DeletedFrames,
                    freedBytes = e.FreedBytes,
                    totalAfter = e.TotalAfter,
                    trigger = e.Trigger,
                }),
            });
        }

        // POST /api/frames/storage/cleanup → ручне очищення архіву. Лише для адміністраторів.
        //   ?keepDays=N → видалити архівні кадри, старіші за N останніх календарних днів (0 = весь архів);
        //   інакше      → обрізати найстаріші до targetPct% від ліміту (типово 80%).
        [Authorize(Roles = "Superadmin,Admin")]
        [HttpPost("storage/cleanup")]
        public IActionResult Cleanup([FromQuery] int? keepDays, [FromQuery] double? targetPct)
        {
            if (!IsEnabled()) return NotFound();

            var maxBytes = GetMaxArchiveBytes();
            var root = GetFramesRoot();
            CleanupEvent? ev;

            if (keepDays is int days && days >= 0)
            {
                // За днями: працює незалежно від ліміту — звільняє місце «на вимогу».
                ev = PurgeOlderThan(root, days, maxBytes);
            }
            else
            {
                if (maxBytes <= 0) return BadRequest("Ліміт архіву вимкнено");
                var pct = targetPct is >= 0 and <= 95 ? targetPct.Value : 80d;
                var targetBytes = (long)(maxBytes * pct / 100d);
                ev = TrimArchive(root, gateBytes: 0, targetBytes: targetBytes, maxBytes: maxBytes, trigger: "manual");
            }

            if (ev is not null)
            {
                RecordCleanup(ev);
                _logger.LogInformation(
                    "CameraWall: ручне очищення — видалено {Frames} кадрів, звільнено {Mb:F1} МБ",
                    ev.DeletedFrames, ev.FreedBytes / 1024d / 1024d);
            }

            return Ok(new
            {
                deletedFrames = ev?.DeletedFrames ?? 0,
                freedBytes = ev?.FreedBytes ?? 0,
            });
        }

        // camera folders under a pc that actually hold an archive of frames.
        private List<string> CameraFolders(string pc)
        {
            var pcFolder = Path.Combine(GetFramesRoot(), pc);
            if (!Directory.Exists(pcFolder)) return new List<string>();

            return Directory.EnumerateDirectories(pcFolder)
                .Where(dir => Directory.Exists(Path.Combine(dir, ArchiveDir)))
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => SlugPattern.IsMatch(name))
                .ToList();
        }

        private string ArchiveRoot(string pc, string cameraId) =>
            Path.Combine(GetFramesRoot(), pc, cameraId, ArchiveDir);

        private static string FrameUrl(string pc, string cameraId, string day, string file) =>
            $"/api/frames/{pc}/{cameraId}/archive/{day}/{file}";

        // Up to `count` most-recent frames for a camera, newest first.
        // Day folders (yyyy-MM-dd) and file names (HHmmss-fffffff) are both lexically sortable.
        private List<(string day, string file)> RecentFrameFiles(string pc, string cameraId, int count)
        {
            var result = new List<(string, string)>();
            var archiveRoot = ArchiveRoot(pc, cameraId);
            if (!Directory.Exists(archiveRoot)) return result;

            var days = Directory.EnumerateDirectories(archiveRoot)
                .Select(d => Path.GetFileName(d)!)
                .Where(n => DayPattern.IsMatch(n))
                .OrderByDescending(n => n, StringComparer.Ordinal);

            foreach (var day in days)
            {
                var files = Directory.EnumerateFiles(Path.Combine(archiveRoot, day), "*.jpg")
                    .Select(Path.GetFileName)
                    .Where(n => n != null && FilePattern.IsMatch(n))
                    .OrderByDescending(n => n, StringComparer.Ordinal);

                foreach (var f in files)
                {
                    result.Add((day, f!));
                    if (result.Count >= count) return result;
                }
            }

            return result;
        }

        // Frames archived for the current UTC day.
        private int TodayCount(string pc, string cameraId)
        {
            var folder = Path.Combine(ArchiveRoot(pc, cameraId), DateTime.UtcNow.ToString("yyyy-MM-dd"));
            return Directory.Exists(folder)
                ? Directory.EnumerateFiles(folder, "*.jpg").Count()
                : 0;
        }

        // All frames the camera has in the archive.
        private int TotalCount(string pc, string cameraId)
        {
            var archiveRoot = ArchiveRoot(pc, cameraId);
            return Directory.Exists(archiveRoot)
                ? Directory.EnumerateFiles(archiveRoot, "*.jpg", SearchOption.AllDirectories).Count()
                : 0;
        }

        // ── Per-camera metadata (meta.json next to the archive) ───────────
        public sealed record CameraMeta(string? Name, string? Model, string? Ip, string? Serial);

        private static readonly JsonSerializerOptions MetaJson = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
        };
        private static readonly object _metaLock = new();

        private CameraMeta ReadMeta(string pc, string cameraId)
        {
            var path = Path.Combine(GetFramesRoot(), pc, cameraId, MetaFile);
            if (!System.IO.File.Exists(path)) return new CameraMeta(null, null, null, null);
            try
            {
                var json = System.IO.File.ReadAllText(path);
                return JsonSerializer.Deserialize<CameraMeta>(json, MetaJson)
                    ?? new CameraMeta(null, null, null, null);
            }
            catch
            {
                return new CameraMeta(null, null, null, null);
            }
        }

        // Merge incoming metadata into the stored file; only non-empty fields overwrite.
        private void WriteMeta(string pc, string cameraId, CameraMeta incoming)
        {
            if (incoming is { Name: null, Model: null, Ip: null, Serial: null }) return;

            var camFolder = Path.Combine(GetFramesRoot(), pc, cameraId);
            lock (_metaLock)
            {
                var existing = ReadMeta(pc, cameraId);
                var merged = new CameraMeta(
                    Pick(incoming.Name, existing.Name),
                    Pick(incoming.Model, existing.Model),
                    Pick(incoming.Ip, existing.Ip),
                    Pick(incoming.Serial, existing.Serial));
                if (merged == existing) return; // records compare by value → nothing changed

                Directory.CreateDirectory(camFolder);
                var path = Path.Combine(camFolder, MetaFile);
                var tmp = path + ".tmp";
                System.IO.File.WriteAllText(tmp, JsonSerializer.Serialize(merged, MetaJson));
                System.IO.File.Move(tmp, path, overwrite: true);
            }
        }

        private static string? Pick(string? incoming, string? existing) =>
            string.IsNullOrWhiteSpace(incoming) ? existing : incoming;

        // Trim header values, drop control chars, cap length so meta.json stays sane.
        private static string? CleanHeader(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var trimmed = value.Trim();
            if (trimmed.Length > 120) trimmed = trimmed.Substring(0, 120);
            var cleaned = new string(trimmed.Where(c => !char.IsControl(c)).ToArray());
            return cleaned.Length == 0 ? null : cleaned;
        }

        private async Task<IActionResult> ServeImage(string path, string notFoundMessage)
        {
            for (int attempt = 0; attempt < 3; attempt++)
            {
                if (attempt > 0)
                    await Task.Delay(30);

                if (!System.IO.File.Exists(path))
                    continue;

                try
                {
                    using var fs = new FileStream(path, FileMode.Open, FileAccess.Read,
                        FileShare.ReadWrite | FileShare.Delete);
                    var bytes = new byte[fs.Length];
                    _ = await fs.ReadAsync(bytes);
                    Response.Headers["Cache-Control"] = "no-store";
                    return File(bytes, "image/jpeg");
                }
                catch (IOException)
                {
                    // file briefly unavailable during atomic replace, retry
                }
            }

            return NotFound(notFoundMessage);
        }

        // --- Дисковий бюджет: тримаємо архів у межах CameraWall:MaxArchiveGB ---
        // Throttle: повна перевірка не частіше ніж раз на хвилину, у фоні, без блокування відповіді.
        private static long _lastQuotaCheckTicks = long.MinValue;
        private static int _quotaRunning; // 0 = вільно, 1 = вже виконується

        // --- Журнал очищень: кільцевий буфер у пам'яті, найновіші спереду ---
        public sealed record CleanupEvent(
            DateTime AtUtc, int DeletedFrames, long FreedBytes, long TotalAfter, long MaxBytes, string Trigger);

        private const int MaxCleanupEvents = 40;
        private static readonly object _eventsLock = new();
        private static readonly LinkedList<CleanupEvent> _cleanupEvents = new();

        private static void RecordCleanup(CleanupEvent ev)
        {
            lock (_eventsLock)
            {
                _cleanupEvents.AddFirst(ev);
                while (_cleanupEvents.Count > MaxCleanupEvents)
                    _cleanupEvents.RemoveLast();
            }
        }

        private static List<CleanupEvent> RecentCleanups()
        {
            lock (_eventsLock) return _cleanupEvents.ToList();
        }

        private void MaybeEnforceQuota()
        {
            var maxBytes = GetMaxArchiveBytes();
            if (maxBytes <= 0) return; // 0 або менше — ліміт вимкнено

            var now = Environment.TickCount64;
            if (now - Interlocked.Read(ref _lastQuotaCheckTicks) < 60_000) return;

            // не запускати другу чистку, якщо попередня ще працює
            if (Interlocked.CompareExchange(ref _quotaRunning, 1, 0) != 0) return;
            Interlocked.Exchange(ref _lastQuotaCheckTicks, now);

            var root = GetFramesRoot();
            var logger = _logger; // ILogger безпечний для фону; контролер може бути вже звільнений
            _ = Task.Run(() =>
            {
                try
                {
                    // Авточистка: спрацьовує лише при перевищенні ліміту, цілимось у 95% (гістерезис).
                    var ev = TrimArchive(root, gateBytes: maxBytes, targetBytes: (long)(maxBytes * 0.95),
                        maxBytes: maxBytes, trigger: "auto");
                    if (ev is not null)
                    {
                        RecordCleanup(ev);
                        logger.LogInformation(
                            "CameraWall: авто-очищення архіву — видалено {Frames} кадрів, звільнено {Mb:F1} МБ (зайнято {Used:F1}/{Max:F1} ГБ)",
                            ev.DeletedFrames, ev.FreedBytes / 1024d / 1024d,
                            ev.TotalAfter / 1024d / 1024d / 1024d, maxBytes / 1024d / 1024d / 1024d);
                    }
                }
                catch { /* очищення best-effort: не валимо застосунок */ }
                finally { Interlocked.Exchange(ref _quotaRunning, 0); }
            });
        }

        // Видаляє найстаріші архівні кадри, доки сумарний розмір не впаде до targetBytes.
        // Чистимо лише якщо розмір перевищує gateBytes (gateBytes <= 0 → чистити завжди).
        // maxBytes зберігається в журналі для відображення ліміту. Повертає null, якщо нічого не видалено.
        private static CleanupEvent? TrimArchive(string root, long gateBytes, long targetBytes, long maxBytes, string trigger)
        {
            if (!Directory.Exists(root)) return null;

            var files = new DirectoryInfo(root)
                .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
                .Where(f => string.Equals(f.Directory?.Parent?.Name, ArchiveDir, StringComparison.Ordinal))
                .ToList();

            long total = files.Sum(f => f.Length);
            if (gateBytes > 0 && total <= gateBytes) return null; // ліміт не перевищено — нема що чистити

            int deleted = 0;
            long freed = 0;
            foreach (var f in files.OrderBy(f => f.LastWriteTimeUtc))
            {
                if (total <= targetBytes) break;
                try
                {
                    var len = f.Length;
                    f.Delete();
                    total -= len;
                    freed += len;
                    deleted++;
                }
                catch { /* файл міг зникнути/бути зайнятим — пропускаємо */ }
            }

            PruneEmptyDayFolders(root);

            return deleted == 0
                ? null
                : new CleanupEvent(DateTime.UtcNow, deleted, freed, total, maxBytes, trigger);
        }

        // Видаляє архівні кадри в днях, старіших за N останніх календарних днів (UTC).
        // keepDays = 0 → видалити весь архів. Повертає null, якщо нічого не видалено.
        private static CleanupEvent? PurgeOlderThan(string root, int keepDays, long maxBytes)
        {
            if (!Directory.Exists(root)) return null;

            var cutoff = DateTime.UtcNow.Date.AddDays(-keepDays); // лишаємо дні >= cutoff
            int deleted = 0;
            long freed = 0;

            foreach (var archiveDir in Directory.EnumerateDirectories(root, ArchiveDir, SearchOption.AllDirectories))
            {
                foreach (var dayDir in Directory.EnumerateDirectories(archiveDir))
                {
                    var dayName = Path.GetFileName(dayDir);
                    if (!DayPattern.IsMatch(dayName)) continue;

                    // Достатньо свіжий день — лишаємо.
                    if (DateTime.TryParseExact(dayName, "yyyy-MM-dd",
                            System.Globalization.CultureInfo.InvariantCulture,
                            System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                            out var day)
                        && day.Date >= cutoff)
                    {
                        continue;
                    }

                    foreach (var f in Directory.EnumerateFiles(dayDir, "*.jpg"))
                    {
                        try
                        {
                            var len = new FileInfo(f).Length;
                            System.IO.File.Delete(f);
                            freed += len;
                            deleted++;
                        }
                        catch { /* файл міг зникнути/бути зайнятим — пропускаємо */ }
                    }
                }
            }

            PruneEmptyDayFolders(root);

            if (deleted == 0) return null;

            // Перерахунок поточного розміру архіву для журналу.
            long total = new DirectoryInfo(root)
                .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
                .Where(f => string.Equals(f.Directory?.Parent?.Name, ArchiveDir, StringComparison.Ordinal))
                .Sum(f => f.Length);

            return new CleanupEvent(DateTime.UtcNow, deleted, freed, total, maxBytes, "manual");
        }

        // Прибираємо порожні папки днів archive/{день}, що лишились після видалення кадрів.
        private static void PruneEmptyDayFolders(string root)
        {
            foreach (var archiveDir in Directory.EnumerateDirectories(root, ArchiveDir, SearchOption.AllDirectories))
            {
                foreach (var dayDir in Directory.EnumerateDirectories(archiveDir))
                {
                    try
                    {
                        if (!Directory.EnumerateFileSystemEntries(dayDir).Any())
                            Directory.Delete(dayDir);
                    }
                    catch { /* гонитва з паралельним записом — ігноруємо */ }
                }
            }
        }

        // file name is HHmmss-fffffff.jpg in UTC; combine with the day folder.
        private static DateTime? ParseFrameTime(string day, string file)
        {
            var stem = Path.GetFileNameWithoutExtension(file);
            if (DateTime.TryParseExact($"{day} {stem}", "yyyy-MM-dd HHmmss-fffffff",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var dt))
            {
                return dt;
            }
            return null;
        }
    }
}
