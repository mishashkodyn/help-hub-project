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
        private const string LatestFile = "latest.jpg";

        private readonly IConfiguration _configuration;

        public FrameController(IConfiguration configuration)
        {
            _configuration = configuration;
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

            var latestPath = Path.Combine(camFolder, LatestFile);
            var tempPath = latestPath + ".tmp";
            await using (var dest = new FileStream(tempPath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }
            System.IO.File.Move(tempPath, latestPath, overwrite: true);

            var day = now.ToString("yyyy-MM-dd");
            var dayFolder = Path.Combine(camFolder, ArchiveDir, day);
            Directory.CreateDirectory(dayFolder);
            var archiveName = now.ToString("HHmmss-fffffff") + ".jpg";
            var archivePath = Path.Combine(dayFolder, archiveName);
            await using (var dest = new FileStream(archivePath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }

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

        // GET /api/frames/{pc}/cameras → cameras with their last frame + timestamp.
        [HttpGet("{pc}/cameras")]
        public IActionResult Cameras(string pc)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc)) return BadRequest("Невірний ідентифікатор ПК");

            var cameras = CameraFolders(pc)
                .Select(cameraId => new {
                    cameraId,
                    lastSeenUtc = LatestWriteUtc(pc, cameraId),
                    imageUrl = $"/api/frames/{pc}/{cameraId}/image"
                })
                .OrderBy(x => x.cameraId, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(cameras);
        }

        // GET /api/frames/{pc}/{cameraId}/image → latest live frame.
        [HttpGet("{pc}/{cameraId}/image")]
        public async Task<IActionResult> Image(string pc, string cameraId)
        {
            if (!IsEnabled()) return NotFound();
            if (!SlugPattern.IsMatch(pc) || !SlugPattern.IsMatch(cameraId)) return NotFound();

            var path = Path.Combine(GetFramesRoot(), pc, cameraId, LatestFile);
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
                maxBytes,
                usedBytes,
                usedPct = maxBytes > 0 ? Math.Round(usedBytes * 100.0 / maxBytes, 1) : 0,
                frameCount,
                avgFrameBytes = (long)avgBytes,
                oldestUtc,
                newestUtc,
                retentionHours = retentionHours.HasValue ? Math.Round(retentionHours.Value, 1) : (double?)null,
            });
        }

        // camera folders under a pc that actually hold a frame (latest.jpg or an archive).
        private List<string> CameraFolders(string pc)
        {
            var pcFolder = Path.Combine(GetFramesRoot(), pc);
            if (!Directory.Exists(pcFolder)) return new List<string>();

            return Directory.EnumerateDirectories(pcFolder)
                .Where(dir =>
                    System.IO.File.Exists(Path.Combine(dir, LatestFile)) ||
                    Directory.Exists(Path.Combine(dir, ArchiveDir)))
                .Select(dir => Path.GetFileName(dir)!)
                .Where(name => SlugPattern.IsMatch(name))
                .ToList();
        }

        private DateTime? LatestWriteUtc(string pc, string cameraId)
        {
            var path = Path.Combine(GetFramesRoot(), pc, cameraId, LatestFile);
            return System.IO.File.Exists(path)
                ? System.IO.File.GetLastWriteTimeUtc(path)
                : null;
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
            _ = Task.Run(() =>
            {
                try { EnforceQuota(root, maxBytes); }
                catch { /* очищення best-effort: не валимо застосунок */ }
                finally { Interlocked.Exchange(ref _quotaRunning, 0); }
            });
        }

        // Рахуємо сумарний розмір архівних кадрів і, якщо перевищено ліміт,
        // видаляємо найстаріші, доки не опустимось нижче 95% ліміту (гістерезис).
        private static void EnforceQuota(string root, long maxBytes)
        {
            if (!Directory.Exists(root)) return;

            var files = new DirectoryInfo(root)
                .EnumerateFiles("*.jpg", SearchOption.AllDirectories)
                .Where(f => string.Equals(f.Directory?.Parent?.Name, ArchiveDir, StringComparison.Ordinal))
                .ToList();

            long total = files.Sum(f => f.Length);
            if (total <= maxBytes) return;

            var target = (long)(maxBytes * 0.95);
            foreach (var f in files.OrderBy(f => f.LastWriteTimeUtc))
            {
                try
                {
                    var len = f.Length;
                    f.Delete();
                    total -= len;
                }
                catch { /* файл міг зникнути/бути зайнятим — пропускаємо */ }

                if (total <= target) break;
            }

            PruneEmptyDayFolders(root);
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
