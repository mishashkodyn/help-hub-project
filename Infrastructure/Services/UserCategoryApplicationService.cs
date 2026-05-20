using Application.DTOs.Notifications;
using Application.DTOs.UserCategoryApplication;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class UserCategoryApplicationService : IUserCategoryApplicationService
    {
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;
        private readonly INotificationService _notificationService;
        private readonly IStorageService _storageService;
        private readonly UserManager<ApplicationUser> _userManager;

        public UserCategoryApplicationService(
            ApplicationDbContext context,
            IMapper mapper,
            INotificationService notificationService,
            IStorageService storageService,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _mapper = mapper;
            _notificationService = notificationService;
            _storageService = storageService;
            _userManager = userManager;
        }

        public async Task<UserCategoryApplicationResponseDto> CreateAsync(Guid userId, CreateUserCategoryApplicationDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new Exception("User not found.");

            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains(ApplicationRole.ROLE_ADMIN)
                || roles.Contains(ApplicationRole.ROLE_SUPERADMIN)
                || roles.Contains(ApplicationRole.ROLE_PSYCHOLOGIST))
            {
                throw new Exception("Адміністратори та психологи не можуть подавати заявку на категорію.");
            }

            if (user.UserCategory != UserCategory.Civilian)
                throw new Exception("Ви вже маєте підтверджену категорію та не можете подавати нову заявку.");

            if (!Enum.IsDefined(typeof(UserCategory), dto.RequestedCategory) ||
                (UserCategory)dto.RequestedCategory == UserCategory.Civilian)
            {
                throw new Exception("Невірна категорія заявки.");
            }

            var hasPending = await _context.UserCategoryApplications
                .AnyAsync(a => a.UserId == userId && a.Status == UserCategoryApplicationStatus.Pending);

            if (hasPending)
                throw new Exception("У вас вже є заявка, що очікує на розгляд.");

            var documentUrls = new List<string>();
            if (dto.Documents != null && dto.Documents.Count > 0)
            {
                foreach (var file in dto.Documents)
                {
                    if (file.Length > 0)
                    {
                        var url = await _storageService.UploadFileAsync(file);
                        documentUrls.Add(url);
                    }
                }
            }

            var entity = new UserCategoryApplication
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RequestedCategory = (UserCategory)dto.RequestedCategory,
                Comment = dto.Comment?.Trim() ?? string.Empty,
                DocumentUrls = documentUrls,
                Status = UserCategoryApplicationStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.UserCategoryApplications.Add(entity);
            await _context.SaveChangesAsync();

            await NotifyAdminsAsync(entity, user);

            await _context.Entry(entity).Reference(e => e.User).LoadAsync();
            return _mapper.Map<UserCategoryApplicationResponseDto>(entity);
        }

        public async Task<UserCategoryApplicationResponseDto?> GetMyLatestAsync(Guid userId)
        {
            var app = await _context.UserCategoryApplications
                .Include(a => a.User)
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .FirstOrDefaultAsync();

            return app == null ? null : _mapper.Map<UserCategoryApplicationResponseDto>(app);
        }

        public async Task<List<UserCategoryApplicationResponseDto>> GetAllAsync()
        {
            var apps = await _context.UserCategoryApplications
                .Include(a => a.User)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return _mapper.Map<List<UserCategoryApplicationResponseDto>>(apps);
        }

        public async Task<UserCategoryApplicationResponseDto> ReviewAsync(Guid applicationId, Guid reviewerId, ReviewUserCategoryApplicationDto dto)
        {
            var app = await _context.UserCategoryApplications
                .Include(a => a.User)
                .FirstOrDefaultAsync(a => a.Id == applicationId)
                ?? throw new Exception("Заявку не знайдено.");

            if (app.Status != UserCategoryApplicationStatus.Pending)
                throw new Exception("Заявку вже було розглянуто.");

            app.Status = dto.IsApproved ? UserCategoryApplicationStatus.Approved : UserCategoryApplicationStatus.Rejected;
            app.ReviewedAt = DateTime.UtcNow;
            app.ReviewedById = reviewerId;
            app.RejectionReason = dto.IsApproved ? null : dto.RejectionReason?.Trim();

            if (dto.IsApproved)
            {
                app.User.UserCategory = app.RequestedCategory;
            }

            await _context.SaveChangesAsync();

            var categoryLabel = app.RequestedCategory.ToString();
            var title = dto.IsApproved ? "Заявку підтверджено" : "Заявку відхилено";
            var message = dto.IsApproved
                ? $"Вашу заявку на статус \"{categoryLabel}\" було підтверджено."
                : $"Вашу заявку на статус \"{categoryLabel}\" було відхилено."
                  + (string.IsNullOrWhiteSpace(app.RejectionReason) ? string.Empty : $" Причина: {app.RejectionReason}");

            await _notificationService.SendNotificationAsync(new CreateNotificationDto
            {
                UserId = app.UserId,
                Title = title,
                Message = message,
                Type = NotificationType.UserCategoryApplication,
                RelatedEntityId = app.Id
            });

            return _mapper.Map<UserCategoryApplicationResponseDto>(app);
        }

        private async Task NotifyAdminsAsync(UserCategoryApplication application, ApplicationUser applicant)
        {
            var admins = await _userManager.GetUsersInRoleAsync(ApplicationRole.ROLE_ADMIN);
            var superAdmins = await _userManager.GetUsersInRoleAsync(ApplicationRole.ROLE_SUPERADMIN);

            var recipients = admins
                .Concat(superAdmins)
                .GroupBy(u => u.Id)
                .Select(g => g.First())
                .ToList();

            var fullName = $"{applicant.Name} {applicant.Surname}".Trim();
            if (string.IsNullOrWhiteSpace(fullName))
                fullName = applicant.Email ?? "Користувач";

            var title = "Нова заявка на категорію";
            var message = $"{fullName} подав(-ла) заявку на статус \"{application.RequestedCategory}\".";

            foreach (var admin in recipients)
            {
                await _notificationService.SendNotificationAsync(new CreateNotificationDto
                {
                    UserId = admin.Id,
                    Title = title,
                    Message = message,
                    Type = NotificationType.UserCategoryApplication,
                    RelatedEntityId = application.Id
                });
            }
        }
    }
}
