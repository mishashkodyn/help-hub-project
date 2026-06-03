namespace Application.DTOs
{
    /// <summary>
    /// Сесія, яка очікує підтвердження оплати від адміна
    /// або завершена і ще не перерахована психологу.
    /// </summary>
    public class PendingPaymentDto
    {
        public Guid AppointmentId { get; set; }
        public Guid ClientUserId { get; set; }
        public string? ClientFirstName { get; set; }
        public string? ClientLastName { get; set; }
        public string? ClientUserName { get; set; }
        public string? ClientProfileImage { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public string ClientEmail { get; set; } = string.Empty;
        public string PsychologistName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public string AppointmentStatus { get; set; } = string.Empty;
        public string? ClientNotes { get; set; }
    }

    public class PsychologistBalanceDto
    {
        public decimal Balance { get; set; }
        public List<EarningItemDto> RecentEarnings { get; set; } = new();
    }

    public class EarningItemDto
    {
        public Guid AppointmentId { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime SessionDate { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
    }
}
