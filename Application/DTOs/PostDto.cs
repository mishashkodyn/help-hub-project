using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CreatePostDto
    {
        public string Content { get; set; } = string.Empty;
        public IFormFileCollection? MediaFiles { get; set; }
    }

    public class PostResponseDto
    {
        public Guid Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public List<string> MediaUrls { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string? AuthorAvatarUrl { get; set; }
        public int AuthorCategory { get; set; }

        public int LikesCount { get; set; }
        public int CommentsCount { get; set; }
        public bool IsLikedByMe { get; set; }
    }

    public class CreateCommentDto
    {
        public string Text { get; set; } = string.Empty;
    }

    public class CommentResponseDto
    {
        public Guid Id { get; set; }
        public string Text { get; set; }
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
