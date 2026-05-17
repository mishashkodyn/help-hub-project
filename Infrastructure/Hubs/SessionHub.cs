using System.Collections.Concurrent;
using Application.DTOs;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Hubs
{
    [Authorize]
    public class SessionHub(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        ILogger<SessionHub> logger) : Hub
    {
        // In-memory tracking of who is currently in the video room of each appointment.
        // appointmentId -> set of userIds.
        private static readonly ConcurrentDictionary<Guid, HashSet<Guid>> _videoParticipants = new();
        // userId -> set of appointmentIds they are currently in video for (needed for clean disconnect).
        private static readonly ConcurrentDictionary<Guid, HashSet<Guid>> _userVideoRooms = new();
        private static readonly object _lock = new();

        public override async Task OnConnectedAsync()
        {
            var httpContext = Context.GetHttpContext();
            var appointmentIdStr = httpContext?.Request.Query["appointmentId"].ToString();

            logger.LogInformation(
                "SessionHub OnConnectedAsync: user={UserId} appointmentId={AppointmentId} conn={ConnId}",
                Context.UserIdentifier, appointmentIdStr, Context.ConnectionId);

            if (Guid.TryParse(appointmentIdStr, out var appointmentId))
            {
                var userId = Guid.Parse(Context.UserIdentifier!);
                var appointment = await context.Appointments
                    .Include(a => a.Psychologist)
                    .FirstOrDefaultAsync(a => a.Id == appointmentId);

                if (appointment == null)
                {
                    logger.LogWarning("SessionHub: appointment {Id} not found", appointmentId);
                    await base.OnConnectedAsync();
                    return;
                }

                var isParticipant = appointment.ClientId == userId || appointment.Psychologist.UserId == userId;
                if (!isParticipant)
                {
                    logger.LogWarning("SessionHub: user {UserId} is not a participant of appointment {Id}", userId, appointmentId);
                    await base.OnConnectedAsync();
                    return;
                }

                await Groups.AddToGroupAsync(Context.ConnectionId, appointmentId.ToString());
                logger.LogInformation("SessionHub: user {UserId} joined group {Group}", userId, appointmentId);
            }
            else
            {
                logger.LogWarning("SessionHub: no appointmentId in query string");
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (Guid.TryParse(Context.UserIdentifier, out var userId)
                && _userVideoRooms.TryRemove(userId, out var rooms))
            {
                foreach (var appointmentId in rooms)
                {
                    RemoveVideoParticipant(appointmentId, userId);
                    await Clients.Group(appointmentId.ToString())
                        .SendAsync("VideoParticipantLeft", userId.ToString());
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ───────────── Chat ─────────────

        public async Task LoadHistory(Guid appointmentId)
        {
            if (!await IsParticipantAsync(appointmentId)) return;

            var messages = await context.SessionMessages
                .Include(m => m.Sender)
                .Where(m => m.AppointmentId == appointmentId)
                .OrderBy(m => m.CreatedDate)
                .Select(m => new SessionMessageDto
                {
                    Id = m.Id,
                    AppointmentId = m.AppointmentId,
                    SenderId = m.SenderId,
                    SenderName = m.Sender.Name ?? "",
                    Content = m.Content,
                    CreatedDate = m.CreatedDate
                })
                .ToListAsync();

            await Clients.Caller.SendAsync("ReceiveHistory", messages);
        }

        public async Task SendMessage(Guid appointmentId, string content)
        {
            try
            {
                var userId = Guid.Parse(Context.UserIdentifier!);
                logger.LogInformation("SessionHub SendMessage: user={UserId} appointment={Id}", userId, appointmentId);

                if (!await IsParticipantAsync(appointmentId))
                {
                    logger.LogWarning("SessionHub SendMessage: user {UserId} is not a participant of {Id}", userId, appointmentId);
                    throw new HubException("Not a participant of this session.");
                }

                var sender = await userManager.FindByIdAsync(userId.ToString());

                var message = new SessionMessage
                {
                    Id = Guid.NewGuid(),
                    AppointmentId = appointmentId,
                    SenderId = userId,
                    Content = content,
                    CreatedDate = DateTime.UtcNow
                };

                context.SessionMessages.Add(message);
                await context.SaveChangesAsync();

                var dto = new SessionMessageDto
                {
                    Id = message.Id,
                    AppointmentId = appointmentId,
                    SenderId = userId,
                    SenderName = sender?.Name ?? "",
                    Content = content,
                    CreatedDate = message.CreatedDate
                };

                await Clients.Group(appointmentId.ToString()).SendAsync("ReceiveMessage", dto);
                logger.LogInformation("SessionHub SendMessage: broadcast complete for {MsgId}", message.Id);
            }
            catch (Exception ex) when (!(ex is HubException))
            {
                var deepest = ex;
                while (deepest.InnerException != null) deepest = deepest.InnerException;
                logger.LogError(ex, "SessionHub SendMessage failed for appointment {Id}. Inner: {Inner}", appointmentId, deepest.Message);
                throw new HubException("Failed to send message: " + deepest.Message);
            }
        }

        // ───────────── Video presence ─────────────

        /// <summary>
        /// Caller joins the video room. Returns the list of OTHER userIds currently in the room.
        /// The caller uses that list to decide whether to wait or initiate the WebRTC offer.
        /// </summary>
        public async Task<List<string>> JoinVideo(Guid appointmentId)
        {
            var userId = Guid.Parse(Context.UserIdentifier!);
            if (!await IsParticipantAsync(appointmentId)) return new List<string>();

            List<string> existingOthers;
            lock (_lock)
            {
                if (!_videoParticipants.TryGetValue(appointmentId, out var set))
                {
                    set = new HashSet<Guid>();
                    _videoParticipants[appointmentId] = set;
                }

                existingOthers = set.Where(id => id != userId).Select(id => id.ToString()).ToList();
                set.Add(userId);

                if (!_userVideoRooms.TryGetValue(userId, out var rooms))
                {
                    rooms = new HashSet<Guid>();
                    _userVideoRooms[userId] = rooms;
                }
                rooms.Add(appointmentId);
            }

            // Broadcast my arrival to the room (excluding me, since I already know).
            await Clients.GroupExcept(appointmentId.ToString(), Context.ConnectionId)
                .SendAsync("VideoParticipantJoined", userId.ToString());

            return existingOthers;
        }

        public async Task LeaveVideo(Guid appointmentId)
        {
            var userId = Guid.Parse(Context.UserIdentifier!);
            RemoveVideoParticipant(appointmentId, userId);

            await Clients.GroupExcept(appointmentId.ToString(), Context.ConnectionId)
                .SendAsync("VideoParticipantLeft", userId.ToString());
        }

        // ───────────── Video signalling (relay) ─────────────

        public Task SendVideoOffer(Guid appointmentId, string offer) =>
            RelayToOthers(appointmentId, "ReceiveVideoOffer", offer);

        public Task SendVideoAnswer(Guid appointmentId, string answer) =>
            RelayToOthers(appointmentId, "ReceiveVideoAnswer", answer);

        public Task SendVideoIceCandidate(Guid appointmentId, string candidate) =>
            RelayToOthers(appointmentId, "ReceiveVideoIceCandidate", candidate);

        // ───────────── Transcription relay ─────────────

        /// <summary>
        /// Relays a transcript chunk (interim or final) produced by the caller's Deepgram stream
        /// to every other participant of the same appointment.
        /// </summary>
        public async Task SendTranscript(Guid appointmentId, string text, bool isFinal)
        {
            if (!await IsParticipantAsync(appointmentId)) return;

            var senderId = Context.UserIdentifier!;
            await Clients.GroupExcept(appointmentId.ToString(), Context.ConnectionId)
                .SendAsync("ReceiveTranscript", senderId, text, isFinal, DateTime.UtcNow);
        }

        // ───────────── Helpers ─────────────

        private async Task<bool> IsParticipantAsync(Guid appointmentId)
        {
            var userId = Guid.Parse(Context.UserIdentifier!);
            var appointment = await context.Appointments
                .Include(a => a.Psychologist)
                .FirstOrDefaultAsync(a => a.Id == appointmentId);

            if (appointment == null) return false;
            return appointment.ClientId == userId || appointment.Psychologist.UserId == userId;
        }

        private Task RelayToOthers(Guid appointmentId, string eventName, string payload)
        {
            var senderId = Context.UserIdentifier!;
            return Clients.GroupExcept(appointmentId.ToString(), Context.ConnectionId)
                .SendAsync(eventName, senderId, payload);
        }

        private static void RemoveVideoParticipant(Guid appointmentId, Guid userId)
        {
            lock (_lock)
            {
                if (_videoParticipants.TryGetValue(appointmentId, out var set))
                {
                    set.Remove(userId);
                    if (set.Count == 0) _videoParticipants.TryRemove(appointmentId, out _);
                }

                if (_userVideoRooms.TryGetValue(userId, out var rooms))
                {
                    rooms.Remove(appointmentId);
                    if (rooms.Count == 0) _userVideoRooms.TryRemove(userId, out _);
                }
            }
        }
    }
}
