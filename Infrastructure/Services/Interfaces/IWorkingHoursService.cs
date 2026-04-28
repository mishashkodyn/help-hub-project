using Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Services.Interfaces
{
    public interface IWorkingHoursService
    {
        Task<UpdateWorkingHoursDto> GetWorkingHoursAsync(Guid userId);
        Task UpdateWorkingHoursAsync(Guid userId, UpdateWorkingHoursDto dto);
    }
}
