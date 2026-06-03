namespace Application.DTOs
{
    /// <summary>
    /// Повертається клієнту після бронювання сесії.
    /// Якщо IsFree = true — сесія безкоштовна (військовий/ветеран), вже підтверджена.
    /// Інакше — треба оплатити на PlatformCardNumber.
    /// </summary>
    public class BookingResultDto
    {
        public Guid AppointmentId { get; set; }
        public bool IsFree { get; set; }
        public decimal Amount { get; set; }
        public string PlatformCardNumber { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string AppointmentStatus { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public string PsychologistName { get; set; } = string.Empty;
    }
}
