using Application.DTOs.User;
using AutoMapper;
using Domain.Entities;

namespace Application.AutoMapper
{
    public class ApplicationUserProfile : Profile
    {
        public ApplicationUserProfile() 
        {
            CreateMap<ApplicationUser, UserProfileDto>()
            .ForMember(dest => dest.UserCategory, opt => opt.MapFrom(src => (int)src.UserCategory))
            .ForMember(dest => dest.Roles, opt => opt.Ignore())
            .ForMember(dest => dest.Psychologist, opt => opt.MapFrom(src => src.Psychologist));

            CreateMap<Psychologist, PsychologistProfileDto>();

            CreateMap<WorkingHour, WorkingHourDto>()
                .ForMember(dest => dest.DayOfWeek, opt => opt.MapFrom(src => (int)src.DayOfWeek));
        }
    }
}
    