using Domain.Entities;
using Infrastructure.Data.EntityConfigurations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Infrastructure.Data

{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
    {
        // Every DateTime persisted/read goes through UTC so client receives ISO with 'Z'.
        private static readonly ValueConverter<DateTime, DateTime> UtcConverter =
            new(v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        private static readonly ValueConverter<DateTime?, DateTime?> UtcNullableConverter =
            new(v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
            
        }
        public DbSet<Message> Messages { get; set; }
        public DbSet<SessionMessage> SessionMessages { get; set; }
        public DbSet<SessionNote> SessionNotes { get; set; }
        public DbSet<SessionTranscript> SessionTranscripts { get; set; }
        public DbSet<SessionAiMessage> SessionAiMessages { get; set; }
        public DbSet<PsychologistApplication> PsychologistApplications { get; set; }
        public DbSet<UserCategoryApplication> UserCategoryApplications { get; set; }
        public DbSet<MessageAttachment> MessageAttachments { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<Psychologist> Psychologists { get; set; }
        public DbSet<WorkingHour> WorkingHours { get; set; }
        public DbSet<Appointment> Appointments { get; set; }
        public DbSet<Specialization> Specializations { get; set; }
        public DbSet<Post> Posts { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<PostLike> PostLikes { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.ApplyConfiguration(new MessageConfiguration());
            modelBuilder.ApplyConfiguration(new ApplicationUserConfiguration());
            modelBuilder.ApplyConfiguration(new ApplicationsConfiguration());
            modelBuilder.ApplyConfiguration(new PostsConfiguration());
            modelBuilder.ApplyConfiguration(new PostLikesConfiguration());
            modelBuilder.ApplyConfiguration(new CommentsConfiguration());
            modelBuilder.ApplyConfiguration(new AppointmentConfiguration());
            modelBuilder.ApplyConfiguration(new WorkingHourConfiguration());
            modelBuilder.ApplyConfiguration(new UserCategoryApplicationConfiguration());

            modelBuilder.Entity<SessionNote>(e =>
            {
                e.HasKey(n => n.Id);
                e.HasOne(n => n.Appointment)
                    .WithMany()
                    .HasForeignKey(n => n.AppointmentId)
                    .OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(n => new { n.AppointmentId, n.PsychologistUserId }).IsUnique();
                e.Property(n => n.Content).HasMaxLength(20000);
            });

            modelBuilder.Entity<SessionTranscript>(e =>
            {
                e.HasKey(t => t.Id);
                e.HasOne(t => t.Appointment)
                    .WithMany()
                    .HasForeignKey(t => t.AppointmentId)
                    .OnDelete(DeleteBehavior.Cascade);
                e.HasOne(t => t.Sender)
                    .WithMany()
                    .HasForeignKey(t => t.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);
                e.HasIndex(t => new { t.AppointmentId, t.Timestamp });
            });

            modelBuilder.Entity<SessionAiMessage>(e =>
            {
                e.HasKey(a => a.Id);
                e.HasOne(a => a.Appointment)
                    .WithMany()
                    .HasForeignKey(a => a.AppointmentId)
                    .OnDelete(DeleteBehavior.Cascade);
                e.Property(a => a.Role).HasMaxLength(16);
                e.HasIndex(a => new { a.AppointmentId, a.PsychologistUserId, a.Timestamp });
            });

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(DateTime))
                        property.SetValueConverter(UtcConverter);
                    else if (property.ClrType == typeof(DateTime?))
                        property.SetValueConverter(UtcNullableConverter);
                }
            }

            //modelBuilder.Entity<ApplicationUser>()
            //    .HasMany(u => u.UserRoles)
            //    .WithOne(ur => ur.User)
            //    .HasForeignKey(ur => ur.UserId)
            //    .IsRequired();

            //modelBuilder.Entity<ApplicationRole>()
            //    .HasMany(r => r.Users)
            //    .WithOne()
            //    .HasForeignKey(ur => ur.RoleId)
            //    .IsRequired();
        }
    }
}
