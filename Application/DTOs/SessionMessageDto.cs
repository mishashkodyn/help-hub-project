namespace Application.DTOs
{
    public class SessionMessageDto
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Guid SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
    }
}
