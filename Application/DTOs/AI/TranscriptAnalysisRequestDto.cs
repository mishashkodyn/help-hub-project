namespace Application.DTOs.AI
{
    public class TranscriptAnalysisRequestDto
    {
        public string Transcript { get; set; } = string.Empty;
        public string Action { get; set; } = "summarize";
        public string? UserName { get; set; }
        public string? SelectedText { get; set; }
        public string? TimeRangeLabel { get; set; }
        public string? Instruction { get; set; }
    }
}
