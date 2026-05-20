namespace Domain.Entities
{
    public class UserCategoryApplication
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public ApplicationUser User { get; set; } = null!;
        public UserCategory RequestedCategory { get; set; }
        public string Comment { get; set; } = string.Empty;
        public List<string> DocumentUrls { get; set; } = new();
        public UserCategoryApplicationStatus Status { get; set; } = UserCategoryApplicationStatus.Pending;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAt { get; set; }
        public Guid? ReviewedById { get; set; }
        public ApplicationUser? ReviewedBy { get; set; }
        public string? RejectionReason { get; set; }
    }

    public enum UserCategoryApplicationStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2
    }
}
