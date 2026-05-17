using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Infrastructure.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class DeepgramService : IDeepgramService
    {
        private const string DeepgramApiBase = "https://api.deepgram.com/v1";
        private static string? _cachedProjectId;
        private static readonly SemaphoreSlim _projectLock = new(1, 1);

        private readonly HttpClient _http;
        private readonly string _masterKey;
        private readonly ILogger<DeepgramService> _logger;

        public DeepgramService(IHttpClientFactory factory, IConfiguration config, ILogger<DeepgramService> logger)
        {
            _http = factory.CreateClient();
            _masterKey = config["Deepgram:SecretKey"]
                ?? throw new InvalidOperationException("Deepgram:SecretKey is not configured.");
            _logger = logger;
        }

        public async Task<string> CreateTemporaryKeyAsync(int ttlSeconds = 60)
        {
            var projectId = await GetProjectIdAsync();

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{DeepgramApiBase}/projects/{projectId}/keys");
            req.Headers.Authorization = new AuthenticationHeaderValue("Token", _masterKey);
            req.Content = JsonContent.Create(new
            {
                comment = "session-transcription",
                scopes = new[] { "usage:write" },
                time_to_live_in_seconds = ttlSeconds
            });

            using var res = await _http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                _logger.LogError("Deepgram CreateKey failed: {Status} {Body}", res.StatusCode, body);
                throw new HttpRequestException($"Deepgram CreateKey failed: {res.StatusCode}");
            }

            var created = await res.Content.ReadFromJsonAsync<DeepgramKeyResponse>()
                ?? throw new InvalidOperationException("Deepgram returned empty key payload.");

            return created.Key;
        }

        private async Task<string> GetProjectIdAsync()
        {
            if (!string.IsNullOrEmpty(_cachedProjectId)) return _cachedProjectId!;

            await _projectLock.WaitAsync();
            try
            {
                if (!string.IsNullOrEmpty(_cachedProjectId)) return _cachedProjectId!;

                using var req = new HttpRequestMessage(HttpMethod.Get, $"{DeepgramApiBase}/projects");
                req.Headers.Authorization = new AuthenticationHeaderValue("Token", _masterKey);

                using var res = await _http.SendAsync(req);
                if (!res.IsSuccessStatusCode)
                {
                    var body = await res.Content.ReadAsStringAsync();
                    _logger.LogError("Deepgram ListProjects failed: {Status} {Body}", res.StatusCode, body);
                    throw new HttpRequestException($"Deepgram ListProjects failed: {res.StatusCode}");
                }

                var projects = await res.Content.ReadFromJsonAsync<DeepgramProjectsResponse>()
                    ?? throw new InvalidOperationException("Deepgram returned no projects.");

                var project = projects.Projects?.FirstOrDefault()
                    ?? throw new InvalidOperationException("No Deepgram project found for the configured key.");

                _cachedProjectId = project.ProjectId;
                return _cachedProjectId!;
            }
            finally
            {
                _projectLock.Release();
            }
        }

        private sealed class DeepgramKeyResponse
        {
            [JsonPropertyName("key")] public string Key { get; set; } = string.Empty;
            [JsonPropertyName("api_key_id")] public string? ApiKeyId { get; set; }
        }

        private sealed class DeepgramProjectsResponse
        {
            [JsonPropertyName("projects")] public List<DeepgramProject>? Projects { get; set; }
        }

        private sealed class DeepgramProject
        {
            [JsonPropertyName("project_id")] public string ProjectId { get; set; } = string.Empty;
        }
    }
}
