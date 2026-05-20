using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EntityConfigurations
{
    public class UserCategoryApplicationConfiguration : IEntityTypeConfiguration<UserCategoryApplication>
    {
        public void Configure(EntityTypeBuilder<UserCategoryApplication> builder)
        {
            builder.HasKey(a => a.Id);

            builder
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder
                .HasOne(a => a.ReviewedBy)
                .WithMany()
                .HasForeignKey(a => a.ReviewedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Property(a => a.Comment).HasMaxLength(2000);
            builder.Property(a => a.RejectionReason).HasMaxLength(2000);
        }
    }
}
