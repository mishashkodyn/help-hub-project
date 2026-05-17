namespace Application.DTOs
{
    public class PsychologistCatalogItemDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? ProfileImage { get; set; }

        public string Bio { get; set; } = string.Empty;
        public string VideoGreetingUrl { get; set; } = string.Empty;
        public decimal PricePerSession { get; set; }
        public int SessionDurationMinutes { get; set; }
        public int ExperienceYears { get; set; }

        public bool WorksWithMilitary { get; set; }
        public bool HasTraumaTraining { get; set; }
        public bool OffersFreeSessionsForMilitary { get; set; }
        public int DiscountForAffected { get; set; }

        public List<SpecializationDto> Specializations { get; set; } = new();
    }

    public class PsychologistCatalogPageDto
    {
        public List<PsychologistCatalogItemDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
    }

    public class PsychologistCatalogFilterDto
    {
        public string? Search { get; set; }
        public List<Guid>? SpecializationIds { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int? MinExperience { get; set; }
        public bool? WorksWithMilitary { get; set; }
        public bool? HasTraumaTraining { get; set; }
        public bool? OffersFreeSessionsForMilitary { get; set; }
        public string? Sort { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 12;
    }
}
