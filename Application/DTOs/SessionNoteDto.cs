namespace Application.DTOs
{
    public class SessionNoteDto
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public DateTime UpdatedDate { get; set; }
    }

    public class UpsertSessionNoteDto
    {
        public string Content { get; set; } = string.Empty;
    }

    public class PastSessionDto
    {
        public Guid Id { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public Guid ClientUserId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string? ClientNotes { get; set; }
        public bool HasPsychologistNote { get; set; }
    }
}
