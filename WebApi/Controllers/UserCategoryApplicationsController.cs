using Application.DTOs.UserCategoryApplication;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Extensions;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserCategoryApplicationsController : ControllerBase
    {
        private readonly IUserCategoryApplicationService _service;

        public UserCategoryApplicationsController(IUserCategoryApplicationService service)
        {
            _service = service;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromForm] CreateUserCategoryApplicationDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var result = await _service.CreateAsync(userId, dto);
                return Ok(Response<UserCategoryApplicationResponseDto>.Success(result, "Application submitted."));
            }
            catch (Exception ex)
            {
                return BadRequest(Response<string>.Failure(ex.Message));
            }
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyApplication()
        {
            var userId = User.GetUserId();
            var result = await _service.GetMyLatestAsync(userId);
            return Ok(Response<UserCategoryApplicationResponseDto?>.Success(result));
        }

        [HttpGet]
        [Authorize(Roles = $"{ApplicationRole.ROLE_ADMIN},{ApplicationRole.ROLE_SUPERADMIN}")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _service.GetAllAsync();
            return Ok(Response<List<UserCategoryApplicationResponseDto>>.Success(result));
        }

        [HttpPost("{id}/review")]
        [Authorize(Roles = $"{ApplicationRole.ROLE_ADMIN},{ApplicationRole.ROLE_SUPERADMIN}")]
        public async Task<IActionResult> Review(Guid id, [FromBody] ReviewUserCategoryApplicationDto dto)
        {
            try
            {
                var reviewerId = User.GetUserId();
                var result = await _service.ReviewAsync(id, reviewerId, dto);
                return Ok(Response<UserCategoryApplicationResponseDto>.Success(result, "Application reviewed."));
            }
            catch (Exception ex)
            {
                return BadRequest(Response<string>.Failure(ex.Message));
            }
        }
    }
}
