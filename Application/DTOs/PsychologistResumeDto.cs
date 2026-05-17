using System.ComponentModel.DataAnnotations;

namespace Application.DTOs
{
    public class PsychologistResumeDto
    {
        public Guid Id { get; set; }
        public string Bio { get; set; } = string.Empty;
        public string VideoGreetingUrl { get; set; } = string.Empty;
        public decimal PricePerSession { get; set; }
        public int SessionDurationMinutes { get; set; }
        public string Education { get; set; } = string.Empty;
        public int ExperienceYears { get; set; }
        public string ContactPhone { get; set; } = string.Empty;
        public bool WorksWithMilitary { get; set; }
        public bool HasTraumaTraining { get; set; }
        public bool OffersFreeSessionsForMilitary { get; set; }
        public int DiscountForAffected { get; set; }
        public bool IsPublished { get; set; }
        public List<SpecializationDto> Specializations { get; set; } = new();
    }

    public class UpdatePsychologistResumeDto
    {
        [Required, MaxLength(4000)]
        public string Bio { get; set; } = string.Empty;

        [MaxLength(500)]
        public string VideoGreetingUrl { get; set; } = string.Empty;

        [Range(0, 1_000_000)]
        public decimal PricePerSession { get; set; }

        [Range(15, 240)]
        public int SessionDurationMinutes { get; set; }

        [Required, MaxLength(500)]
        public string Education { get; set; } = string.Empty;

        [Range(0, 80)]
        public int ExperienceYears { get; set; }

        [Required, MaxLength(50)]
        public string ContactPhone { get; set; } = string.Empty;

        public bool WorksWithMilitary { get; set; }
        public bool HasTraumaTraining { get; set; }
        public bool OffersFreeSessionsForMilitary { get; set; }

        [Range(0, 100)]
        public int DiscountForAffected { get; set; }

        public bool IsPublished { get; set; }

        public List<Guid> SpecializationIds { get; set; } = new();
    }
}
