using Application.DTOs;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SpecializationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public SpecializationsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetSpecializations()
        {
            var specializations = await _context.Specializations
                .OrderBy(s => s.Name)
                .Select(s => new SpecializationDto
                {
                    Id = s.Id,
                    Name = s.Name
                })
                .ToListAsync();

            return Ok(Response<List<SpecializationDto>>.Success(specializations));
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetSpecializationsForAdmin()
        {
            var specializations = await _context.Specializations
                .OrderByDescending(s => s.Psychologists.Count)
                .Select(s => new SpecializationAdminDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    PsychologistsCount = s.Psychologists.Count,
                    ApplicationsCount = s.Applications.Where(x => x.Status == ApplicationStatus.Pending).Count()
                })
                .ToListAsync();

            return Ok(Response<List<SpecializationAdminDto>>.Success(specializations));
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateSpecialization([FromBody] CreateUpdateSpecializationDto dto)
        {
            var exists = await _context.Specializations.AnyAsync(s => s.Name.ToLower() == dto.Name.ToLower());
            if (exists)
            {
                return BadRequest(Response<string>.Failure("Specialization with this name already exists."));
            }

            var specialization = new Specialization { Name = dto.Name, CreatedAt = DateTime.UtcNow };

            _context.Specializations.Add(specialization);
            await _context.SaveChangesAsync();

            return Ok(Response<Specialization>.Success(specialization));
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSpecialization(Guid id, [FromBody] CreateUpdateSpecializationDto dto)
        {
            var specialization = await _context.Specializations.FindAsync(id);
            if (specialization == null) return NotFound(Response<string>.Failure("Not found."));

            var exists = await _context.Specializations
                .AnyAsync(s => s.Id != id && s.Name.ToLower() == dto.Name.ToLower());

            if (exists) return BadRequest(Response<string>.Failure("Name already in use."));

            specialization.Name = dto.Name;
            specialization.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(Response<Specialization>.Success(specialization));
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteSpecialization(Guid id)
        {
            var specialization = await _context.Specializations.FindAsync(id);
            if (specialization == null) return NotFound(Response<string>.Failure("Not found."));

            _context.Specializations.Remove(specialization);
            await _context.SaveChangesAsync();

            return Ok(Response<string>.Success("Deleted successfully."));
        }
    }
}
