namespace Application.DTOs
{
    public class SessionTranscriptDto
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Guid SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }
}
