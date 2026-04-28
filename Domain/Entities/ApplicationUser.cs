using Microsoft.AspNetCore.Identity;

namespace Domain.Entities
{
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? ProfileImage { get; set; }
        public Gender Gender { get; set; } = Gender.Male;
        public string PreferredAiProvider { get; set; } = "Groq";
        public Guid? RefreshToken { get; set; }
        public DateTime RefreshTokenExpiryTime { get; set; }
        public UserCategory UserCategory { get; set; } = UserCategory.Civilian;
        public Psychologist? Psychologist { get; set; }
        public ICollection<Appointment> ClientAppointments { get; set; } = new List<Appointment>();
    }

    public enum UserCategory
    {
        Civilian = 0,
        Military = 1,
        Veteran = 2,
        IDP = 3
    }

    public enum Gender
    {
        Male,
        Female
    }
}
