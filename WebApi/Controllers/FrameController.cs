using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/frames")]
    [ApiController]
    public class FrameController : ControllerBase
    {
        // Storage scheme: {FramesRoot}/{ip}/{date}/{HHmmss}.jpg
        //   ip   → camera IPv4 "A.B.C.D" (the camera's identity, also the folder name)
        //   date → capture day "yyyy-MM-dd"
        //   file → capture time "HHmmss.jpg" (a same-second collision gets a "-N" suffix)
        private static readonly Regex IpPattern = new(
            @"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$",
            RegexOptions.Compiled);
        private static readonly Regex DayPattern = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.Compiled);
        private static readonly Regex FilePattern = new(@"^\d{6}(-\d{1,3})?\.jpg$", RegexOptions.Compiled);

        // Capture time carried in the uploaded file name: exactly six digits "HHmmss".
        private static readonly Regex TimePattern = new(@"^\d{6}$", RegexOptions.Compiled);

        // How many recent frames a camera card shows (1 main + the rest as thumbnails).
        private const int RecentFrameCount = 3;

        // Cap a single multipart upload (one JPEG). Generous headroom over typical 0.2–2 MB frames.
        private const long MaxUploadBytes = 15L * 1024 * 1024;

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

        // POST /api/frames  ← multipart receiver for the capture agents.
        //   Auth : Authorization: Bearer <token>  → constant-time compared to CameraWall:UploadToken.
        //   Body : multipart/form-data
        //            ip    (text) → camera IPv4 "A.B.C.D" (e.g. 192.168.1.101); the identity key.
        //            date  (text) → capture day "yyyy-MM-dd".
        //            image (file) → JPEG; the file name carries the capture time "HHmmss.jpg".
        // The capture timestamp is taken from the file name (HHmmss) + the date field; an unexpected
        // name falls back to the receipt time and logs a warning.
        // Stored at {FramesRoot}/{ip}/{date}/{HHmmss}.jpg (collisions get a -N suffix, never overwrite).
        [HttpPost]
        [RequestSizeLimit(MaxUploadBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
        public async Task<IActionResult> Upload()
        {
            if (!IsEnabled()) return NotFound();
            if (!BearerTokenOk()) return Unauthorized("Відсутній або невірний токен");

            if (!Request.HasFormContentType)
                return BadRequest("Очікується multipart/form-data");

            var form = await Request.ReadFormAsync();

            var ip = form["ip"].ToString().Trim();
            if (!IpPattern.IsMatch(ip))
                return BadRequest("Поле ip відсутнє або невалідне (очікується IPv4, напр. 192.168.1.101)");

            var date = form["date"].ToString().Trim();
            if (!DayPattern.IsMatch(date) || !DateTime.TryParseExact(date, "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                return BadRequest("Поле date відсутнє або невалідне (очікується yyyy-MM-dd)");

            var file = form.Files["image"] ?? (form.Files.Count > 0 ? form.Files[0] : null);
            if (file is null || file.Length == 0)
                return BadRequest("Файл image відсутній або порожній");

            byte[] bytes;
            await using (var src = file.OpenReadStream())
                bytes = await ReadBody(src);
            if (bytes.Length == 0) return BadRequest("Файл image порожній");

            // Capture time from the file name (HHmmss); fall back to the receipt time if unexpected.
            var time = ExtractFrameTime(file.FileName, out var fromName);
            if (!fromName)
                _logger.LogWarning(
                    "CameraWall: ip {Ip}, дата {Date} — ім'я файлу '{File}' не у форматі HHmmss.jpg; " +
                    "час знімку взято з моменту прийому ({Time})",
                    ip, date, file.FileName, time);

            var saved = await StoreFrameAsync(ip, date, time, bytes);

            _logger.LogInformation(
                "CameraWall: прийнято кадр — ip {Ip}, дата {Date}, час {Time}, розмір {Bytes} Б → {Saved}",
                ip, date, time, bytes.Length, saved);

            return Ok(new { saved });
        }

        // Validates the Authorization: Bearer <token> header against CameraWall:UploadToken in
        // constant time. Returns false for a missing header, wrong scheme, empty or mismatched token.
        private bool BearerTokenOk()
        {
            var configured = GetUploadToken();
            if (string.IsNullOrEmpty(configured)) return false; // not configured → deny everything

            if (!Request.Headers.TryGetValue("Authorization", out var header)) return false;

            var raw = header.ToString();
            const string scheme = "Bearer ";
            if (!raw.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)) return false;

            var provided = raw[scheme.Length..].Trim();
            if (provided.Length == 0) return false;

            var a = System.Text.Encoding.UTF8.GetBytes(provided);
            var b = System.Text.Encoding.UTF8.GetBytes(configured);
            return CryptographicOperations.FixedTimeEquals(a, b);
        }

        // Pulls the "HHmmss" stem out of an uploaded file name like "173051.jpg".
        // Sets fromName=false and returns the current local wall-clock time when the name doesn't fit.
        private static string ExtractFrameTime(string? fileName, out bool fromName)
        {
            fromName = false;
            var stem = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
            if (TimePattern.IsMatch(stem) &&
                DateTime.TryParseExact(stem, "HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            {
                fromName = true;
                return stem;
            }
            return DateTime.Now.ToString("HHmmss");
        }

        private static async Task<byte[]> ReadBody(Stream body)
        {
            using var ms = new MemoryStream();
            await body.CopyToAsync(ms);
            return ms.ToArray();
        }

        // Frame-write path: store under {ip}/{date} and enforce the disk quota. The file name is the
        // capture time "HHmmss.jpg"; a same-second collision gets a "-N" suffix so an existing frame is
        // never overwritten. Returns the saved relative path "{ip}/{date}/{file}".
        private async Task<string> StoreFrameAsync(string ip, string date, string time, byte[] bytes)
        {
            var dayFolder = Path.Combine(GetFramesRoot(), ip, date);
            Directory.CreateDirectory(dayFolder);

            // Write to a temp file, then atomically move into a free name (overwrite: false). If we
            // lose the race for that name, bump the suffix and retry.
            var tempPath = Path.Combine(dayFolder, $"{time}-{Guid.NewGuid():N}.tmp");
            await using (var dest = new FileStream(tempPath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }

            string fileName = $"{time}.jpg";
            for (var n = 1; ; n++)
            {
                var framePath = Path.Combine(dayFolder, fileName);
                try
                {
                    System.IO.File.Move(tempPath, framePath, overwrite: false);
                    break;
                }
                catch (IOException) when (n < 1000 && System.IO.File.Exists(tempPath))
                {
                    fileName = $"{time}-{n}.jpg"; // name taken — try the next suffix
                }
            }

            MaybeEnforceQuota();

            return $"{ip}/{date}/{fileName}";
        }

        // GET /api/frames/cameras → every camera (an IP folder) with its recent frames and counts.
        [HttpGet("cameras")]
        public IActionResult Cameras()
        {
            if (!IsEnabled()) return NotFound();

            var cameras = CameraIps()
                .Select(ip =>
                {
                    var recent = RecentFrameFiles(ip, RecentFrameCount)
                        .Select(r => new {
                            imageUrl = FrameUrl(ip, r.day, r.file),
                            timeUtc = ParseFrameTime(r.day, r.file),
                        })
                        .ToList();

                    return new {
                        ip,
                        name = ip,
                        lastSeenUtc = recent.Count > 0 ? recent[0].timeUtc : null,
                        todayCount = TodayCount(ip),
                        totalCount = TotalCount(ip),
                        frames = recent,
                    };
                })
                .OrderBy(x => x.ip, IpComparer)
                .ToList();

            return Ok(cameras);
        }

        // GET /api/frames/live → lightweight per-camera latest frame for the auto-refreshing "live
        // grid" view. Kept separate from /cameras so the two view modes can evolve independently.
        [HttpGet("live")]
        public IActionResult Live()
        {
            if (!IsEnabled()) return NotFound();

            var cameras = CameraIps()
                .Select(ip =>
                {
                    var recent = RecentFrameFiles(ip, 1);
                    string? imageUrl = null;
                    DateTime? lastSeenUtc = null;
                    if (recent.Count > 0)
                    {
                        imageUrl = FrameUrl(ip, recent[0].day, recent[0].file);
                        lastSeenUtc = ParseFrameTime(recent[0].day, recent[0].file);
                    }

                    return new {
                        ip,
                        name = ip,
                        imageUrl,
                        lastSeenUtc,
                    };
                })
                .OrderBy(x => x.ip, IpComparer)
                .ToList();

            return Ok(cameras);
        }

        // GET /api/frames/{ip}/days → days that have frames for a camera, newest first.
        [HttpGet("{ip}/days")]
        public IActionResult Days(string ip)
        {
            if (!IsEnabled()) return NotFound();
            if (!IpPattern.IsMatch(ip)) return NotFound();

            var camFolder = Path.Combine(GetFramesRoot(), ip);
            if (!Directory.Exists(camFolder)) return Ok(Array.Empty<object>());

            var days = Directory.EnumerateDirectories(camFolder)
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => DayPattern.IsMatch(name))
                .Select(day => new {
                    day,
                    count = Directory.EnumerateFiles(Path.Combine(camFolder, day), "*.jpg").Count()
                })
                .Where(x => x.count > 0)
                .OrderByDescending(x => x.day, StringComparer.Ordinal)
                .ToList();

            return Ok(days);
        }

        // GET /api/frames/{ip}/days/{day} → frames for a camera on a day, oldest first.
        [HttpGet("{ip}/days/{day}")]
        public IActionResult DayFrames(string ip, string day)
        {
            if (!IsEnabled()) return NotFound();
            if (!IpPattern.IsMatch(ip)) return NotFound();
            if (!DayPattern.IsMatch(day)) return BadRequest("Невірна дата");

            var dayFolder = Path.Combine(GetFramesRoot(), ip, day);
            if (!Directory.Exists(dayFolder)) return Ok(Array.Empty<object>());

            var frames = Directory.EnumerateFiles(dayFolder, "*.jpg")
                .Select(Path.GetFileName)
                .Where(name => name != null && FilePattern.IsMatch(name))
                .OrderBy(name => name, StringComparer.Ordinal)
                .Select(name => new {
                    file = name,
                    timeUtc = ParseFrameTime(day, name!),
                    imageUrl = FrameUrl(ip, day, name!),
                })
                .ToList();

            return Ok(frames);
        }

        // GET /api/frames/{ip}/{day}/{file} → a specific stored frame.
        // The literal "{ip}/days/…" routes above take precedence, so "days" can never be a {day}.
        [HttpGet("{ip}/{day}/{file}")]
        public async Task<IActionResult> Frame(string ip, string day, string file)
        {
            if (!IsEnabled()) return NotFound();
            if (!IpPattern.IsMatch(ip) || !DayPattern.IsMatch(day) || !FilePattern.IsMatch(file))
                return NotFound();

            var path = Path.Combine(GetFramesRoot(), ip, day, file);
            return await ServeImage(path, "Кадр не знайдено");
        }

        // GET /api/frames/storage → disk usage of the frame store + retention estimate (admin dashboard).
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
                foreach (var f in new DirectoryInfo(root).EnumerateFiles("*.jpg", SearchOption.AllDirectories))
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

        // POST /api/frames/storage/cleanup → ручне очищення сховища. Лише для адміністраторів.
        //   ?keepDays=N → видалити кадри, старіші за N останніх календарних днів (0 = усе сховище);
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
                if (maxBytes <= 0) return BadRequest("Ліміт сховища вимкнено");
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

        // ── camera discovery ──────────────────────────────────────────────

        // IP folders under the root that actually hold at least one frame.
        private List<string> CameraIps()
        {
            var root = GetFramesRoot();
            if (!Directory.Exists(root)) return new List<string>();

            return Directory.EnumerateDirectories(root)
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => IpPattern.IsMatch(name))
                .Where(HasAnyFrame)
                .ToList();
        }

        private bool HasAnyFrame(string ip)
        {
            var camFolder = Path.Combine(GetFramesRoot(), ip);
            return Directory.Exists(camFolder)
                && Directory.EnumerateDirectories(camFolder)
                    .Where(d => DayPattern.IsMatch(Path.GetFileName(d)!))
                    .Any(d => Directory.EnumerateFiles(d, "*.jpg").Any());
        }

        // Sort cameras by IP numerically (octet by octet) so .2 comes before .10.
        private static readonly IComparer<string> IpComparer = Comparer<string>.Create((a, b) =>
        {
            var pa = a.Split('.');
            var pb = b.Split('.');
            for (var i = 0; i < 4; i++)
            {
                var na = i < pa.Length && int.TryParse(pa[i], out var x) ? x : 0;
                var nb = i < pb.Length && int.TryParse(pb[i], out var y) ? y : 0;
                if (na != nb) return na.CompareTo(nb);
            }
            return string.CompareOrdinal(a, b);
        });

        private static string FrameUrl(string ip, string day, string file) =>
            $"/api/frames/{ip}/{day}/{file}";

        // Up to `count` most-recent frames for a camera, newest first.
        // Day folders (yyyy-MM-dd) and file names (HHmmss) are both lexically sortable.
        private List<(string day, string file)> RecentFrameFiles(string ip, int count)
        {
            var result = new List<(string, string)>();
            var camFolder = Path.Combine(GetFramesRoot(), ip);
            if (!Directory.Exists(camFolder)) return result;

            var days = Directory.EnumerateDirectories(camFolder)
                .Select(d => Path.GetFileName(d)!)
                .Where(n => DayPattern.IsMatch(n))
                .OrderByDescending(n => n, StringComparer.Ordinal);

            foreach (var day in days)
            {
                var files = Directory.EnumerateFiles(Path.Combine(camFolder, day), "*.jpg")
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

        // Frames stored for the current local day.
        private int TodayCount(string ip)
        {
            var folder = Path.Combine(GetFramesRoot(), ip, DateTime.Now.ToString("yyyy-MM-dd"));
            return Directory.Exists(folder)
                ? Directory.EnumerateFiles(folder, "*.jpg").Count()
                : 0;
        }

        // All frames the camera has stored.
        private int TotalCount(string ip)
        {
            var camFolder = Path.Combine(GetFramesRoot(), ip);
            return Directory.Exists(camFolder)
                ? Directory.EnumerateFiles(camFolder, "*.jpg", SearchOption.AllDirectories).Count()
                : 0;
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

        // --- Дисковий бюджет: тримаємо сховище в межах CameraWall:MaxArchiveGB ---
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
                            "CameraWall: авто-очищення сховища — видалено {Frames} кадрів, звільнено {Mb:F1} МБ (зайнято {Used:F1}/{Max:F1} ГБ)",
                            ev.DeletedFrames, ev.FreedBytes / 1024d / 1024d,
                            ev.TotalAfter / 1024d / 1024d / 1024d, maxBytes / 1024d / 1024d / 1024d);
                    }
                }
                catch { /* очищення best-effort: не валимо застосунок */ }
                finally { Interlocked.Exchange(ref _quotaRunning, 0); }
            });
        }

        // Видаляє найстаріші кадри, доки сумарний розмір не впаде до targetBytes.
        // Чистимо лише якщо розмір перевищує gateBytes (gateBytes <= 0 → чистити завжди).
        // maxBytes зберігається в журналі для відображення ліміту. Повертає null, якщо нічого не видалено.
        private static CleanupEvent? TrimArchive(string root, long gateBytes, long targetBytes, long maxBytes, string trigger)
        {
            if (!Directory.Exists(root)) return null;

            var files = new DirectoryInfo(root)
                .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
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

            PruneEmptyFolders(root);

            return deleted == 0
                ? null
                : new CleanupEvent(DateTime.UtcNow, deleted, freed, total, maxBytes, trigger);
        }

        // Видаляє кадри в днях, старіших за N останніх календарних днів (локальних).
        // keepDays = 0 → видалити все сховище. Повертає null, якщо нічого не видалено.
        private static CleanupEvent? PurgeOlderThan(string root, int keepDays, long maxBytes)
        {
            if (!Directory.Exists(root)) return null;

            var cutoff = DateTime.Now.Date.AddDays(-keepDays); // лишаємо дні >= cutoff
            int deleted = 0;
            long freed = 0;

            foreach (var camDir in Directory.EnumerateDirectories(root))
            {
                if (!IpPattern.IsMatch(Path.GetFileName(camDir)!)) continue;

                foreach (var dayDir in Directory.EnumerateDirectories(camDir))
                {
                    var dayName = Path.GetFileName(dayDir)!;
                    if (!DayPattern.IsMatch(dayName)) continue;

                    // Достатньо свіжий день — лишаємо.
                    if (DateTime.TryParseExact(dayName, "yyyy-MM-dd",
                            CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
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

            PruneEmptyFolders(root);

            if (deleted == 0) return null;

            // Перерахунок поточного розміру сховища для журналу.
            long total = new DirectoryInfo(root)
                .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
                .Sum(f => f.Length);

            return new CleanupEvent(DateTime.UtcNow, deleted, freed, total, maxBytes, "manual");
        }

        // Прибираємо порожні папки днів {ip}/{день} (а потім і порожні папки камер), що лишились
        // після видалення кадрів.
        private static void PruneEmptyFolders(string root)
        {
            foreach (var camDir in Directory.EnumerateDirectories(root))
            {
                foreach (var dayDir in Directory.EnumerateDirectories(camDir))
                {
                    try
                    {
                        if (!Directory.EnumerateFileSystemEntries(dayDir).Any())
                            Directory.Delete(dayDir);
                    }
                    catch { /* гонитва з паралельним записом — ігноруємо */ }
                }

                try
                {
                    if (!Directory.EnumerateFileSystemEntries(camDir).Any())
                        Directory.Delete(camDir);
                }
                catch { /* не порожня / гонитва — лишаємо */ }
            }
        }

        // Reconstructs a frame's capture time from its day folder + file name "HHmmss" (the camera's
        // wall-clock time, kept as-is / Unspecified kind), stripping any "-N" collision suffix first.
        private static DateTime? ParseFrameTime(string day, string file)
        {
            var stem = Path.GetFileNameWithoutExtension(file);
            var dash = stem.IndexOf('-');
            var timePart = dash >= 0 ? stem[..dash] : stem;

            if (DateTime.TryParseExact($"{day} {timePart}", "yyyy-MM-dd HHmmss",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
            {
                return dt;
            }

            return null;
        }
    }
}
