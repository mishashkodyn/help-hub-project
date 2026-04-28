using Domain.Entities;
using Infrastructure.Data.EntityConfigurations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data

{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
            
        }
        public DbSet<Message> Messages { get; set; }
        public DbSet<PsychologistApplication> PsychologistApplications { get; set; }
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
