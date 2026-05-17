using Application.DTOs;

namespace Infrastructure.Services.Interfaces
{
    public interface IPsychologistResumeService
    {
        Task<PsychologistResumeDto> GetMyResumeAsync(Guid userId);
        Task<PsychologistResumeDto> UpdateMyResumeAsync(Guid userId, UpdatePsychologistResumeDto dto);
        Task<PsychologistCatalogPageDto> GetCatalogAsync(PsychologistCatalogFilterDto filter);
    }
}
