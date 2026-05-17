namespace Application.DTOs.AI
{
    public class AiChatRequestDto
    {
        public List<AiChatMessageDto> Messages { get; set; } = new List<AiChatMessageDto>();
        public string? UserName { get; set; }
        public string Provider { get; set; } = "Groq";
        public string? Context { get; set; }
    }
}
