using Application.DTOs;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PsychologistsController : ControllerBase
    {
        private readonly IWorkingHoursService _workingHoursService;

        public PsychologistsController(IWorkingHoursService workingHoursService) 
        {
            _workingHoursService = workingHoursService;
        }

        [HttpGet("schedule")]
        public async Task<ActionResult<UpdateWorkingHoursDto>> GetMySchedule()
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _workingHoursService.GetWorkingHoursAsync(userId);
            return Ok(result);
        }

        [HttpPut("schedule")]
        public async Task<IActionResult> UpdateMySchedule([FromBody] UpdateWorkingHoursDto dto)
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await _workingHoursService.UpdateWorkingHoursAsync(userId, dto);
            return NoContent();
        }
    }
}
