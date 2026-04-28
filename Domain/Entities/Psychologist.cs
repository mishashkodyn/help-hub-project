namespace Domain.Entities
{
    public class Psychologist
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Bio { get; set; } = string.Empty;
        public string VideoGreetingUrl { get; set; } = string.Empty;
        public decimal PricePerSession { get; set; }
        public int SessionDurationMinutes { get; set; } = 50;
        public bool IsPublished { get; set; } = false;
        public string Education { get; set; } = string.Empty;
        public int ExperienceYears { get; set; }
        public string ContactPhone { get; set; } = string.Empty;
        public ApplicationUser User { get; set; }
        public bool WorksWithMilitary { get; set; }
        public bool HasTraumaTraining { get; set; }
        public bool OffersFreeSessionsForMilitary { get; set; }
        public int DiscountForAffected { get; set; }
        public ICollection<Specialization> Specializations { get; set; } = new List<Specialization>();
        public ICollection<WorkingHour> WorkingHours { get; set; } = new List<WorkingHour>();
        public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    }
}
