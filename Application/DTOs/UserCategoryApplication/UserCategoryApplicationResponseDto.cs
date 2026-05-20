namespace Application.DTOs.UserCategoryApplication
{
    public class UserCategoryApplicationResponseDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string ProfileImage { get; set; } = string.Empty;
        public int RequestedCategory { get; set; }
        public string RequestedCategoryName { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public List<string> DocumentUrls { get; set; } = new();
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? RejectionReason { get; set; }
    }
}
