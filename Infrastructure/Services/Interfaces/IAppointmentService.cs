using Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Services.Interfaces
{
    public interface IAppointmentService
    {
        Task<List<DateTime>> GetAvailableSlotsAsync(Guid psychologistId, DateTime localDate);
        Task<BookingResultDto> CreateAppointmentAsync(Guid clientId, CreateAppointmentDto dto);
        Task<List<AppointmentApplicationDto>> GetPsychologistApplicationsAsync(Guid userId);
        Task ApproveAppointmentAsync(Guid psychologistUserId, Guid appointmentId);
        Task DeclineAppointmentAsync(Guid psychologistUserId, Guid appointmentId);
        Task<List<ClientSessionDto>> GetClientSessionsAsync(Guid clientId);
        Task<List<ClientSessionDto>> GetPsychologistSessionsAsync(Guid psychologistUserId);
        Task<SessionInfoDto> GetSessionInfoAsync(Guid appointmentId, Guid requestingUserId);
        Task<List<PastSessionDto>> GetPsychologistPastSessionsAsync(Guid psychologistUserId);
        Task<SessionNoteDto?> GetSessionNoteAsync(Guid appointmentId, Guid psychologistUserId);
        Task<SessionNoteDto> UpsertSessionNoteAsync(Guid appointmentId, Guid psychologistUserId, string content);
        Task<List<SessionMessageDto>> GetSessionMessagesAsync(Guid appointmentId, Guid psychologistUserId);
        Task<List<SessionTranscriptDto>> GetSessionTranscriptsAsync(Guid appointmentId, Guid psychologistUserId);
        Task<List<SessionAiMessageDto>> GetSessionAiMessagesAsync(Guid appointmentId, Guid psychologistUserId);
        Task<List<SessionAiMessageDto>> SaveSessionAiMessagesAsync(Guid appointmentId, Guid psychologistUserId, List<SaveAiMessageDto> messages);

        Task CancelByClientAsync(Guid clientId, Guid appointmentId);

        // ── Payment flow ─────────────────────────────────────────────────────
        Task<List<PendingPaymentDto>> GetPendingPaymentsAsync();
        Task ConfirmPaymentAsync(Guid appointmentId);
        Task RejectPaymentAsync(Guid appointmentId, string? reason);
        Task<List<PendingPaymentDto>> GetCompletedUnpaidSessionsAsync();
        Task ReleasePaymentToPsychologistAsync(Guid appointmentId);
        Task<PsychologistBalanceDto> GetPsychologistBalanceAsync(Guid psychologistUserId);
    }
}
