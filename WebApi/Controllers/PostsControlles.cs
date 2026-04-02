using Application.DTOs;
using Domain.Common;
using Domain.Entities;
using Infrastructure.Data;
using Infrastructure.Extensions;
using Infrastructure.Services;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PostsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IStorageService _storageService;

        public PostsController(ApplicationDbContext context, IStorageService storageService)
        {
            _context = context;
            _storageService = storageService;
        }

        [HttpPost]
        public async Task<IActionResult> CreatePost([FromForm] CreatePostDto dto)
        {
            var userId = User.GetUserId();

            var uploadedUrls = new List<string>();

            if (dto.MediaFiles != null && dto.MediaFiles.Any())
            {
                foreach (var file in dto.MediaFiles)
                {
                    var url = await _storageService.UploadFileAsync(file);
                    uploadedUrls.Add(url);
                }
            }

            var post = new Post
            {
                UserId = userId,
                Content = dto.Content,
                MediaUrls = uploadedUrls,
                CreatedAt = DateTime.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId);

            var responseDto = new PostResponseDto
            {
                Id = post.Id,
                Content = post.Content,
                MediaUrls = post.MediaUrls,
                CreatedAt = post.CreatedAt,
                AuthorId = userId,
                AuthorName = user!.Name + " " + user.Surname,
                AuthorAvatarUrl = user.ProfileImage,
                AuthorCategory = (int)user.UserCategory,
                LikesCount = 0,
                CommentsCount = 0,
                IsLikedByMe = false
            };

            return Ok(Response<PostResponseDto>.Success(responseDto));
        }

        [HttpGet]
        public async Task<IActionResult> GetPosts([FromQuery] int page, [FromQuery] int pageSize, [FromQuery] Guid? userId)
        {
            var currentUserId = User.GetUserId();

            var query = _context.Posts
                .AsNoTracking()
                .Include(p => p.User)
                .AsQueryable();

            if (userId.HasValue && userId.Value != Guid.Empty)
            {
                query = query.Where(x => x.UserId == userId.Value);
            }

            var posts = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PostResponseDto
                {
                    Id = p.Id,
                    Content = p.Content,
                    MediaUrls = p.MediaUrls,
                    CreatedAt = p.CreatedAt,
                    AuthorId = p.UserId,
                    AuthorName = p.User.Name + " " + p.User.Surname,
                    AuthorAvatarUrl = p.User.ProfileImage,
                    AuthorCategory = (int)p.User.UserCategory,
                    LikesCount = p.Likes.Count,
                    CommentsCount = p.Comments.Count,
                    IsLikedByMe = p.Likes.Any(l => l.UserId == currentUserId)
                })
                .ToListAsync();

            return Ok(Response<List<PostResponseDto>>.Success(posts));
        }

        [HttpPost("{id}/toggle-like")]
        public async Task<IActionResult> LikePost(Guid id)
        {
            var userId = User.GetUserId();

            if (!await _context.Posts.AnyAsync(p => p.Id == id))
                throw new Exception();

            var existingLike = await _context.PostLikes
                .FirstOrDefaultAsync(l => l.PostId == id && l.UserId == userId);

            if (existingLike != null)
            {
                _context.PostLikes.Remove(existingLike);
            }
            else
            {
                _context.PostLikes.Add(new PostLike { PostId = id, UserId = userId });
            }

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("{id}/comments")]
        public async Task<IActionResult> CreatePost(Guid id, [FromBody] CreateCommentDto dto)
        {
            var userId = User.GetUserId();

            var comment = new Comment
            {
                PostId = id,
                UserId = userId,
                Text = dto.Text,
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            var user = await _context.Users.FindAsync(userId);

            var responseDto = new CommentResponseDto
            {
                Id = comment.Id,
                Text = comment.Text,
                CreatedAt = comment.CreatedAt,
                AuthorId = userId,
                AuthorName = user!.Name + " " + user.Surname,
            };

            return Ok(Response<CommentResponseDto>.Success(responseDto));
        }

        [HttpGet("{postId}/comments")]
        public async Task<IActionResult> GetComments([FromQuery] int page, [FromQuery] int pageSize, Guid postId)
        {
            var userId = User.GetUserId();

            var comments = await _context.Comments
                .AsNoTracking()
                .Where(x => x.PostId == postId)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new CommentResponseDto
                {
                    Id = p.Id,
                    Text = p.Text,
                    CreatedAt = p.CreatedAt,
                    AuthorId = p.User.Id,
                    AuthorName = p.User.Name + " " + p.User.Surname,
                })
                .ToListAsync();

            return Ok(Response<List<CommentResponseDto>>.Success(comments));
        }
    }
}
