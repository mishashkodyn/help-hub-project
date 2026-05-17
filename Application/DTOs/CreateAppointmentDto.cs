using System;

namespace Application.DTOs
{
    public class CreateAppointmentDto
    {
        public Guid PsychologistId { get; set; }

        public DateTime StartTimeUtc { get; set; }

        public string? ClientNotes { get; set; }
    }
}
