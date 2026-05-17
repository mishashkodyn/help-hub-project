namespace Domain.Entities
{
    public class SessionMessage
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Appointment Appointment { get; set; } = null!;
        public Guid SenderId { get; set; }
        public ApplicationUser Sender { get; set; } = null!;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
