namespace Application.DTOs
{
    public class SessionInfoDto
    {
        public Guid Id { get; set; }
        public string PsychologistName { get; set; } = string.Empty;
        public string PsychologistUserId { get; set; } = string.Empty;
        public string ClientName { get; set; } = string.Empty;
        public string ClientUserId { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsAccessible { get; set; }
    }
}
