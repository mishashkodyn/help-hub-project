using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entities
{
    public class Appointment
    {
        public Guid Id { get; set; }
        public Guid PsychologistId { get; set; }
        public Psychologist Psychologist { get; set; } = null!;
        public Guid ClientId { get; set; }
        public ApplicationUser Client { get; set; } = null!;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }

        public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;

        public decimal Price { get; set; }
        public string? MeetingLink { get; set; }
        public string? ClientNotes { get; set; }
    }

    public enum AppointmentStatus
    {
        Scheduled = 0,
        Completed = 1,
        Cancelled = 2,
        NoShow = 3
    }
}
