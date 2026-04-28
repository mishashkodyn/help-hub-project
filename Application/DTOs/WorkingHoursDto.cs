using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class UpdateWorkingHoursDto
    {
        public List<DayScheduleDto> Schedule { get; set; } = new();
    }

    public class DayScheduleDto
    {
        public DayOfWeek DayOfWeek { get; set; }
        public List<TimeSlotDto> Slots { get; set; } = new();
    }

    public class TimeSlotDto
    {
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }
}
