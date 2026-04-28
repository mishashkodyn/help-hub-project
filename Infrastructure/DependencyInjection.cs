using Azure.Storage.Blobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Identity;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Options;
using Infrastructure.Services;
using Infrastructure.Services.Interfaces;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructureLayer(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddDbContext<ApplicationDbContext>(options =>
               options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

            services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
            {
                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

            var blobConn = configuration.GetConnectionString("BlobConnection")
               ?? configuration["ConnectionStrings:BlobConnection"];

            services.AddSingleton(x => new BlobServiceClient(blobConn));

            var r2Section = configuration.GetSection("CloudflareConfig");
            services.Configure<CloudflareConfig>(r2Section);

            services.AddScoped<IAiService, AiService>();
            services.AddScoped<INotificationService, NotificationService>();
            services.AddScoped<IWorkingHoursService, WorkingHoursService>();
            services.AddScoped<TokenService>();

            if (r2Section.GetValue<bool>("Enabled"))
            {
                services.AddScoped<IStorageService, R2StorageService>();
            }
            else
            {
                services.AddScoped<IStorageService, BlobStorageService>();
            }

            return services;
        }
    }
}
