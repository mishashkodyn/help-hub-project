namespace Application.DTOs.User
{
    public class UserProfileDto
    {
        public Guid? Id { get; set; }
        public string? UserName { get; set; }
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Email { get; set; }
        public string? ProfileImage { get; set; }
        public int UserCategory { get; set; }
        public IList<string> Roles { get; set; } = new List<string>();
        public PsychologistProfileDto? Psychologist { get; set; }
    }

    public class PsychologistProfileDto
    {
        public string Bio { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public ICollection<WorkingHourDto> WorkingHours { get; set; } = new List<WorkingHourDto>();
    }

    public class WorkingHourDto
    {
        public int DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }
}
