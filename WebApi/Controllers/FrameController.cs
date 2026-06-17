using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/frames")]
    [ApiController]
    public class FrameController : ControllerBase
    {
        private static readonly HashSet<string> AllowedCameras = new(StringComparer.OrdinalIgnoreCase)
        {
            "cam-01", "cam-02", "cam-03", "cam-04"
        };

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

        [HttpPost("{cameraId}")]
        public async Task<IActionResult> Upload(string cameraId)
        {
            if (!IsEnabled()) return NotFound();

            if (!Request.Headers.TryGetValue("X-Upload-Token", out var token) || token != GetUploadToken())
                return Unauthorized("Невірний токен");

            if (!AllowedCameras.Contains(cameraId))
                return BadRequest("Невідома камера");

            using var ms = new MemoryStream();
            await Request.Body.CopyToAsync(ms);
            var bytes = ms.ToArray();
            if (bytes.Length == 0) return BadRequest("Порожнє тіло");

            var camFolder = Path.Combine(GetFramesRoot(), cameraId);
            Directory.CreateDirectory(camFolder);
            var latestPath = Path.Combine(camFolder, "latest.jpg");
            var tempPath = latestPath + ".tmp";
            await using (var dest = new FileStream(tempPath, FileMode.Create, FileAccess.Write,
                FileShare.None, bufferSize: 4096, useAsync: true))
            {
                await dest.WriteAsync(bytes);
            }
            System.IO.File.Move(tempPath, latestPath, overwrite: true);

            LatestFrames.Update(cameraId, DateTime.UtcNow);
            return Ok(new { cameraId, size = bytes.Length, at = DateTime.UtcNow });
        }

        [HttpGet("latest")]
        public IActionResult Latest()
        {
            if (!IsEnabled()) return NotFound();

            var result = AllowedCameras
                .Select(id => new {
                    cameraId = id,
                    lastSeenUtc = LatestFrames.Get(id),
                    imageUrl = $"/api/frames/{id}/image"
                })
                .OrderBy(x => x.cameraId)
                .ToList();
            return Ok(result);
        }

        [HttpGet("{cameraId}/image")]
        public async Task<IActionResult> Image(string cameraId)
        {
            if (!IsEnabled()) return NotFound();

            if (!AllowedCameras.Contains(cameraId)) return NotFound();
            var path = Path.Combine(GetFramesRoot(), cameraId, "latest.jpg");
            if (!System.IO.File.Exists(path)) return NotFound("Ще немає кадру");
            Response.Headers["Cache-Control"] = "no-store";
            using var fs = new FileStream(path, FileMode.Open, FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete);
            var bytes = new byte[fs.Length];
            _ = await fs.ReadAsync(bytes);
            return File(bytes, "image/jpeg");
        }
    }

    public static class LatestFrames
    {
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> _map = new();
        public static void Update(string cameraId, DateTime utc) => _map[cameraId] = utc;
        public static DateTime? Get(string cameraId) => _map.TryGetValue(cameraId, out var v) ? v : null;
    }
}
