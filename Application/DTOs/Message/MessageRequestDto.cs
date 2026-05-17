using Domain.Entities;

namespace Application.DTOs.Message
{
    public class MessageRequestDto
    {
        public Guid Id { get; set; }
        public Guid? SenderId { get; set; }
        public Guid? ReceiverId { get; set; }
        public string? SenderName { get; set; }
        public string? Content { get; set; }
        public bool IsRead { get; set; }
        public Guid? ReplyMessageId { get; set; }
        public string? ReplyMessageContent { get; set; }
        public string? ReplyMessageSenderName { get; set; }
        public DateTime CreatedDate { get; set; }
        public List<MessageAttachment>? Attachments { get; set; }
        public int MessageType { get; set; } = 0;
        public int? CallDurationSeconds { get; set; }
    }
}
