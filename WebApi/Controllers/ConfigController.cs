using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/config")]
    [ApiController]
    public class ConfigController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public ConfigController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("features")]
        public IActionResult Features()
        {
            return Ok(new
            {
                cameraWall = _configuration.GetValue<bool>("CameraWall:Enabled")
            });
        }
    }
}
