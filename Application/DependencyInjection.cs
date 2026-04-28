using Application.AutoMapper;
using Microsoft.Extensions.DependencyInjection;
namespace Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplicationLayer(this IServiceCollection services)
        {
            services.AddAutoMapper(typeof(ApplicationUserProfile).Assembly);

            return services;
        }
    }
}
