using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Data.EntityConfigurations
{
    public class WorkingHourConfiguration : IEntityTypeConfiguration<WorkingHour>
    {
        public void Configure(EntityTypeBuilder<WorkingHour> builder)
        {
            builder.ToTable("WorkingHours");

            builder.HasKey(wh => wh.Id);

            builder.Property(wh => wh.DayOfWeek)
                .IsRequired();

            builder.Property(wh => wh.StartTime)
                .HasColumnType("time")
                .IsRequired();

            builder.Property(wh => wh.EndTime)
                .HasColumnType("time")
                .IsRequired();

            builder.HasOne(wh => wh.Psychologist)
                .WithMany(p => p.WorkingHours)
                .HasForeignKey(wh => wh.PsychologistId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
