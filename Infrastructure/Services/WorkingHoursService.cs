using Application.DTOs;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Services
{
    public class WorkingHoursService : IWorkingHoursService
    {
        private readonly ApplicationDbContext _context;

        public WorkingHoursService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UpdateWorkingHoursDto> GetWorkingHoursAsync(Guid userId)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.WorkingHours)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var dto = new UpdateWorkingHoursDto();

            var groupedHours = psychologist.WorkingHours.GroupBy(wh => wh.DayOfWeek);

            foreach (var group in groupedHours)
            {
                var daySchedule = new DayScheduleDto
                {
                    DayOfWeek = group.Key,
                    Slots = group.Select(wh => new TimeSlotDto
                    {
                        StartTime = wh.StartTime,
                        EndTime = wh.EndTime
                    }).OrderBy(s => s.StartTime).ToList()
                };
                dto.Schedule.Add(daySchedule);
            }

            return dto;
        }

        public async Task UpdateWorkingHoursAsync(Guid userId, UpdateWorkingHoursDto dto)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.WorkingHours)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            _context.WorkingHours.RemoveRange(psychologist.WorkingHours);

            var newWorkingHours = new List<WorkingHour>();

            foreach (var day in dto.Schedule)
            {
                foreach (var slot in day.Slots)
                {
                    newWorkingHours.Add(new WorkingHour
                    {
                        PsychologistId = psychologist.Id,
                        DayOfWeek = day.DayOfWeek,
                        StartTime = slot.StartTime,
                        EndTime = slot.EndTime
                    });
                }
            }

            await _context.WorkingHours.AddRangeAsync(newWorkingHours);
            await _context.SaveChangesAsync();
        }
    }
}
