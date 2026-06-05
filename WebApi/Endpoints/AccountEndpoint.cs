using Application.DTOs;
using Application.DTOs.PsychologistApplication;
using Application.DTOs.User;
using AutoMapper;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Extensions;
using Infrastructure.Services;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NPOI.Util;
using System.Runtime.CompilerServices;

namespace API.Endpoints
    {
        public record UpdateCardNumberDto(string CardNumber);

        public record AnonymousRegisterDto(string Password);

        public static class AccountEndpoint
        {
            public static RouteGroupBuilder MapAccountEndpoint(this WebApplication app)
            {
                var group = app.MapGroup("api/account").WithTags("account");

                group.MapPost("/register", async (HttpContext context, TokenService tokenService, 
                 IConfiguration _config, UserManager<ApplicationUser>
                 userManager, [FromForm] string name, [FromForm] string surname, [FromForm] string email,
                 [FromForm] string password, [FromForm] IFormFile? profileImage, [FromForm] string gender, IStorageService blobService) =>
                {
                    var userFromDb = await userManager.FindByEmailAsync(email);

                    if (userFromDb is not null)
                    {
                        return Results.BadRequest(Response<string>.Failure("User is alreade exist."));
                    }
                    var profileImageUrl = "https://i.pinimg.com/474x/47/89/32/478932422ae7476306f5c7fa52414098.jpg";

                    if (profileImage is not null)
                    {
                        profileImageUrl = await blobService.UploadFileAsync(profileImage);
                    }

                    if (!Enum.TryParse<Gender>(gender, true, out var parsedGender))
                    {
                        return Results.BadRequest("Invalid gender value");
                    }

                    var user = new ApplicationUser
                    {
                        Name = name,
                        Surname = surname,
                        Email = email,
                        UserName = email,
                        ProfileImage = profileImageUrl,
                        Gender = parsedGender
                    };

                    var result = await userManager.CreateAsync(user, password);

                    if (!result.Succeeded)
                    {
                        await blobService.DeleteFileAsync(user.ProfileImage);
                        return Results.BadRequest(Response<string>.Failure(result.Errors
                            .Select(x => x.Description).FirstOrDefault()!));
                    }

                    await userManager.AddToRoleAsync(user, ApplicationRole.ROLE_USER);

                    var roles = new List<string> { ApplicationRole.ROLE_USER };
                    var token = tokenService.GenerateToken(user.Id, user.UserName!, roles);
                    var refreshToken = tokenService.GenerateRefreshToken();

                    var refreshTokenExpirationDays = _config.GetValue<int>("JwtSettings:RefreshTokenExpirationDays");
                    user.RefreshToken = refreshToken;
                    user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(refreshTokenExpirationDays);
                    await userManager.UpdateAsync(user);

                    SetRefreshTokenCookie(context, refreshToken, refreshTokenExpirationDays);

                    return Results.Ok(Response<string>.Success(token, "User create successfully."));
                }).DisableAntiforgery();

                group.MapPost("/anonymous-register", async (HttpContext context, TokenService tokenService,
                 IConfiguration _config, UserManager<ApplicationUser> userManager, [FromBody] AnonymousRegisterDto dto) =>
                {
                    if (dto is null || string.IsNullOrWhiteSpace(dto.Password))
                    {
                        return Results.BadRequest(Response<string>.Failure("Password is required."));
                    }

                    const string anonymousAvatarUrl = "/anonymous-avatar.svg";

                    // Generate a unique anonymous identity: login "User" + random digits.
                    var random = new Random();
                    string number;
                    string userName;
                    string email;
                    var attempts = 0;
                    do
                    {
                        number = random.Next(1000, 1000000).ToString();
                        userName = $"User{number}";
                        email = $"user{number}@anonymous.hulphub";
                        attempts++;
                    }
                    while ((await userManager.FindByNameAsync(userName) is not null
                            || await userManager.FindByEmailAsync(email) is not null) && attempts < 20);

                    if (await userManager.FindByNameAsync(userName) is not null
                        || await userManager.FindByEmailAsync(email) is not null)
                    {
                        return Results.BadRequest(Response<string>.Failure("Could not generate an anonymous account, please try again."));
                    }

                    var user = new ApplicationUser
                    {
                        Name = "User",
                        Surname = number,
                        Email = email,
                        UserName = userName,
                        ProfileImage = anonymousAvatarUrl,
                        Gender = Gender.Male
                    };

                    var result = await userManager.CreateAsync(user, dto.Password);

                    if (!result.Succeeded)
                    {
                        return Results.BadRequest(Response<string>.Failure(result.Errors
                            .Select(x => x.Description).FirstOrDefault()!));
                    }

                    await userManager.AddToRoleAsync(user, ApplicationRole.ROLE_USER);

                    var roles = new List<string> { ApplicationRole.ROLE_USER };
                    var token = tokenService.GenerateToken(user.Id, user.UserName!, roles);
                    var refreshToken = tokenService.GenerateRefreshToken();

                    var refreshTokenExpirationDays = _config.GetValue<int>("JwtSettings:RefreshTokenExpirationDays");
                    user.RefreshToken = refreshToken;
                    user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(refreshTokenExpirationDays);
                    await userManager.UpdateAsync(user);

                    SetRefreshTokenCookie(context, refreshToken, refreshTokenExpirationDays);

                    return Results.Ok(Response<string>.Success(token, "Anonymous user created successfully."));
                }).DisableAntiforgery();

                group.MapPost("/psychologist-register", async ([FromForm] CreatePsychologistApplicationDto dto,
                    IMapper mapper, ApplicationDbContext dbContext, HttpContext context, 
                    UserManager<ApplicationUser> userManager, IStorageService blobService) =>
                {
                    var userId = context.User.GetUserId()!;
                    var user = await userManager.FindByIdAsync(userId.ToString());

                    if (user == null) return Results.BadRequest(Response<string>.Failure("User not found."));

                    var existingApp = await dbContext.PsychologistApplications
                        .AnyAsync(a => a.UserId == userId && a.Status == ApplicationStatus.Pending);

                    if (existingApp)
                    {
                        if (user == null) return Results.BadRequest(Response<string>.Failure("You already have a pending application."));
                    }

                    var uploadedFileUrls = new List<string>();

                    if (dto.Documents != null && dto.Documents.Count > 0)
                    {
                        foreach (var file in dto.Documents)
                        {
                            if (file.Length > 0)
                            {
                                var fileUrl = await blobService.UploadFileAsync(file);
                                uploadedFileUrls.Add(fileUrl);
                            }
                        }
                    }

                    var application = mapper.Map<PsychologistApplication>(dto);

                    application.UserId = userId;
                    application.DocumentUrls = uploadedFileUrls;
                    application.Status = ApplicationStatus.Pending;
                    application.CreatedAt = DateTime.UtcNow;

                    application.Specializations ??= new List<Specialization>();

                    if (dto.Specializations != null && dto.Specializations.Any())
                    {
                        var specIds = dto.Specializations
                            .Where(id => Guid.TryParse(id, out _))
                            .Select(Guid.Parse)
                            .ToList();

                        var selectedSpecializations = await dbContext.Specializations
                            .Where(s => specIds.Contains(s.Id))
                            .ToListAsync();

                        foreach (var spec in selectedSpecializations)
                        {
                            application.Specializations.Add(spec);
                        }
                    }

                    dbContext.PsychologistApplications.Add(application);
                    await dbContext.SaveChangesAsync();

                    return Results.Ok(new { message = "Application submitted successfully" });
                }).DisableAntiforgery();

            group.MapPost("/login", async (HttpContext context, UserManager < ApplicationUser> userManager,
                    TokenService tokenService, LoginDto dto, IConfiguration _config) =>
                    {
                    if (dto is null)
                    {
                        return Results.BadRequest(Response<string>.Failure("Invalid login details."));
                    }

                    // Allow signing in with either an email or a username (e.g. anonymous "User1234").
                    var user = await userManager.FindByEmailAsync(dto.Email)
                               ?? await userManager.FindByNameAsync(dto.Email);

                    if (user is null)
                    {
                        return Results.BadRequest(Response<string>.Failure("User not found."));
                    }

                    var result = await userManager.CheckPasswordAsync(user!, dto.Password);

                    if (!result)
                    {
                        return Results.BadRequest(Response<string>.Failure("Invalid password."));
                    }
                    var roles = await userManager.GetRolesAsync(user!);
                    var token = tokenService.GenerateToken(user.Id, user.UserName!, roles);
                    var refreshToken = tokenService.GenerateRefreshToken();

                    var refreshTokenExpirationDays = _config.GetValue<int>("JwtSettings:RefreshTokenExpirationDays");

                    user.RefreshToken = refreshToken;
                    user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(refreshTokenExpirationDays);
                    await userManager.UpdateAsync(user);

                    SetRefreshTokenCookie(context, refreshToken, refreshTokenExpirationDays);

                    return Results.Ok(Response<string>.Success(token, "Login successfully"));
                });

                group.MapPost("/refresh", async (HttpContext context, UserManager<ApplicationUser> userManager, TokenService tokenService, IConfiguration _config) =>
                {
                    var refreshToken = context.Request.Cookies["refreshToken"];

                    if (string.IsNullOrEmpty(refreshToken))
                    {
                        return Results.Unauthorized();
                    }

                    var user = await userManager.Users.SingleOrDefaultAsync(u => u.RefreshToken == Guid.Parse(refreshToken));

                    if (user is null || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
                    {
                        return Results.Unauthorized();
                    }

                    var roles = await userManager.GetRolesAsync(user);
                    var newJwtToken = tokenService.GenerateToken(user.Id, user.UserName!, roles);
                    var newRefreshToken = tokenService.GenerateRefreshToken();
                    var refreshTokenExpirationDays = _config.GetValue<int>("JwtSettings:RefreshTokenExpirationDays");
                    user.RefreshToken = newRefreshToken;
                    await userManager.UpdateAsync(user);

                    SetRefreshTokenCookie(context, newRefreshToken, refreshTokenExpirationDays);

                    return Results.Ok(Response<string>.Success(newJwtToken, "Token refreshed successfully"));
                });

                void SetRefreshTokenCookie(HttpContext context, Guid refreshToken, int expiresTime)
                {
                    var cookieOptions = new CookieOptions
                    {
                        HttpOnly = true,
                        Expires = DateTime.UtcNow.AddDays(expiresTime),
                        Secure = true,
                        SameSite = SameSiteMode.None
                    };
                    context.Response.Cookies.Append("refreshToken", refreshToken.ToString(), cookieOptions);
                }

                group.MapGet("/me", async (HttpContext context, UserManager<ApplicationUser> userManager) =>
                {
                    var userId = context.User.GetUserId()!;
                    var user = await userManager.FindByIdAsync(userId.ToString());

                    if (user == null) return Results.NotFound();

                    var roles = await userManager.GetRolesAsync(user);

                    return Results.Ok(Response<UserDto>.Success(new UserDto
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Surname = user.Surname,
                        Email = user.Email,
                        ProfileImage = user.ProfileImage,
                        CoverImage = user.CoverImage,
                        PreferredAiProvider = user.PreferredAiProvider,
                        Gender = user.Gender.ToString(),
                        Roles = roles.ToArray(),
                        CardNumber = user.CardNumber ?? string.Empty
                    }, "User fetched successfully."));
                }).RequireAuthorization();

                group.MapPost("/profile-image", async (HttpContext context, UserManager<ApplicationUser> userManager,
                    IStorageService blobService, [FromForm] IFormFile file) =>
                {
                    if (file is null || file.Length == 0)
                        return Results.BadRequest(Response<string>.Failure("File is required."));

                    if (!file.ContentType.StartsWith("image/"))
                        return Results.BadRequest(Response<string>.Failure("Only image files are allowed."));

                    var userId = context.User.GetUserId();
                    var user = await userManager.FindByIdAsync(userId.ToString());
                    if (user is null) return Results.NotFound();

                    var newUrl = await blobService.UploadFileAsync(file);
                    var oldUrl = user.ProfileImage;
                    user.ProfileImage = newUrl;
                    await userManager.UpdateAsync(user);

                    if (!string.IsNullOrEmpty(oldUrl))
                    {
                        try { await blobService.DeleteFileAsync(oldUrl); } catch { }
                    }

                    return Results.Ok(Response<string>.Success(newUrl, "Profile image updated."));
                }).DisableAntiforgery().RequireAuthorization();

                group.MapPost("/cover-image", async (HttpContext context, UserManager<ApplicationUser> userManager,
                    IStorageService blobService, [FromForm] IFormFile file) =>
                {
                    if (file is null || file.Length == 0)
                        return Results.BadRequest(Response<string>.Failure("File is required."));

                    if (!file.ContentType.StartsWith("image/"))
                        return Results.BadRequest(Response<string>.Failure("Only image files are allowed."));

                    var userId = context.User.GetUserId();
                    var user = await userManager.FindByIdAsync(userId.ToString());
                    if (user is null) return Results.NotFound();

                    var newUrl = await blobService.UploadFileAsync(file);
                    var oldUrl = user.CoverImage;
                    user.CoverImage = newUrl;
                    await userManager.UpdateAsync(user);

                    if (!string.IsNullOrEmpty(oldUrl))
                    {
                        try { await blobService.DeleteFileAsync(oldUrl); } catch { }
                    }

                    return Results.Ok(Response<string>.Success(newUrl, "Cover image updated."));
                }).DisableAntiforgery().RequireAuthorization();

                group.MapGet("/card-number", async (HttpContext context, UserManager<ApplicationUser> userManager) =>
                {
                    var userId = context.User.GetUserId()!;
                    var user = await userManager.FindByIdAsync(userId.ToString());
                    if (user == null) return Results.NotFound();

                    return Results.Ok(Response<string>.Success(user.CardNumber ?? string.Empty, "Card number fetched."));
                }).RequireAuthorization();

                group.MapPut("/card-number", async (HttpContext context, UserManager<ApplicationUser> userManager,
                    [FromBody] UpdateCardNumberDto dto) =>
                {
                    var userId = context.User.GetUserId()!;
                    var user = await userManager.FindByIdAsync(userId.ToString());
                    if (user == null) return Results.NotFound();

                    user.CardNumber = dto.CardNumber?.Trim() ?? string.Empty;
                    await userManager.UpdateAsync(user);

                    return Results.Ok(Response<string>.Success(user.CardNumber, "Card number updated."));
                }).RequireAuthorization();

                group.MapGet("/AIprovider", async (HttpContext context, UserManager<ApplicationUser> userManager) =>
                {
                    var currentLoggedInUserId = context.User.GetUserId()!;

                    var currentLoggedInUser = await userManager.Users.SingleOrDefaultAsync(x => x.Id == currentLoggedInUserId);

                    var roles = await userManager.GetRolesAsync(currentLoggedInUser!);

                    var response = new UserDto
                    {
                        Name = currentLoggedInUser!.Name,
                        Surname = currentLoggedInUser.Surname,
                        PreferredAiProvider = currentLoggedInUser.PreferredAiProvider,
                        Roles = roles.ToArray(),
                        UserCategory = currentLoggedInUser.UserCategory.ToString()
                    };

                    return Results.Ok(Response<UserDto>.Success(response!, "User fetched successfully."));
                }).RequireAuthorization();

                return group;
            }
        }
    }
