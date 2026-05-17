using Application.DTOs;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services
{
    public class PsychologistResumeService : IPsychologistResumeService
    {
        private readonly ApplicationDbContext _context;

        public PsychologistResumeService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PsychologistResumeDto> GetMyResumeAsync(Guid userId)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.Specializations)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            return Map(psychologist);
        }

        public async Task<PsychologistResumeDto> UpdateMyResumeAsync(Guid userId, UpdatePsychologistResumeDto dto)
        {
            var psychologist = await _context.Psychologists
                .Include(p => p.Specializations)
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (psychologist == null)
                throw new Exception("Psychologist profile not found.");

            psychologist.Bio = dto.Bio?.Trim() ?? string.Empty;
            psychologist.VideoGreetingUrl = dto.VideoGreetingUrl?.Trim() ?? string.Empty;
            psychologist.PricePerSession = dto.PricePerSession;
            psychologist.SessionDurationMinutes = dto.SessionDurationMinutes;
            psychologist.Education = dto.Education?.Trim() ?? string.Empty;
            psychologist.ExperienceYears = dto.ExperienceYears;
            psychologist.ContactPhone = dto.ContactPhone?.Trim() ?? string.Empty;
            psychologist.WorksWithMilitary = dto.WorksWithMilitary;
            psychologist.HasTraumaTraining = dto.HasTraumaTraining;
            psychologist.OffersFreeSessionsForMilitary = dto.OffersFreeSessionsForMilitary;
            psychologist.DiscountForAffected = dto.DiscountForAffected;

            if (dto.IsPublished && !IsResumeComplete(psychologist, dto.SpecializationIds))
                throw new Exception("Resume is incomplete. Fill in bio, education, contact phone, price and at least one specialization before publishing.");

            psychologist.IsPublished = dto.IsPublished;

            var requestedIds = dto.SpecializationIds?.Distinct().ToList() ?? new List<Guid>();
            var currentIds = psychologist.Specializations.Select(s => s.Id).ToHashSet();
            var nextIds = requestedIds.ToHashSet();

            foreach (var spec in psychologist.Specializations.Where(s => !nextIds.Contains(s.Id)).ToList())
                psychologist.Specializations.Remove(spec);

            var idsToAttach = requestedIds.Where(id => !currentIds.Contains(id)).ToList();
            if (idsToAttach.Count > 0)
            {
                var toAdd = await _context.Specializations
                    .Where(s => idsToAttach.Contains(s.Id))
                    .ToListAsync();

                foreach (var spec in toAdd)
                    psychologist.Specializations.Add(spec);
            }

            await _context.SaveChangesAsync();

            return Map(psychologist);
        }

        public async Task<PsychologistCatalogPageDto> GetCatalogAsync(PsychologistCatalogFilterDto filter)
        {
            filter.Page = filter.Page < 1 ? 1 : filter.Page;
            filter.PageSize = filter.PageSize <= 0 ? 12 : Math.Min(filter.PageSize, 50);

            var query = _context.Psychologists
                .AsNoTracking()
                .Where(p => p.IsPublished)
                .Include(p => p.User)
                .Include(p => p.Specializations)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var term = filter.Search.Trim().ToLower();
                query = query.Where(p =>
                    (p.User.Name != null && p.User.Name.ToLower().Contains(term)) ||
                    (p.User.Surname != null && p.User.Surname.ToLower().Contains(term)) ||
                    p.Bio.ToLower().Contains(term) ||
                    p.Education.ToLower().Contains(term));
            }

            if (filter.SpecializationIds != null && filter.SpecializationIds.Count > 0)
            {
                var ids = filter.SpecializationIds;
                query = query.Where(p => p.Specializations.Any(s => ids.Contains(s.Id)));
            }

            if (filter.MinPrice.HasValue)
                query = query.Where(p => p.PricePerSession >= filter.MinPrice.Value);
            if (filter.MaxPrice.HasValue)
                query = query.Where(p => p.PricePerSession <= filter.MaxPrice.Value);

            if (filter.MinExperience.HasValue)
                query = query.Where(p => p.ExperienceYears >= filter.MinExperience.Value);

            if (filter.WorksWithMilitary == true)
                query = query.Where(p => p.WorksWithMilitary);
            if (filter.HasTraumaTraining == true)
                query = query.Where(p => p.HasTraumaTraining);
            if (filter.OffersFreeSessionsForMilitary == true)
                query = query.Where(p => p.OffersFreeSessionsForMilitary);

            query = (filter.Sort ?? string.Empty).ToLower() switch
            {
                "price_asc" => query.OrderBy(p => p.PricePerSession),
                "price_desc" => query.OrderByDescending(p => p.PricePerSession),
                "experience_desc" => query.OrderByDescending(p => p.ExperienceYears),
                "experience_asc" => query.OrderBy(p => p.ExperienceYears),
                _ => query.OrderByDescending(p => p.ExperienceYears).ThenBy(p => p.PricePerSession),
            };

            var publishedQueryForRange = _context.Psychologists.AsNoTracking().Where(p => p.IsPublished);
            var hasAny = await publishedQueryForRange.AnyAsync();
            var minPrice = hasAny ? await publishedQueryForRange.MinAsync(p => p.PricePerSession) : 0m;
            var maxPrice = hasAny ? await publishedQueryForRange.MaxAsync(p => p.PricePerSession) : 0m;

            var total = await query.CountAsync();

            var items = await query
                .Skip((filter.Page - 1) * filter.PageSize)
                .Take(filter.PageSize)
                .Select(p => new PsychologistCatalogItemDto
                {
                    Id = p.Id,
                    UserId = p.UserId,
                    FirstName = p.User.Name ?? string.Empty,
                    LastName = p.User.Surname ?? string.Empty,
                    ProfileImage = p.User.ProfileImage,
                    Bio = p.Bio,
                    VideoGreetingUrl = p.VideoGreetingUrl,
                    PricePerSession = p.PricePerSession,
                    SessionDurationMinutes = p.SessionDurationMinutes,
                    ExperienceYears = p.ExperienceYears,
                    WorksWithMilitary = p.WorksWithMilitary,
                    HasTraumaTraining = p.HasTraumaTraining,
                    OffersFreeSessionsForMilitary = p.OffersFreeSessionsForMilitary,
                    DiscountForAffected = p.DiscountForAffected,
                    Specializations = p.Specializations
                        .OrderBy(s => s.Name)
                        .Select(s => new SpecializationDto { Id = s.Id, Name = s.Name })
                        .ToList()
                })
                .ToListAsync();

            return new PsychologistCatalogPageDto
            {
                Items = items,
                Total = total,
                Page = filter.Page,
                PageSize = filter.PageSize,
                MinPrice = minPrice,
                MaxPrice = maxPrice
            };
        }

        private static bool IsResumeComplete(Psychologist p, List<Guid>? specializationIds)
        {
            return !string.IsNullOrWhiteSpace(p.Bio)
                && !string.IsNullOrWhiteSpace(p.Education)
                && !string.IsNullOrWhiteSpace(p.ContactPhone)
                && p.PricePerSession > 0
                && p.SessionDurationMinutes > 0
                && (specializationIds?.Any() ?? false);
        }

        private static PsychologistResumeDto Map(Psychologist p) => new()
        {
            Id = p.Id,
            Bio = p.Bio,
            VideoGreetingUrl = p.VideoGreetingUrl,
            PricePerSession = p.PricePerSession,
            SessionDurationMinutes = p.SessionDurationMinutes,
            Education = p.Education,
            ExperienceYears = p.ExperienceYears,
            ContactPhone = p.ContactPhone,
            WorksWithMilitary = p.WorksWithMilitary,
            HasTraumaTraining = p.HasTraumaTraining,
            OffersFreeSessionsForMilitary = p.OffersFreeSessionsForMilitary,
            DiscountForAffected = p.DiscountForAffected,
            IsPublished = p.IsPublished,
            Specializations = p.Specializations
                .OrderBy(s => s.Name)
                .Select(s => new SpecializationDto { Id = s.Id, Name = s.Name })
                .ToList()
        };
    }
}
