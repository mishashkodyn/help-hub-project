using Application.DTOs.AI;

namespace Infrastructure.Services.Interfaces
{
    public interface IAiService
    {
        Task<string> ChatAsync(AiChatRequestDto request);
        Task<string> AnalyzeTranscriptAsync(TranscriptAnalysisRequestDto request);
    }
}
