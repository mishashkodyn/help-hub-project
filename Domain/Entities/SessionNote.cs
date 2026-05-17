namespace Domain.Entities
{
    /// <summary>
    /// Private psychologist note attached to an appointment.
    /// One note per appointment per psychologist.
    /// </summary>
    public class SessionNote
    {
        public Guid Id { get; set; }
        public Guid AppointmentId { get; set; }
        public Appointment Appointment { get; set; } = null!;
        public Guid PsychologistUserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public DateTime UpdatedDate { get; set; } = DateTime.Now;
    }
}
