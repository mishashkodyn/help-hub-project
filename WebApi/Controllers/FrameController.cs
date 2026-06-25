using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/frames")]
    [ApiController]
    public class FrameController : ControllerBase
    {
        // pc / camera names: a safe slug, no path-traversal characters.
        private static readonly Regex SlugPattern = new(@"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$", RegexOptions.Compiled);
        // yyyy-MM-dd
        private static readonly Regex DayPattern = new(@"^\d{4}-\d{2}-\d{2}$", RegexOptions.Compiled);
        // archive file name, e.g. 142530-1234567.jpg
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

        // POST /api/frames/{pc}/{cameraId}
        // pc — the computer the cameras belong to (e.g. "PC1"); appended, not overwritten.
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

            // 1) live frame — atomically replace latest.jpg
            var latestPath = Path.Combine(camFolder, LatestFile);
            var tempPath = latestPath + ".tmp";
            await using (var dest = new FileStream(tempPath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }
            System.IO.File.Move(tempPath, latestPath, overwrite: true);

            // 2) archive frame — append a per-day copy so the history is preserved
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
