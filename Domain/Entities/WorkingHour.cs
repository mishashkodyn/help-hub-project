using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entities
{
    public class WorkingHour
    {
        public Guid Id { get; set; }

        public Guid PsychologistId { get; set; }
        public Psychologist Psychologist { get; set; } = null!;

        public DayOfWeek DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }
}
