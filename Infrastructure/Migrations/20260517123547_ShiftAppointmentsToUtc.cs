using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace API.Migrations
{
    /// <inheritdoc />
    public partial class ShiftAppointmentsToUtc : Migration
    {
        // Pre-UTC switchover, StartTime/EndTime were stored as Kyiv local time with Kind=Unspecified.
        // Re-interpret them as Europe/Kyiv local and convert to UTC (DST-aware via AT TIME ZONE).
        // Other tables already used DateTime.UtcNow (or DateTime.Now on a UTC-locale Linux container,
        // which is equivalent), so they are not shifted here.

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE Appointments
                SET StartTime = CAST(StartTime AT TIME ZONE 'FLE Standard Time' AT TIME ZONE 'UTC' AS datetime2),
                    EndTime   = CAST(EndTime   AT TIME ZONE 'FLE Standard Time' AT TIME ZONE 'UTC' AS datetime2);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE Appointments
                SET StartTime = CAST(StartTime AT TIME ZONE 'UTC' AT TIME ZONE 'FLE Standard Time' AS datetime2),
                    EndTime   = CAST(EndTime   AT TIME ZONE 'UTC' AT TIME ZONE 'FLE Standard Time' AS datetime2);
            ");
        }
    }
}
