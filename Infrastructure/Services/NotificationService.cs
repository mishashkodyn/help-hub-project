using Application.DTOs.Notifications;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Hubs;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class NotificationService : INotificationService
    {
        private readonly IMapper _mapper;
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;

        public NotificationService(IMapper mapper, ApplicationDbContext context, IHubContext<NotificationHub> hubContext)
        {
            _mapper = mapper;
            _context = context;
            _hubContext = hubContext;
        }

        public async Task SendNotificationAsync(CreateNotificationDto dto)
        {
            var notification = _mapper.Map<Notification>(dto);

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.User(dto.UserId.ToString())
            .SendAsync("ReceiveNotification", new
            {
                id = notification.Id,
                title = notification.Title,
                message = notification.Message,
                type = notification.Type,
                createdAt = notification.CreatedAt,
                isRead = false,
                relatedEntityId = notification.RelatedEntityId
            });
        }

        public async Task<IEnumerable<NotificationDto>> GetNotificationsByUserIdAsync(Guid userId, bool unreadOnly = false)
        {
            if (userId == Guid.Empty)
            {
                throw new ArgumentException("Ідентифікатор користувача не може бути порожнім.", nameof(userId));
            }

            var notifications = await _context.Notifications.Where(x => x.UserId == userId).ToListAsync();

            var notificationDtos = _mapper.Map<IEnumerable<NotificationDto>>(notifications);

            return notificationDtos;
        }
    }
}
