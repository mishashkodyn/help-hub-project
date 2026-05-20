using Application.DTOs;
using Application.DTOs.Notifications;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Services
{
    public class AppointmentService : IAppointmentService
    {
        private readonly ApplicationDbContext _context;
        private readonly INotificationService _notificationService;

        private static readonly TimeZoneInfo DisplayTimeZone = ResolveDisplayTimeZone();

        public AppointmentService(ApplicationDbContext context, INotificationService notificationService)
        {
            _context = context;
            _notificationService = notificationService;
        }

        private static TimeZoneInfo ResolveDisplayTimeZone()
        {
            // Cross-platform: try IANA first, then fall back to Windows ID.
            foreach (var id in new[] { "Europe/Kyiv", "Europe/Kiev", "FLE Standard Time" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.Utc;
        }

        private static string FormatLocal(DateTime utc)
        {
            var asUtc = DateTime.SpecifyKind(utc, DateTimeKind.Utc);
            var local = TimeZoneInfo.ConvertTimeFromUtc(asUtc, DisplayTimeZone);
            return local.ToString("dd MMM yyyy, HH:mm", CultureInfo.InvariantCulture);
        }

        public async Task<List<DateTime>> GetAvailableSlotsAsync(Guid psychologistId, DateTime localDate)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.WorkingHours)
                .FirstOrDefaultAsync(p => p.Id == psychologistId);

            if (psychologist == null) throw new Exception("Psychologist not found");

            var dayOfWeek = localDate.DayOfWeek;
            var workingHours = psychologist.WorkingHours.Where(w => w.DayOfWeek == dayOfWeek).ToList();

            if (!workingHours.Any()) return new List<DateTime>();

            var sessionDuration = TimeSpan.FromMinutes(psychologist.SessionDurationMinutes);
            var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(
                DateTime.SpecifyKind(localDate.Date, DateTimeKind.Unspecified), DisplayTimeZone);
            var dayEndUtc = dayStartUtc.AddDays(1);

            var bookedAppointments = await _context.Appointments
                .Where(a => a.PsychologistId == psychologistId
                         && a.StartTime < dayEndUtc && a.EndTime > dayStartUtc
                         && (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
                .ToListAsync();

            var nowUtc = DateTime.UtcNow;
            var availableSlots = new List<DateTime>();

            foreach (var block in workingHours)
            {
                // EndTime == 00:00 (or any value <= StartTime) is treated as end-of-day,
                // so a block like 09:00 → 00:00 means "until midnight".
                var blockEnd = block.EndTime <= block.StartTime
                    ? block.EndTime + TimeSpan.FromDays(1)
                    : block.EndTime;
                var currentSlotStart = block.StartTime;

                while (currentSlotStart.Add(sessionDuration) <= blockEnd)
                {
                    var currentSlotEnd = currentSlotStart.Add(sessionDuration);

                    var slotStartLocal = DateTime.SpecifyKind(localDate.Date.Add(currentSlotStart), DateTimeKind.Unspecified);
                    var slotEndLocal = DateTime.SpecifyKind(localDate.Date.Add(currentSlotEnd), DateTimeKind.Unspecified);
                    var slotStartUtc = TimeZoneInfo.ConvertTimeToUtc(slotStartLocal, DisplayTimeZone);
                    var slotEndUtc = TimeZoneInfo.ConvertTimeToUtc(slotEndLocal, DisplayTimeZone);

                    bool isOverlapping = bookedAppointments.Any(a =>
                        slotStartUtc < a.EndTime && slotEndUtc > a.StartTime);

                    bool isPast = slotStartUtc <= nowUtc;

                    if (!isOverlapping && !isPast)
                    {
                        availableSlots.Add(slotStartUtc);
                    }

                    currentSlotStart = currentSlotStart.Add(sessionDuration);
                }
            }

            return availableSlots;
        }

        public async Task CreateAppointmentAsync(Guid clientId, CreateAppointmentDto dto)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.Id == dto.PsychologistId);

            if (psychologist == null)
                throw new Exception("Psychologist not found.");

            var startUtc = DateTime.SpecifyKind(dto.StartTimeUtc, DateTimeKind.Utc);
            var endUtc = startUtc.AddMinutes(psychologist.SessionDurationMinutes);

            var isOverlapping = await _context.Appointments
                .AnyAsync(a => a.PsychologistId == dto.PsychologistId
                            && (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed)
                            && startUtc < a.EndTime && endUtc > a.StartTime);

            if (isOverlapping)
                throw new Exception("This time slot has already been booked. Please choose another time.");

            var appointment = new Appointment
            {
                PsychologistId = psychologist.Id,
                ClientId = clientId,
                StartTime = startUtc,
                EndTime = endUtc,
                Status = AppointmentStatus.Pending,
                Price = psychologist.PricePerSession,
                ClientNotes = dto.ClientNotes
            };

            await _context.Appointments.AddAsync(appointment);
            await _context.SaveChangesAsync();

            var client = await _context.Users.FirstOrDefaultAsync(u => u.Id == clientId);
            var clientName = client == null || string.IsNullOrWhiteSpace(client.Name)
                ? "A client"
                : $"{client.Name} {client.Surname}".Trim();

            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = psychologist.UserId,
                Title = "New Session Request",
                Message = $"{clientName} requested a session on {FormatLocal(appointment.StartTime)}.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task<List<AppointmentApplicationDto>> GetPsychologistApplicationsAsync(Guid userId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var appointments = await _context.Appointments
                .Include(a => a.Client)
                .Where(a => a.PsychologistId == psychologist.Id)
                .OrderByDescending(a => a.StartTime)
                .ToListAsync();

            return appointments.Select(a => new AppointmentApplicationDto
            {
                Id = a.Id,
                ClientName = string.IsNullOrWhiteSpace(a.Client.Name) ? "Unknown Client" : $"{a.Client.Name} {a.Client.Surname}".Trim(),
                ClientEmail = a.Client.Email ?? "No email",
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Status = a.Status.ToString(),
                Price = a.Price,
                ClientNotes = a.ClientNotes
            }).ToList();
        }

        public async Task ApproveAppointmentAsync(Guid userId, Guid appointmentId)
        {
            var appointment = await GetAppointmentForPsychologistAsync(userId, appointmentId);

            if (appointment.Status != AppointmentStatus.Pending)
                throw new Exception("Only pending appointments can be approved.");

            appointment.Status = AppointmentStatus.Confirmed;

            // Тут в майбутньому можна додати генерацію посилання на Google Meet / Zoom
            // appointment.MeetingLink = "https://meet.google.com/...";

            await _context.SaveChangesAsync();

            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ClientId,
                Title = "Session Confirmed",
                Message = $"Your session scheduled for {FormatLocal(appointment.StartTime)} has been confirmed by the psychologist.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task DeclineAppointmentAsync(Guid userId, Guid appointmentId)
        {
            var appointment = await GetAppointmentForPsychologistAsync(userId, appointmentId);

            if (appointment.Status != AppointmentStatus.Pending)
                throw new Exception("Only pending appointments can be declined.");

            appointment.Status = AppointmentStatus.Cancelled;

            await _context.SaveChangesAsync();

            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ClientId,
                Title = "Session Declined",
                Message = $"Unfortunately, your session scheduled for {FormatLocal(appointment.StartTime)} was declined by the psychologist.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task<List<ClientSessionDto>> GetClientSessionsAsync(Guid clientId)
        {
            var now = DateTime.UtcNow;

            var appointments = await _context.Appointments
                .Include(a => a.Psychologist).ThenInclude(p => p.User)
                .Where(a => a.ClientId == clientId)
                .OrderByDescending(a => a.StartTime)
                .ToListAsync();

            return appointments.Select(a =>
            {
                var isAccessible = a.Status == AppointmentStatus.Confirmed
                    && now >= a.StartTime.AddMinutes(-5)
                    && now <= a.EndTime;

                return new ClientSessionDto
                {
                    Id = a.Id,
                    PsychologistName = $"{a.Psychologist.User.Name} {a.Psychologist.User.Surname}".Trim(),
                    PsychologistUserId = a.Psychologist.UserId.ToString(),
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    Status = a.Status.ToString(),
                    Price = a.Price,
                    ClientNotes = a.ClientNotes,
                    IsAccessible = isAccessible
                };
            }).ToList();
        }

        public async Task<List<ClientSessionDto>> GetPsychologistSessionsAsync(Guid psychologistUserId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == psychologistUserId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var now = DateTime.UtcNow;

            var appointments = await _context.Appointments
                .Include(a => a.Client)
                .Where(a => a.PsychologistId == psychologist.Id)
                .OrderByDescending(a => a.StartTime)
                .ToListAsync();

            return appointments.Select(a =>
            {
                var isAccessible = a.Status == AppointmentStatus.Confirmed
                    && now >= a.StartTime.AddMinutes(-5)
                    && now <= a.EndTime;

                var clientName = string.IsNullOrWhiteSpace(a.Client.Name)
                    ? "Unknown Client"
                    : $"{a.Client.Name} {a.Client.Surname}".Trim();

                return new ClientSessionDto
                {
                    Id = a.Id,
                    // Reuse the same DTO — for psychologists this carries the client's name.
                    PsychologistName = clientName,
                    PsychologistUserId = a.ClientId.ToString(),
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    Status = a.Status.ToString(),
                    Price = a.Price,
                    ClientNotes = a.ClientNotes,
                    IsAccessible = isAccessible
                };
            }).ToList();
        }

        public async Task<SessionInfoDto> GetSessionInfoAsync(Guid appointmentId, Guid requestingUserId)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Psychologist).ThenInclude(p => p.User)
                .Include(a => a.Client)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null)
                throw new Exception("Session not found.");

            var isPsychologist = appointment.Psychologist.UserId == requestingUserId;
            var isClient = appointment.ClientId == requestingUserId;

            if (!isPsychologist && !isClient)
                throw new UnauthorizedAccessException("You are not a participant in this session.");

            var now = DateTime.UtcNow;
            var isAccessible = appointment.Status == AppointmentStatus.Confirmed
                && now >= appointment.StartTime.AddMinutes(-5)
                && now <= appointment.EndTime;

            return new SessionInfoDto
            {
                Id = appointment.Id,
                PsychologistName = $"{appointment.Psychologist.User.Name} {appointment.Psychologist.User.Surname}".Trim(),
                PsychologistUserId = appointment.Psychologist.UserId.ToString(),
                ClientName = $"{appointment.Client.Name} {appointment.Client.Surname}".Trim(),
                ClientUserId = appointment.ClientId.ToString(),
                StartTime = appointment.StartTime,
                EndTime = appointment.EndTime,
                Status = appointment.Status.ToString(),
                IsAccessible = isAccessible
            };
        }

        public async Task<List<PastSessionDto>> GetPsychologistPastSessionsAsync(Guid psychologistUserId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == psychologistUserId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var now = DateTime.UtcNow;

            var appointments = await _context.Appointments
                .Include(a => a.Client)
                .Where(a => a.PsychologistId == psychologist.Id && a.EndTime < now)
                .OrderByDescending(a => a.StartTime)
                .ToListAsync();

            var appointmentIds = appointments.Select(a => a.Id).ToList();
            var notesLookup = await _context.SessionNotes
                .Where(n => appointmentIds.Contains(n.AppointmentId) && n.PsychologistUserId == psychologistUserId)
                .Select(n => n.AppointmentId)
                .ToListAsync();

            var notesSet = notesLookup.ToHashSet();

            return appointments.Select(a => new PastSessionDto
            {
                Id = a.Id,
                ClientName = string.IsNullOrWhiteSpace(a.Client.Name)
                    ? "Unknown Client"
                    : $"{a.Client.Name} {a.Client.Surname}".Trim(),
                ClientUserId = a.ClientId,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                Status = a.Status.ToString(),
                Price = a.Price,
                ClientNotes = a.ClientNotes,
                HasPsychologistNote = notesSet.Contains(a.Id)
            }).ToList();
        }

        public async Task<SessionNoteDto?> GetSessionNoteAsync(Guid appointmentId, Guid psychologistUserId)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);

            var note = await _context.SessionNotes
                .FirstOrDefaultAsync(n => n.AppointmentId == appointmentId && n.PsychologistUserId == psychologistUserId);

            if (note == null) return null;

            return new SessionNoteDto
            {
                Id = note.Id,
                AppointmentId = note.AppointmentId,
                Content = note.Content,
                CreatedDate = note.CreatedDate,
                UpdatedDate = note.UpdatedDate
            };
        }

        public async Task<SessionNoteDto> UpsertSessionNoteAsync(Guid appointmentId, Guid psychologistUserId, string content)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);

            var note = await _context.SessionNotes
                .FirstOrDefaultAsync(n => n.AppointmentId == appointmentId && n.PsychologistUserId == psychologistUserId);

            var now = DateTime.UtcNow;

            if (note == null)
            {
                note = new SessionNote
                {
                    Id = Guid.NewGuid(),
                    AppointmentId = appointmentId,
                    PsychologistUserId = psychologistUserId,
                    Content = content ?? string.Empty,
                    CreatedDate = now,
                    UpdatedDate = now
                };
                _context.SessionNotes.Add(note);
            }
            else
            {
                note.Content = content ?? string.Empty;
                note.UpdatedDate = now;
            }

            await _context.SaveChangesAsync();

            return new SessionNoteDto
            {
                Id = note.Id,
                AppointmentId = note.AppointmentId,
                Content = note.Content,
                CreatedDate = note.CreatedDate,
                UpdatedDate = note.UpdatedDate
            };
        }

        private async Task EnsurePsychologistOwnsAppointmentAsync(Guid psychologistUserId, Guid appointmentId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == psychologistUserId);
            if (psychologist == null)
                throw new UnauthorizedAccessException("Psychologist profile not found.");

            var owns = await _context.Appointments
                .AnyAsync(a => a.Id == appointmentId && a.PsychologistId == psychologist.Id);
            if (!owns)
                throw new UnauthorizedAccessException("This appointment does not belong to you.");
        }

        public async Task<List<SessionMessageDto>> GetSessionMessagesAsync(Guid appointmentId, Guid psychologistUserId)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);

            return await _context.SessionMessages
                .Include(m => m.Sender)
                .Where(m => m.AppointmentId == appointmentId)
                .OrderBy(m => m.CreatedDate)
                .Select(m => new SessionMessageDto
                {
                    Id = m.Id,
                    AppointmentId = m.AppointmentId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender.Name ?? string.Empty,
                    Content = m.Content,
                    CreatedDate = m.CreatedDate
                })
                .ToListAsync();
        }

        public async Task<List<SessionTranscriptDto>> GetSessionTranscriptsAsync(Guid appointmentId, Guid psychologistUserId)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);

            return await _context.SessionTranscripts
                .Include(t => t.Sender)
                .Where(t => t.AppointmentId == appointmentId)
                .OrderBy(t => t.Timestamp)
                .Select(t => new SessionTranscriptDto
                {
                    Id = t.Id,
                    AppointmentId = t.AppointmentId,
                    SenderId = t.SenderId,
                    SenderName = t.Sender.Name ?? string.Empty,
                    Text = t.Text,
                    Timestamp = t.Timestamp
                })
                .ToListAsync();
        }

        public async Task<List<SessionAiMessageDto>> GetSessionAiMessagesAsync(Guid appointmentId, Guid psychologistUserId)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);

            return await _context.SessionAiMessages
                .Where(a => a.AppointmentId == appointmentId && a.PsychologistUserId == psychologistUserId)
                .OrderBy(a => a.Timestamp)
                .Select(a => new SessionAiMessageDto
                {
                    Id = a.Id,
                    AppointmentId = a.AppointmentId,
                    Role = a.Role,
                    Content = a.Content,
                    Timestamp = a.Timestamp
                })
                .ToListAsync();
        }

        public async Task<List<SessionAiMessageDto>> SaveSessionAiMessagesAsync(Guid appointmentId, Guid psychologistUserId, List<SaveAiMessageDto> messages)
        {
            await EnsurePsychologistOwnsAppointmentAsync(psychologistUserId, appointmentId);
            if (messages == null || messages.Count == 0) return new List<SessionAiMessageDto>();

            var now = DateTime.UtcNow;
            var entities = messages.Select(m => new SessionAiMessage
            {
                Id = Guid.NewGuid(),
                AppointmentId = appointmentId,
                PsychologistUserId = psychologistUserId,
                Role = string.IsNullOrWhiteSpace(m.Role) ? "user" : m.Role,
                Content = m.Content ?? string.Empty,
                Timestamp = m.Timestamp.HasValue
                    ? DateTime.SpecifyKind(m.Timestamp.Value, DateTimeKind.Utc)
                    : now
            }).ToList();

            _context.SessionAiMessages.AddRange(entities);
            await _context.SaveChangesAsync();

            return entities.Select(a => new SessionAiMessageDto
            {
                Id = a.Id,
                AppointmentId = a.AppointmentId,
                Role = a.Role,
                Content = a.Content,
                Timestamp = a.Timestamp
            }).ToList();
        }

        private async Task<Appointment> GetAppointmentForPsychologistAsync(Guid userId, Guid appointmentId)
        {
            var psychologist = await _context.Psychologists.FirstOrDefaultAsync(p => p.UserId == userId);
            if (psychologist == null) throw new Exception("Psychologist profile not found.");

            var appointment = await _context.Appointments.FirstOrDefaultAsync(a => a.Id == appointmentId);
            if (appointment == null) throw new Exception("Appointment not found.");

            if (appointment.PsychologistId != psychologist.Id)
                throw new UnauthorizedAccessException("You are not authorized to modify this appointment.");

            return appointment;
        }
    }


}
