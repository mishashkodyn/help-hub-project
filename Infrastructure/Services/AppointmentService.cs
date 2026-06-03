using Application.DTOs;
using Application.DTOs.Notifications;
using Domain.Entities;
using Microsoft.AspNetCore.Identity;
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

        public async Task<BookingResultDto> CreateAppointmentAsync(Guid clientId, CreateAppointmentDto dto)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.User)
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

            var client = await _context.Users.FirstOrDefaultAsync(u => u.Id == clientId);
            var clientName = client == null || string.IsNullOrWhiteSpace(client.Name)
                ? "A client"
                : $"{client.Name} {client.Surname}".Trim();

            // Військові та ветерани — безкоштовно, підтверджуємо одразу
            bool isFree = client != null && (client.UserCategory == UserCategory.Military || client.UserCategory == UserCategory.Veteran);

            var appointment = new Appointment
            {
                PsychologistId = psychologist.Id,
                ClientId = clientId,
                StartTime = startUtc,
                EndTime = endUtc,
                Status = isFree ? AppointmentStatus.Confirmed : AppointmentStatus.Pending,
                PaymentStatus = isFree ? PaymentStatus.Free : PaymentStatus.AwaitingPayment,
                Price = isFree ? 0 : psychologist.PricePerSession,
                ClientNotes = dto.ClientNotes
            };

            await _context.Appointments.AddAsync(appointment);
            await _context.SaveChangesAsync();

            if (isFree)
            {
                // Військовий/ветеран — оплата не потрібна, заявка одразу йде психологу
                await _notificationService.SendNotificationAsync(new CreateNotificationDto
                {
                    UserId = psychologist.UserId,
                    Title = "New Free Session (Military/Veteran)",
                    Message = $"{clientName} booked a free session on {FormatLocal(appointment.StartTime)}. Payment: Free (military/veteran status).",
                    Type = NotificationType.Application,
                    RelatedEntityId = appointment.Id
                });
            }
            else
            {
                // Цивільний — заявка йде СПОЧАТКУ адміну (психолог не отримує сповіщення)
                var adminUsers = await _context.UserRoles
                    .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                    .Where(x => x.Name == ApplicationRole.ROLE_SUPERADMIN || x.Name == ApplicationRole.ROLE_ADMIN)
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToListAsync();

                foreach (var adminId in adminUsers)
                {
                    await _notificationService.SendNotificationAsync(new CreateNotificationDto
                    {
                        UserId = adminId,
                        Title = "Payment Expected",
                        Message = $"{clientName} booked a session for {FormatLocal(appointment.StartTime)} (₴{appointment.Price}). Please confirm payment when received.",
                        Type = NotificationType.Application,
                        RelatedEntityId = appointment.Id
                    });
                }
            }

            // Отримуємо картку платформи (адмін)
            var platformCardNumber = await GetPlatformCardNumberAsync();

            var psychologistName = $"{psychologist.User?.Name} {psychologist.User?.Surname}".Trim();

            return new BookingResultDto
            {
                AppointmentId = appointment.Id,
                IsFree = isFree,
                Amount = appointment.Price,
                PlatformCardNumber = platformCardNumber,
                PaymentStatus = appointment.PaymentStatus.ToString(),
                AppointmentStatus = appointment.Status.ToString(),
                StartTime = appointment.StartTime,
                PsychologistName = psychologistName
            };
        }

        private async Task<string> GetPlatformCardNumberAsync()
        {
            // Знаходимо першого суперадміна і беремо його картку
            var adminUserId = await _context.UserRoles
                .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                .Where(x => x.Name == ApplicationRole.ROLE_SUPERADMIN)
                .Select(x => x.UserId)
                .FirstOrDefaultAsync();

            if (adminUserId == default) return string.Empty;

            var admin = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminUserId);
            return admin?.CardNumber ?? string.Empty;
        }

        public async Task<List<AppointmentApplicationDto>> GetPsychologistApplicationsAsync(Guid userId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var appointments = await _context.Appointments
                .Include(a => a.Client)
                .Where(a => a.PsychologistId == psychologist.Id
                         // Психолог НЕ бачить заявки, які ще очікують підтвердження оплати від адміна.
                         // Він бачить тільки після ConfirmPayment (Confirmed/Free/ReleasedToPsychologist).
                         && a.PaymentStatus != PaymentStatus.AwaitingPayment)
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
                ClientNotes = a.ClientNotes,
                PaymentStatus = a.PaymentStatus.ToString()
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
                    IsAccessible = isAccessible,
                    PaymentStatus = a.PaymentStatus.ToString()
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
                .Where(a => a.PsychologistId == psychologist.Id
                         // Не показуємо психологу сесії, які ще не пройшли підтвердження оплати адміном
                         && a.PaymentStatus != PaymentStatus.AwaitingPayment)
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
                    IsAccessible = isAccessible,
                    PaymentStatus = a.PaymentStatus.ToString()
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

        public async Task CancelByClientAsync(Guid clientId, Guid appointmentId)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Psychologist)
                .Include(a => a.Client)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null)
                throw new Exception("Appointment not found.");

            if (appointment.ClientId != clientId)
                throw new UnauthorizedAccessException("You can cancel only your own appointments.");

            if (appointment.Status == AppointmentStatus.Cancelled)
                throw new Exception("Appointment is already cancelled.");

            if (appointment.Status == AppointmentStatus.Completed)
                throw new Exception("Cannot cancel a completed session.");

            appointment.Status = AppointmentStatus.Cancelled;
            await _context.SaveChangesAsync();

            var clientName = $"{appointment.Client?.Name} {appointment.Client?.Surname}".Trim();

            // Якщо психолог уже бачив заявку (адмін підтвердив оплату або це безкоштовна сесія) —
            // сповіщаємо психолога. Інакше — він і не знав про неї.
            if (appointment.PaymentStatus != PaymentStatus.AwaitingPayment)
            {
                await _notificationService.SendNotificationAsync(new CreateNotificationDto
                {
                    UserId = appointment.Psychologist.UserId,
                    Title = "Session Cancelled",
                    Message = $"{clientName} cancelled the session scheduled for {FormatLocal(appointment.StartTime)}.",
                    Type = NotificationType.Application,
                    RelatedEntityId = appointment.Id
                });
            }

            // Якщо оплата ще не пройшла — повідомляємо адміна, щоб прибрав із черги
            if (appointment.PaymentStatus == PaymentStatus.AwaitingPayment)
            {
                var adminUsers = await _context.UserRoles
                    .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                    .Where(x => x.Name == ApplicationRole.ROLE_SUPERADMIN || x.Name == ApplicationRole.ROLE_ADMIN)
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToListAsync();

                foreach (var adminId in adminUsers)
                {
                    await _notificationService.SendNotificationAsync(new CreateNotificationDto
                    {
                        UserId = adminId,
                        Title = "Booking Cancelled",
                        Message = $"{clientName} cancelled the booking for {FormatLocal(appointment.StartTime)} before paying. You can remove it from the payment queue.",
                        Type = NotificationType.Application,
                        RelatedEntityId = appointment.Id
                    });
                }
            }
        }

        // ── Payment flow ──────────────────────────────────────────────────────

        public async Task<List<PendingPaymentDto>> GetPendingPaymentsAsync()
        {
            return await _context.Appointments
                .Include(a => a.Client)
                .Include(a => a.Psychologist).ThenInclude(p => p.User)
                .Where(a => a.PaymentStatus == PaymentStatus.AwaitingPayment
                         && a.Status != AppointmentStatus.Cancelled)
                .OrderBy(a => a.StartTime)
                .Select(a => new PendingPaymentDto
                {
                    AppointmentId = a.Id,
                    ClientUserId = a.ClientId,
                    ClientFirstName = a.Client.Name,
                    ClientLastName = a.Client.Surname,
                    ClientUserName = a.Client.UserName,
                    ClientProfileImage = a.Client.ProfileImage,
                    ClientName = (a.Client.Name + " " + a.Client.Surname).Trim(),
                    ClientEmail = a.Client.Email ?? string.Empty,
                    PsychologistName = (a.Psychologist.User.Name + " " + a.Psychologist.User.Surname).Trim(),
                    Amount = a.Price,
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    PaymentStatus = a.PaymentStatus.ToString(),
                    AppointmentStatus = a.Status.ToString(),
                    ClientNotes = a.ClientNotes
                })
                .ToListAsync();
        }

        public async Task ConfirmPaymentAsync(Guid appointmentId)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Psychologist)
                .Include(a => a.Client)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null)
                throw new Exception("Appointment not found.");

            if (appointment.PaymentStatus != PaymentStatus.AwaitingPayment)
                throw new Exception("This appointment is not awaiting payment confirmation.");

            // Оплату підтверджено, але заявка залишається Pending —
            // психолог сам її прийме/відхилить (звичайний потік).
            appointment.PaymentStatus = PaymentStatus.Confirmed;

            await _context.SaveChangesAsync();

            var clientName = $"{appointment.Client?.Name} {appointment.Client?.Surname}".Trim();

            // ТЕПЕР заявка йде психологу — він її розгляне у звичайному потоці
            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.Psychologist.UserId,
                Title = "New Session Request",
                Message = $"{clientName} booked a session on {FormatLocal(appointment.StartTime)}. Payment confirmed by admin (₴{appointment.Price}). Please approve or decline.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });

            // Клієнту — оплата прийнята, очікуємо рішення психолога
            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ClientId,
                Title = "Payment Confirmed ✓",
                Message = $"Your payment of ₴{appointment.Price} has been confirmed. The request was forwarded to the psychologist for approval.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task RejectPaymentAsync(Guid appointmentId, string? reason)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Client)
                .Include(a => a.Psychologist)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null)
                throw new Exception("Appointment not found.");

            if (appointment.PaymentStatus != PaymentStatus.AwaitingPayment)
                throw new Exception("Only payments awaiting confirmation can be rejected.");

            appointment.Status = AppointmentStatus.Cancelled;
            await _context.SaveChangesAsync();

            var reasonText = string.IsNullOrWhiteSpace(reason)
                ? "Payment was not received."
                : reason.Trim();

            // Сповіщення клієнту
            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.ClientId,
                Title = "Booking Cancelled by Admin",
                Message = $"Your booking on {FormatLocal(appointment.StartTime)} was cancelled. Reason: {reasonText}",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task<List<PendingPaymentDto>> GetCompletedUnpaidSessionsAsync()
        {
            return await _context.Appointments
                .Include(a => a.Client)
                .Include(a => a.Psychologist).ThenInclude(p => p.User)
                .Where(a => a.Status == AppointmentStatus.Completed
                         && a.PaymentStatus == PaymentStatus.Confirmed)
                .OrderByDescending(a => a.EndTime)
                .Select(a => new PendingPaymentDto
                {
                    AppointmentId = a.Id,
                    ClientUserId = a.ClientId,
                    ClientFirstName = a.Client.Name,
                    ClientLastName = a.Client.Surname,
                    ClientUserName = a.Client.UserName,
                    ClientProfileImage = a.Client.ProfileImage,
                    ClientName = (a.Client.Name + " " + a.Client.Surname).Trim(),
                    ClientEmail = a.Client.Email ?? string.Empty,
                    PsychologistName = (a.Psychologist.User.Name + " " + a.Psychologist.User.Surname).Trim(),
                    Amount = a.Price,
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    PaymentStatus = a.PaymentStatus.ToString(),
                    AppointmentStatus = a.Status.ToString()
                })
                .ToListAsync();
        }

        public async Task ReleasePaymentToPsychologistAsync(Guid appointmentId)
        {
            var appointment = await _context.Appointments
                .Include(a => a.Psychologist)
                .Include(a => a.Client)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null)
                throw new Exception("Appointment not found.");

            if (appointment.Status != AppointmentStatus.Completed)
                throw new Exception("Can only release payment for completed sessions.");

            if (appointment.PaymentStatus != PaymentStatus.Confirmed)
                throw new Exception("Payment must be confirmed before releasing to psychologist.");

            appointment.PaymentStatus = PaymentStatus.ReleasedToPsychologist;
            appointment.Psychologist.Balance += appointment.Price;

            await _context.SaveChangesAsync();

            // Сповіщення психологу
            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = appointment.Psychologist.UserId,
                Title = "Earnings Added 💰",
                Message = $"₴{appointment.Price} for the session on {FormatLocal(appointment.StartTime)} has been added to your balance.",
                Type = NotificationType.Application,
                RelatedEntityId = appointment.Id
            });
        }

        public async Task<PsychologistBalanceDto> GetPsychologistBalanceAsync(Guid psychologistUserId)
        {
            var psychologist = await _context.Psychologists
                .FirstOrDefaultAsync(p => p.UserId == psychologistUserId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            var recentEarnings = await _context.Appointments
                .Include(a => a.Client)
                .Where(a => a.PsychologistId == psychologist.Id
                         && (a.PaymentStatus == PaymentStatus.Confirmed
                          || a.PaymentStatus == PaymentStatus.ReleasedToPsychologist
                          || a.PaymentStatus == PaymentStatus.Free)
                         && a.Status == AppointmentStatus.Completed)
                .OrderByDescending(a => a.EndTime)
                .Take(20)
                .Select(a => new EarningItemDto
                {
                    AppointmentId = a.Id,
                    ClientName = (a.Client.Name + " " + a.Client.Surname).Trim(),
                    Amount = a.Price,
                    SessionDate = a.StartTime,
                    PaymentStatus = a.PaymentStatus.ToString()
                })
                .ToListAsync();

            return new PsychologistBalanceDto
            {
                Balance = psychologist.Balance,
                RecentEarnings = recentEarnings
            };
        }
    }


}
