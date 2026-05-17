using Application.DTOs;
using Infrastructure.Services;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PsychologistsController : ControllerBase
    {
        private readonly IWorkingHoursService _workingHoursService;
        private readonly IAppointmentService _appointmentService;
        private readonly IPsychologistResumeService _resumeService;

        public PsychologistsController(
            IWorkingHoursService workingHoursService,
            IAppointmentService appointmentService,
            IPsychologistResumeService resumeService)
        {
            _workingHoursService = workingHoursService;
            _appointmentService = appointmentService;
            _resumeService = resumeService;
        }

        [HttpGet("resume")]
        [Authorize(Roles = "Psychologist")]
        public async Task<ActionResult<PsychologistResumeDto>> GetMyResume()
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            try
            {
                var resume = await _resumeService.GetMyResumeAsync(userId);
                return Ok(resume);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPut("resume")]
        [Authorize(Roles = "Psychologist")]
        public async Task<ActionResult<PsychologistResumeDto>> UpdateMyResume([FromBody] UpdatePsychologistResumeDto dto)
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            try
            {
                var resume = await _resumeService.UpdateMyResumeAsync(userId, dto);
                return Ok(resume);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("catalog")]
        [Authorize]
        public async Task<ActionResult<PsychologistCatalogPageDto>> GetCatalog([FromQuery] PsychologistCatalogFilterDto filter)
        {
            var result = await _resumeService.GetCatalogAsync(filter);
            return Ok(result);
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

        [HttpGet("available-slots")]
        [Authorize]
        public async Task<IActionResult> GetAvailableSlots([FromQuery] Guid psychologistId, [FromQuery] DateTime date)
        {
            var slots = await _appointmentService.GetAvailableSlotsAsync(psychologistId, date);
            return Ok(slots);
        }

        [HttpPost("book")]
        [Authorize]
        public async Task<IActionResult> BookAppointment([FromBody] CreateAppointmentDto dto)
        {
            var clientIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(clientIdString) || !Guid.TryParse(clientIdString, out var clientId))
                return Unauthorized("User ID not found in token.");

            try
            {
                await _appointmentService.CreateAppointmentAsync(clientId, dto);

                return Ok(new { message = "Appointment request successfully created." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("psychologist-applications")]
        [Authorize]
        public async Task<IActionResult> GetPsychologistApplications()
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var applications = await _appointmentService.GetPsychologistApplicationsAsync(userId);
            return Ok(applications);
        }

        [HttpPut("{id}/approve")]
        [Authorize]
        public async Task<IActionResult> ApproveAppointment(Guid id)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                await _appointmentService.ApproveAppointmentAsync(userId, id);
                return Ok(new { message = "Appointment approved successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPut("{id}/decline")]
        [Authorize]
        public async Task<IActionResult> DeclineAppointment(Guid id)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                await _appointmentService.DeclineAppointmentAsync(userId, id);
                return Ok(new { message = "Appointment declined successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
