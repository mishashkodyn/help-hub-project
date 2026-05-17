using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CreateAppointmentDto
    {
        public Guid PsychologistId { get; set; }

        public string Date { get; set; } = string.Empty;

        public string StartTime { get; set; } = string.Empty;

        public string? ClientNotes { get; set; }
    }
}
