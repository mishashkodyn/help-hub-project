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
        public Guid? PsychologistId { get; set; }
        public PsychologistProfileDto? Psychologist { get; set; }
    }

    public class PsychologistProfileDto
    {
        public string Bio { get; set; } = string.Empty;
        public string ContactPhone { get; set; } = string.Empty;
        public string VideoGreetingUrl { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public int ExperienceYears { get; set; }
        public decimal PricePerSession { get; set; }
        public int SessionDurationMinutes { get; set; }
        public bool IsPublished { get; set; }
        public bool WorksWithMilitary { get; set; }
        public bool HasTraumaTraining { get; set; }
        public bool OffersFreeSessionsForMilitary { get; set; }
        public int DiscountForAffected { get; set; }
        public ICollection<WorkingHourDto> WorkingHours { get; set; } = new List<WorkingHourDto>();
    }

    public class WorkingHourDto
    {
        public int DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }
}
