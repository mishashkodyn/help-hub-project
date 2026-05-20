namespace Domain.Entities
{
    public class Notification
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Title { get; set; }
        public string Message { get; set; }
        public NotificationType Type { get; set; }
        public bool IsRead { get; set; }
        public DateTime ReadAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid? RelatedEntityId { get; set; }
    }

    public enum NotificationType
    {
        System = 0,
        Application = 1,
        ChatMessage = 2,
        Reminder = 3,
        UserCategoryApplication = 4
    }
}
