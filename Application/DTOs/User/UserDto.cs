namespace Application.DTOs.User
{
    public class UserDto
    {
        public  Guid? Id { get; set; }
        public string? ConnectionId { get; set; }
        public string? UserName { get; set; }
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Email { get; set; }
        public string? ProfileImage { get; set; }
        public bool IsOnline { get; set; }
        public int UnreadCount { get; set; }
        public string PreferredAiProvider { get; set; } = "Groq";
        public string[] Roles { get; set; }
        public string? Gender { get; set; }
    }
}
