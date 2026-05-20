using Application.DTOs.UserCategoryApplication;

namespace Infrastructure.Services.Interfaces
{
    public interface IUserCategoryApplicationService
    {
        Task<UserCategoryApplicationResponseDto> CreateAsync(Guid userId, CreateUserCategoryApplicationDto dto);
        Task<UserCategoryApplicationResponseDto?> GetMyLatestAsync(Guid userId);
        Task<List<UserCategoryApplicationResponseDto>> GetAllAsync();
        Task<UserCategoryApplicationResponseDto> ReviewAsync(Guid applicationId, Guid reviewerId, ReviewUserCategoryApplicationDto dto);
    }
}
