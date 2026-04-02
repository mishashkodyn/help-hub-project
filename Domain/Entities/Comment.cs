using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entities
{
    public class Comment
    {
        public Guid Id { get; set; }

        public Guid PostId { get; set; }
        public Post Post { get; set; }

        public Guid UserId { get; set; }
        public ApplicationUser User { get; set; }

        public string Text { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
