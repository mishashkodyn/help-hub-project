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
    public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
    {
        public void Configure(EntityTypeBuilder<Appointment> builder)
        {
            builder.ToTable("Appointments");

            builder.HasKey(a => a.Id);

            builder.Property(a => a.Price)
                .HasColumnType("decimal(18,2)")
                .IsRequired();

            builder.Property(a => a.Status)
                .HasConversion<string>()
                .HasMaxLength(50)
                .IsRequired();

            builder.Property(a => a.MeetingLink)
                .HasMaxLength(1000)
                .IsRequired(false);

            builder.Property(a => a.ClientNotes)
                .HasMaxLength(2000)
                .IsRequired(false);

            builder.HasOne(a => a.Psychologist)
                .WithMany(p => p.Appointments)
                .HasForeignKey(a => a.PsychologistId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(a => a.Client)
                .WithMany(u => u.ClientAppointments)
                .HasForeignKey(a => a.ClientId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
