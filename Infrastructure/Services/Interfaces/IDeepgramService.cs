namespace Infrastructure.Services.Interfaces
{
    public interface IDeepgramService
    {
        Task<string> CreateTemporaryKeyAsync(int ttlSeconds = 60);
    }
}
