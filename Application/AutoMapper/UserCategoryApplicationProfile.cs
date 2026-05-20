using Application.DTOs.UserCategoryApplication;
using AutoMapper;
using Domain.Entities;

namespace Application.AutoMapper
{
    public class UserCategoryApplicationProfile : Profile
    {
        public UserCategoryApplicationProfile()
        {
            CreateMap<UserCategoryApplication, UserCategoryApplicationResponseDto>()
                .ForMember(d => d.FirstName, opt => opt.MapFrom(s => s.User.Name ?? string.Empty))
                .ForMember(d => d.LastName, opt => opt.MapFrom(s => s.User.Surname ?? string.Empty))
                .ForMember(d => d.Email, opt => opt.MapFrom(s => s.User.Email ?? string.Empty))
                .ForMember(d => d.ProfileImage, opt => opt.MapFrom(s => s.User.ProfileImage ?? string.Empty))
                .ForMember(d => d.RequestedCategory, opt => opt.MapFrom(s => (int)s.RequestedCategory))
                .ForMember(d => d.RequestedCategoryName, opt => opt.MapFrom(s => s.RequestedCategory.ToString()))
                .ForMember(d => d.Status, opt => opt.MapFrom(s => s.Status.ToString()));
        }
    }
}
