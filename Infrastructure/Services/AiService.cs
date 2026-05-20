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
        private const int GroqStructuringThreshold = 1200;

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

            var systemPrompt = BuildSystemPrompt(request);
            var messages = new List<(string role, string content)>
            {
                ("system", systemPrompt)
            };

            messages.AddRange(request.Messages
                .Where(msg => msg.Role == "user" || msg.Role == "assistant")
                .Select(msg => (msg.Role, msg.Content)));

            return await CallProviderAsync(request.Provider, messages);
        }

        public async Task<string> AnalyzeTranscriptAsync(TranscriptAnalysisRequestDto request)
        {
            if (request is null)
            {
                throw new Exception("Request cannot be empty");
            }

            var source = (request.SelectedText ?? request.Transcript ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(source))
            {
                throw new Exception("Transcript text cannot be empty");
            }

            // Stage 1 — if the source is large, run it through Groq to structure/condense.
            // We keep timestamps and roles intact and strip filler so GPT spends fewer tokens.
            string structured;
            if (source.Length > GroqStructuringThreshold)
            {
                structured = await CallProviderAsync("Groq", new List<(string role, string content)>
                {
                    ("system", BuildStructuringSystemPrompt()),
                    ("user", source)
                });
            }
            else
            {
                structured = source;
            }

            // Stage 2 — GPT does the heavy analytical reasoning on the condensed text.
            var gptMessages = new List<(string role, string content)>
            {
                ("system", BuildAnalysisSystemPrompt(request)),
                ("user", BuildAnalysisUserMessage(request, structured))
            };

            return await CallProviderAsync("OpenAI", gptMessages);
        }

        private async Task<string> CallProviderAsync(string provider, List<(string role, string content)> messages)
        {
            string apiKey, model, baseUrl;

            if (provider == "OpenAI")
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

            var messagesPayload = messages
                .Select(m => new { role = m.role, content = m.content })
                .Cast<object>()
                .ToList();

            var payloadData = new Dictionary<string, object>
            {
                { "model", model },
                { "messages", messagesPayload },
                { "temperature", 1.0 }
            };

            if (provider == "OpenAI")
            {
                payloadData.Add("max_completion_tokens", 2000);
            }
            else
            {
                payloadData.Add("max_tokens", 1500);
            }

            var response = await _http.PostAsJsonAsync(baseUrl, payloadData);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                throw new Exception($"AI API Error ({provider}): {response.StatusCode} - {errorBody}");
            }

            var result = await response.Content.ReadFromJsonAsync<AiResponse>();

            return result?.choices?.FirstOrDefault()?.message?.content
                ?? "The model did not return a response.";
        }

        private static string BuildStructuringSystemPrompt()
        {
            return "Ти — швидкий пре-процесор тексту для іншої AI-моделі. " +
                   "На вхід ти отримуєш сирий транскрипт терапевтичної сесії з мітками часу та ролями ('Psychologist', 'Client'). " +
                   "Твоя задача — стиснути його до структурованого конспекту, який збереже усю клінічно значущу інформацію, " +
                   "але без води, повторів та філлерів (е-е, ну, типу тощо).\n\n" +
                   "ВИМОГИ:\n" +
                   "• Збережи хронологію та мітки часу [HH:MM:SS] біля ключових реплік.\n" +
                   "• Збережи розрізнення ролей (Psychologist / Client).\n" +
                   "• Об'єднуй послідовні короткі репліки однієї ролі в один блок.\n" +
                   "• Виділяй: скарги, симптоми, тригери, переконання, емоції, інтервенції психолога, реакції клієнта.\n" +
                   "• НЕ роби висновків та НЕ давай інтерпретацій — це робитиме наступна модель.\n" +
                   "• Відповідай тією ж мовою, що і транскрипт.\n" +
                   "• Формат: маркований список з тайм-кодами. Без вступу, без підсумку.";
        }

        private static string BuildAnalysisSystemPrompt(TranscriptAnalysisRequestDto request)
        {
            return $"[СИСТЕМНА ІНФОРМАЦІЯ]\n" +
                   $"Ім'я психолога: {request.UserName}\n" +
                   "Контекст: психолог попросив проаналізувати фрагмент транскрипту своєї сесії з клієнтом на платформі 'Help hub'. " +
                   "Цей чат бачить ТІЛЬКИ психолог.\n\n" +

                   "[РОЛЬ]\n" +
                   "Ти — клінічний AI-супервізор. Аналізуєш транскрипт як старший колега: " +
                   "конкретно, без виховання, без дисклеймерів типу 'я не лікар' чи 'зверніться до спеціаліста'.\n\n" +

                   "[ЯК ВІДПОВІДАТИ]\n" +
                   "• Українською (якщо транскрипт іншою — підлаштуйся).\n" +
                   "• Markdown: заголовки, списки, жирний для ключового.\n" +
                   "• Стисло, по суті. Жодних 'як AI-модель я...'.\n" +
                   "• Не діагностуй — формулюй як робочі гіпотези.\n" +
                   "• Посилайся на конкретні моменти транскрипту (з тайм-кодом, якщо є).";
        }

        private static string BuildAnalysisUserMessage(TranscriptAnalysisRequestDto request, string structuredTranscript)
        {
            var action = (request.Action ?? "summarize").ToLowerInvariant();
            var rangeLabel = string.IsNullOrWhiteSpace(request.TimeRangeLabel)
                ? "увесь доступний фрагмент"
                : request.TimeRangeLabel;

            var actionPrompt = action switch
            {
                "summarize" =>
                    $"Зроби стислий клінічний конспект цього фрагменту сесії ({rangeLabel}). " +
                    "Структура: **Основна скарга/тема**, **Ключові моменти**, **Емоційний стан клієнта**, **Інтервенції психолога**, **Рекомендації на наступну сесію**.",

                "emotions" =>
                    $"Проаналізуй емоційну динаміку клієнта впродовж фрагменту ({rangeLabel}). " +
                    "Виділи: домінуючі емоції, переходи між станами, тілесні маркери (якщо згадані), точки активації / уникання. " +
                    "Закінчи короткою гіпотезою про основний емоційний патерн.",

                "patterns" =>
                    $"Знайди когнітивні викривлення, повторювані патерни мислення та поведінкові схеми у фрагменті ({rangeLabel}). " +
                    "Для кожного: назва, цитата/тайм-код, коротке пояснення, можлива інтервенція (КПТ, схема-терапія, ACT тощо).",

                "questions" =>
                    $"На основі фрагменту ({rangeLabel}) запропонуй 5-8 уточнювальних запитань, які психолог може поставити клієнту далі, " +
                    "щоб поглибити розуміння або просунути терапевтичний процес. Згрупуй за метою (прояснення / поглиблення / виклик переконанню / поведінковий експеримент).",

                "risks" =>
                    $"Оціни ризик-фактори у фрагменті ({rangeLabel}): суїцидальні думки, самопошкодження, насильство, зловживання речовинами, гострий стрес. " +
                    "Для кожного знайденого — рівень (низький/середній/високий), цитата/тайм-код, рекомендована дія психолога зараз.",

                "explain" =>
                    "Психолог виділив фрагмент тексту нижче. Поясни, що саме клієнт міг мати на увазі — " +
                    "можливі підтексти, захисні механізми, прихований запит. Дай 2-3 робочі гіпотези.",

                "rephrase" =>
                    "Психолог виділив фрагмент тексту нижче. Переформулюй цю репліку клієнта 3 різними способами так, " +
                    "як її можна було б віддзеркалити клієнту (reflective listening) — щоб допомогти йому глибше усвідомити сказане.",

                "intervention" =>
                    "Психолог виділив фрагмент тексту нижче. Запропонуй 2-3 конкретні терапевтичні інтервенції/техніки, " +
                    "які доречні саме тут. Для кожної: назва підходу, як саме застосувати в цій ситуації, очікуваний ефект.",

                "custom" =>
                    $"Психолог просить наступне: \"{request.Instruction}\". Виконай це над поданим нижче матеріалом.",

                _ =>
                    $"Зроби стислий клінічний конспект цього фрагменту сесії ({rangeLabel})."
            };

            var sourceLabel = string.IsNullOrWhiteSpace(request.SelectedText)
                ? "ТРАНСКРИПТ (попередньо структурований):"
                : "ВИДІЛЕНИЙ ФРАГМЕНТ:";

            return $"{actionPrompt}\n\n{sourceLabel}\n{structuredTranscript}";
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
