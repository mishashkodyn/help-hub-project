using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class SessionReminderService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<NotificationHub> _notificationHub;
        private readonly ILogger<SessionReminderService> _logger;

        private readonly HashSet<Guid> _notified = new();

        public SessionReminderService(
            IServiceScopeFactory scopeFactory,
            IHubContext<NotificationHub> notificationHub,
            ILogger<SessionReminderService> logger)
        {
            _scopeFactory = scopeFactory;
            _notificationHub = notificationHub;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndNotifyAsync();
                    await CompleteEndedSessionsAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in SessionReminderService");
                }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        // ── 5-min reminder ────────────────────────────────────────────────────
        private async Task CheckAndNotifyAsync()
        {
            var now = DateTime.Now;
            var windowStart = now.AddMinutes(4);
            var windowEnd = now.AddMinutes(6);

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var upcoming = await context.Appointments
                .Include(a => a.Psychologist)
                .Where(a =>
                    a.Status == AppointmentStatus.Confirmed &&
                    a.StartTime >= windowStart &&
                    a.StartTime <= windowEnd)
                .ToListAsync();

            foreach (var appt in upcoming)
            {
                if (_notified.Contains(appt.Id)) continue;

                var clientUserId = appt.ClientId.ToString();
                var psychUserId = appt.Psychologist.UserId.ToString();

                await _notificationHub.Clients
                    .User(clientUserId)
                    .SendAsync("SessionStartingSoon", appt.Id.ToString());

                await _notificationHub.Clients
                    .User(psychUserId)
                    .SendAsync("SessionStartingSoon", appt.Id.ToString());

                _notified.Add(appt.Id);

                _logger.LogInformation(
                    "Sent SessionStartingSoon for appointment {Id} (starts {Start})",
                    appt.Id, appt.StartTime);
            }

            // Prune old IDs from the in-memory set
            var past = await context.Appointments
                .Where(a => _notified.Contains(a.Id) && a.EndTime < now.AddHours(-1))
                .Select(a => a.Id)
                .ToListAsync();

            foreach (var id in past) _notified.Remove(id);
        }

        // ── Auto-complete ended sessions ──────────────────────────────────────
        private async Task CompleteEndedSessionsAsync()
        {
            var now = DateTime.Now;

            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var ended = await context.Appointments
                .Include(a => a.Psychologist)
                .Where(a =>
                    a.Status == AppointmentStatus.Confirmed &&
                    a.EndTime < now)
                .ToListAsync();

            if (ended.Count == 0) return;

            foreach (var appt in ended)
            {
                appt.Status = AppointmentStatus.Completed;
            }

            await context.SaveChangesAsync();

            // Notify both sides so their lists update in real-time
            foreach (var appt in ended)
            {
                var clientUserId = appt.ClientId.ToString();
                var psychUserId = appt.Psychologist.UserId.ToString();

                await _notificationHub.Clients
                    .User(clientUserId)
                    .SendAsync("SessionCompleted", appt.Id.ToString());

                await _notificationHub.Clients
                    .User(psychUserId)
                    .SendAsync("SessionCompleted", appt.Id.ToString());

                _logger.LogInformation(
                    "Marked appointment {Id} as Completed and notified participants", appt.Id);
            }
        }
    }
}
