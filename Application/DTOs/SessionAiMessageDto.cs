namespace Application.DTOs
{
    public class SessionAiMessageDto
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public string Role { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }

    public class SaveAiMessageDto
    {
        public string Role { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
        public DateTime? Timestamp { get; set; }
    }

    public class SaveAiMessagesDto
    {
        public List<SaveAiMessageDto> Messages { get; set; } = new();
    }
}
