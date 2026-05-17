using Application.DTOs.Message;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace Infrastructure.Hubs
{
    [Authorize]
    public class ChatHub(UserManager<ApplicationUser> userManager, ApplicationDbContext context) : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var httpContext = Context.GetHttpContext();
            var contactIdStr = httpContext?.Request.Query["contactId"].ToString();

            if (Guid.TryParse(contactIdStr, out Guid contactId))
            {
                await LoadMessages(contactId, 1);
            }

            await base.OnConnectedAsync();
        }

        public async Task ClearChatHistory(Guid contactId)
        {
            var myUserIdString = Context.UserIdentifier;
            if (string.IsNullOrEmpty(myUserIdString) || !Guid.TryParse(myUserIdString, out var myUserId))
            {
                throw new HubException("User not authenticated.");
            }

            var messagesToDelete = await context.Messages
                .Where(m =>
                    (m.SenderId == myUserId && m.ReceiverId == contactId) ||
                    (m.SenderId == contactId && m.ReceiverId == myUserId)
                )
                .ToListAsync();

            if (messagesToDelete.Any())
            {
                context.Messages.RemoveRange(messagesToDelete);
                await context.SaveChangesAsync();

                await Clients.User(contactId.ToString()).SendAsync("ChatClearedByPartner", myUserId);
            }
        }

        public async Task LoadMessages(Guid contactId, int pageNumber = 1)
        {
            int pageSize = 10;
            var currentUserId = Context.UserIdentifier;

            if (currentUserId == null) return;
            var currentUserIdGuid = Guid.Parse(currentUserId);

            var messages = await context.Messages
                .Include(x => x.Sender)
                .Include(x => x.ReplyMessage).ThenInclude(r => r.Sender)
                .Include(x => x.Attachments)
                .Where(x => (x.ReceiverId == currentUserIdGuid && x.SenderId == contactId) ||
                            (x.SenderId == currentUserIdGuid && x.ReceiverId == contactId))
                .OrderByDescending(x => x.CreatedDate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new MessageResponseDto
                {
                    Id = x.Id,
                    Content = x.Content,
                    CreatedDate = x.CreatedDate,
                    ReceiverId = x.ReceiverId,
                    ReplyMessageId = x.ReplyMessageId ?? Guid.Empty,
                    ReplyMessageContent = x.ReplyMessage != null ? x.ReplyMessage.Content : "",
                    ReplyMessageSenderName = x.ReplyMessage != null && x.ReplyMessage.Sender != null ? x.ReplyMessage.Sender.Name : "",
                    SenderId = x.SenderId,
                    IsRead = x.IsRead,
                    SenderName = x.Sender != null ? x.Sender.Name : "",
                    Attachments = x.Attachments ?? new List<MessageAttachment>(),
                    MessageType = (int)x.MessageType,
                    CallDurationSeconds = x.CallDurationSeconds
                })
                .ToListAsync();

            messages.Reverse();

            var unreadMessages = await context.Messages
                .Where(x => x.ReceiverId == currentUserIdGuid && x.SenderId == contactId && !x.IsRead)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                unreadMessages.ForEach(m => m.IsRead = true);
                await context.SaveChangesAsync();

                await Clients.User(contactId.ToString()).SendAsync("MessagesMarkedAsRead", currentUserIdGuid);
            }

            await Clients.Caller.SendAsync("ReceiveMessageList", new { Messages = messages, Page = pageNumber });
        }

        public async Task SendMessage(MessageRequestDto message)
        {
            var senderIdGuid = Guid.Parse(Context.UserIdentifier!);
            var newId = Guid.NewGuid();

            var newMsg = new Message
            {
                Id = newId,
                SenderId = senderIdGuid,
                ReceiverId = message.ReceiverId,
                IsRead = false,
                CreatedDate = DateTime.UtcNow,
                ReplyMessageId = message.ReplyMessageId,
                Content = message.Content,
                Attachments = message.Attachments?.Select(a => new MessageAttachment
                {
                    MessageId = newId,
                    Path = a.Path ?? "",
                    Type = a.Type,
                    Name = a.Name ?? ""
                }).ToList()
            };

            context.Messages.Add(newMsg);
            await context.SaveChangesAsync();

            var sender = await userManager.FindByIdAsync(senderIdGuid.ToString());

            var messageDto = new MessageResponseDto
            {
                Id = newMsg.Id,
                Content = newMsg.Content,
                CreatedDate = newMsg.CreatedDate,
                ReceiverId = newMsg.ReceiverId,
                SenderId = newMsg.SenderId,
                SenderName = sender?.Name ?? "",
                IsRead = false,
                Attachments = newMsg.Attachments
            };

            await Clients.User(message.ReceiverId.ToString()!).SendAsync("ReceiveNewMessage", messageDto);
            await Clients.Caller.SendAsync("ReceiveNewMessage", messageDto);
        }

        public async Task SaveCallRecord(Guid contactId, int? durationSeconds)
        {
            var callerIdStr = Context.UserIdentifier;
            if (string.IsNullOrEmpty(callerIdStr) || !Guid.TryParse(callerIdStr, out var callerId))
                return;

            var callMessage = new Message
            {
                Id = Guid.NewGuid(),
                SenderId = callerId,
                ReceiverId = contactId,
                MessageType = Domain.Entities.MessageType.VideoCall,
                CallDurationSeconds = durationSeconds,
                CreatedDate = DateTime.UtcNow,
                IsRead = false,
                Content = ""
            };

            context.Messages.Add(callMessage);
            await context.SaveChangesAsync();

            var caller = await userManager.FindByIdAsync(callerId.ToString());

            var callDto = new MessageResponseDto
            {
                Id = callMessage.Id,
                SenderId = callerId,
                ReceiverId = contactId,
                SenderName = caller?.Name ?? "",
                MessageType = (int)Domain.Entities.MessageType.VideoCall,
                CallDurationSeconds = durationSeconds,
                CreatedDate = callMessage.CreatedDate,
                IsRead = false,
                Content = "",
                Attachments = new List<MessageAttachment>()
            };

            await Clients.User(contactId.ToString()).SendAsync("ReceiveNewMessage", callDto);
            await Clients.Caller.SendAsync("ReceiveNewMessage", callDto);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }

        public async Task NotifyTyping(Guid contactId)
        {
            var senderUserName = Context.User!.Identity!.Name;
            if (string.IsNullOrEmpty(senderUserName)) return;

            await Clients.User(contactId.ToString()).SendAsync("NotifyTypingToUser", senderUserName);
        }

        public async Task DeleteMessage(Guid messageId)
        {
            var currentUserIdStr = Context.UserIdentifier;
            if (string.IsNullOrEmpty(currentUserIdStr) || !Guid.TryParse(currentUserIdStr, out var currentUserId))
                throw new HubException("User not authenticated.");

            var message = await context.Messages
                .FirstOrDefaultAsync(m => m.Id == messageId && m.SenderId == currentUserId);

            if (message == null)
                throw new HubException("Message not found or you don't have permission to delete it.");

            var receiverId = message.ReceiverId;

            context.Messages.Remove(message);
            await context.SaveChangesAsync();

            await Clients.User(receiverId.ToString()).SendAsync("MessageDeleted", messageId);
            await Clients.Caller.SendAsync("MessageDeleted", messageId);
        }

        public async Task MarkChatAsRead(Guid contactId)
        {
            var currentUserIdStr = Context.UserIdentifier;
            if (string.IsNullOrEmpty(currentUserIdStr)) return;

            var currentUserIdGuid = Guid.Parse(currentUserIdStr);

            var unreadMessages = await context.Messages
                .Where(x => x.ReceiverId == currentUserIdGuid && x.SenderId == contactId && !x.IsRead)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                unreadMessages.ForEach(m => m.IsRead = true);
                await context.SaveChangesAsync();

                await Clients.User(contactId.ToString()).SendAsync("MessagesMarkedAsRead", currentUserIdGuid);
            }
        }
    }
}
