namespace Domain.Entities
{
    public class SessionTranscript
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Appointment Appointment { get; set; } = null!;
        public Guid SenderId { get; set; }
        public ApplicationUser Sender { get; set; } = null!;
        public string Text { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
