namespace Application.DTOs
{
    public class ClientSessionDto
    {
        public Guid Id { get; set; }
        public string PsychologistName { get; set; } = string.Empty;
        public string PsychologistUserId { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string? ClientNotes { get; set; }
        public bool IsAccessible { get; set; }
    }
}
