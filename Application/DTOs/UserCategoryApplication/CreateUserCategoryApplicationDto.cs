using Microsoft.AspNetCore.Http;

namespace Application.DTOs.UserCategoryApplication
{
    public class CreateUserCategoryApplicationDto
    {
        public int RequestedCategory { get; set; }
        public string Comment { get; set; } = string.Empty;
        public IFormFileCollection? Documents { get; set; }
    }
}
