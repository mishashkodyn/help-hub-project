using Application.DTOs.AI;
using Domain.Common;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AiController : ControllerBase
    {
        private readonly IAiService _aiService;

        public AiController (IAiService aiService)
        {
            _aiService = aiService;
        }

        [Authorize]
        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request)
        {
            if (request is null || !request.Messages.Any())
                return BadRequest("Response cannot be empty");

            try
            {
                var result = await _aiService.ChatAsync(request);
                return Ok(Response<string>.Success(result, "AI response received successfully"));
            }
            catch (Exception ex)
            {
                return StatusCode(500, Response<string>.Failure($"AI Error: {ex.Message}"));
            }

        }

        [Authorize]
        [HttpPost("analyze-transcript")]
        public async Task<IActionResult> AnalyzeTranscript([FromBody] TranscriptAnalysisRequestDto request)
        {
            if (request is null || (string.IsNullOrWhiteSpace(request.Transcript) && string.IsNullOrWhiteSpace(request.SelectedText)))
                return BadRequest("Transcript cannot be empty");

            try
            {
                var result = await _aiService.AnalyzeTranscriptAsync(request);
                return Ok(Response<string>.Success(result, "Transcript analysis completed"));
            }
            catch (Exception ex)
            {
                return StatusCode(500, Response<string>.Failure($"AI Error: {ex.Message}"));
            }
        }
    }
}
