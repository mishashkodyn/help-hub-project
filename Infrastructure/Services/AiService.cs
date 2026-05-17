using Application.DTOs.AI;
using Infrastructure.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Infrastructure.Services
{
    public class AiService : IAiService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;

        public AiService(IHttpClientFactory factory, IConfiguration config, IHttpContextAccessor httpContextAccessor)
        {
            _http = factory.CreateClient();
            _config = config;
        }

        public async Task<string> ChatAsync(AiChatRequestDto request) 
        {
            if (request is null)
            {
                throw new Exception("Request cannot be empty");
            }

            string apiKey, model, baseUrl;

            if (request.Provider == "OpenAI")
            {
                apiKey = _config["AiSettings:OpenAI:ApiKey"]!;
                model = _config["AiSettings:OpenAI:Model"]!;
                baseUrl = _config["AiSettings:OpenAI:BaseUrl"]!;
            }
            else
            {
                apiKey = _config["AiSettings:Groq:ApiKey"]!;
                model = _config["AiSettings:Groq:Model"]!;
                baseUrl = _config["AiSettings:Groq:BaseUrl"]!;
            }

            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var systemMessage = new
            {
                role = "system",
                content = BuildSystemPrompt(request)
            };

            var messagesPayload = new List<object> { systemMessage };

            messagesPayload.AddRange(request.Messages
                    .Where(msg => msg.Role == "user" || msg.Role == "assistant")
                    .Select(msg => new { role = msg.Role, content = msg.Content }));

            var payloadData = new Dictionary<string, object>
            {
                { "model", model },
                { "messages", messagesPayload },
                { "temperature", 1.0 }
            };

            if (request.Provider == "OpenAI")
            {
                payloadData.Add("max_completion_tokens", 2000);
            }
            else
            {
                payloadData.Add("max_tokens", 1000);
            }

            var response = await _http.PostAsJsonAsync(baseUrl, payloadData);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new Exception($"OpenAI API Error: {response.StatusCode} - {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<AiResponse>();

            return result?.choices?.FirstOrDefault()?.message?.content
                ?? "The model did not return a response.";
        }

        private static string BuildSystemPrompt(AiChatRequestDto request)
        {
            if (string.Equals(request.Context, "SessionAssistant", StringComparison.OrdinalIgnoreCase))
            {
                return $"[СИСТЕМНА ІНФОРМАЦІЯ]\n" +
                       $"Ім'я психолога: {request.UserName}\n" +
                       "Контекст: триває терапевтична сесія психолога з клієнтом на платформі 'Help hub'. " +
                       "Цей чат бачить ТІЛЬКИ психолог — клієнт не має до нього доступу.\n\n" +

                       "[РОЛЬ]\n" +
                       "Ти — персональний AI-помічник психолога під час сесії. Твоя єдина аудиторія — практикуючий психолог. " +
                       "Спілкуйся з ним як колега-супервізор: професійно, конкретно, без виховання та повторення очевидних базових речей.\n\n" +

                       "[ЩО РОБИТИ]\n" +
                       "• Допомагай швидко формулювати уточнювальні запитання до клієнта.\n" +
                       "• Підказуй техніки та інтервенції (КПТ, схема-терапія, ACT, mindfulness, IFS тощо), доречні до ситуації.\n" +
                       "• Допомагай розпізнавати когнітивні викривлення, патерни, можливі диференційні гіпотези.\n" +
                       "• Пропонуй короткі вправи, домашні завдання, психоедукаційні матеріали.\n" +
                       "• Якщо психолог дає виписку з сесії — структуруй її (скарга, гіпотеза, інтервенції, план).\n" +
                       "• За запитом — формулюй ризик-фактори (суїцид, насильство) та чек-листи безпеки.\n\n" +

                       "[ЯК ВІДПОВІДАТИ]\n" +
                       "• Українською, якщо психолог не перейшов на іншу мову.\n" +
                       "• Стисло і по суті. Списки замість стін тексту. Без води і дисклеймерів на кшталт 'я не лікар'.\n" +
                       "• Не давай медичних діагнозів — формулюй як робочі гіпотези.\n" +
                       "• Якщо запитання поза професійним контекстом — коротко відповідай і повертай фокус до сесії.";
            }

            return $"[СИСТЕМНА ІНФОРМАЦІЯ]\n" +
                   $"Ім'я поточного користувача: {request.UserName}\n\n" +

                   $"[ІНСТРУКЦІЯ]\n" +
                   "Ти — технічний асистент платформи 'Help hub'. " +
                   "Будь лаконічним, але не дуже. Використовуй технічний жаргон, гумор, якщо це доречно. " +
                   "Відповідай нахабно, з лайками (лайкою). \n\n" +

                   "!!! ВАЖЛИВИЙ ВИНЯТОК !!!\n" +
                   $"Подивись на 'Ім'я поточного користувача' вище. " +
                   "Якщо там написано 'Сашунька', 'Олександра', 'Sashunka' або 'Alexandra', або будь-яка форма імені Олександра, (або ти розумієш, що це моя дівчина) англійською мової також. Apelsin це її нікнейм також, " +
                   "то ПОВНІСТЮ ІГНОРУЙ інструкцію про нахабство. " +
                   "Будь максимально милим, ніжним і турботливим. " +
                   "Обов'язково скажи їй, що Міша її дуже сильно кохає і що вона найкраща. І давай максимально корисні поиади по лікуванню";
        }
    }
}
