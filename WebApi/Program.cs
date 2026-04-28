using API.Endpoints;
using Application;
using Infrastructure;
using Infrastructure.Data;
using Infrastructure.Hubs;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = new[]
{
    "http://localhost:4200",
    "https://localhost:4200",
    "http://helphub-platform.fun",
    "https://helphub-platform.fun",
    "http://www.helphub-platform.fun",
    "https://www.helphub-platform.fun"
};

builder.Services.AddCors(
    options =>
    {
        options.AddDefaultPolicy(builder =>
        {
            builder.WithOrigins(allowedOrigins)
             .AllowAnyHeader()
             .AllowAnyMethod()
             .AllowCredentials();
        });
    }
);

var JwtSettings = builder.Configuration.GetSection("JwtSettings");

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers();
builder.Services.AddSignalR();

builder.Services.AddApplicationLayer();
builder.Services.AddInfrastructureLayer(builder.Configuration);

builder.Services.AddAuthentication(opt =>
{
    opt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(option =>
{
    option.SaveToken = true;
    option.RequireHttpsMetadata = false;
    option.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSettings.GetSection("SecurityKey").Value!)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };

    option.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var db = services.GetRequiredService<ApplicationDbContext>();
    var configuration = services.GetRequiredService<IConfiguration>();

    int retries = 5;
    while (retries > 0)
    {
        try
        {
            logger.LogInformation("Attempting to apply database migrations...");
            await db.Database.MigrateAsync();
            logger.LogInformation("Database migrations applied successfully.");
            try
            {
                await DbInitializer.SeedRolesAndAdminAsync(services, configuration);
                logger.LogInformation("Roles and admin seeded successfully.");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error initializing roles or admin.");
            }
            break; 
        }
        catch (Microsoft.Data.SqlClient.SqlException)
        {
            retries--;
            if (retries == 0)
            {
                logger.LogError("Could not connect to the database after multiple attempts.");
                throw;
            }
            
            logger.LogWarning($"Database is not ready yet. Waiting 5 seconds... ({retries} retries left)");
            await Task.Delay(5000); 
        }
    }
}

    app.UseCors(x => 
    x.AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithOrigins(allowedOrigins));

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseStaticFiles();
app.MapHub<ChatHub>("hubs/chat");
app.MapHub<VideoChatHub>("hubs/video");
app.MapHub<OnlineUsersHub>("hubs/online-users");
app.MapHub<NotificationHub>("hubs/notification");
app.MapAccountEndpoint();
app.MapControllers();

app.Run();
