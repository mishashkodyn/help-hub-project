using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AppointmentsController : ControllerBase
    {
        private readonly IAppointmentService _appointmentService;
        private readonly IDeepgramService _deepgramService;

        public AppointmentsController(IAppointmentService appointmentService, IDeepgramService deepgramService)
        {
            _appointmentService = appointmentService;
            _deepgramService = deepgramService;
        }

        [HttpGet("my-sessions")]
        public async Task<IActionResult> GetMySessions()
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var sessions = await _appointmentService.GetClientSessionsAsync(userId);
            return Ok(sessions);
        }

        [HttpGet("psychologist-sessions")]
        public async Task<IActionResult> GetPsychologistSessions()
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var sessions = await _appointmentService.GetPsychologistSessionsAsync(userId);
                return Ok(sessions);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("psychologist-past-sessions")]
        public async Task<IActionResult> GetPsychologistPastSessions()
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var sessions = await _appointmentService.GetPsychologistPastSessionsAsync(userId);
                return Ok(sessions);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("{id}/note")]
        public async Task<IActionResult> GetSessionNote(Guid id)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var note = await _appointmentService.GetSessionNoteAsync(id, userId);
                return Ok(note);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPut("{id}/note")]
        public async Task<IActionResult> UpsertSessionNote(Guid id, [FromBody] Application.DTOs.UpsertSessionNoteDto dto)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var note = await _appointmentService.UpsertSessionNoteAsync(id, userId, dto.Content ?? string.Empty);
                return Ok(note);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpGet("{id}/info")]
        public async Task<IActionResult> GetSessionInfo(Guid id)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var info = await _appointmentService.GetSessionInfoAsync(id, userId);
                return Ok(info);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        [HttpGet("{id}/transcription-token")]
        public async Task<IActionResult> GetTranscriptionToken(Guid id)
        {
            try
            {
                var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

                // Reuse the session-info check — throws UnauthorizedAccessException for non-participants.
                _ = await _appointmentService.GetSessionInfoAsync(id, userId);

                var key = await _deepgramService.CreateTemporaryKeyAsync();
                return Ok(new { token = key });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
