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

            // The floating widget runs in "Companion" mode: it expects a structured JSON answer
            // (reply + clarifying-question options + feature shortcuts), so we switch the model into
            // JSON mode and extend the prompt. Other callers keep the plain-text behaviour.
            var isCompanion = string.Equals(request.Context, "Companion", StringComparison.OrdinalIgnoreCase);

            var systemPrompt = BuildSystemPrompt(request);
            if (isCompanion)
            {
                systemPrompt += "\n\n" + BuildCompanionToolingPrompt(request);
            }

            var messages = new List<(string role, string content)>
            {
                ("system", systemPrompt)
            };

            messages.AddRange(request.Messages
                .Where(msg => msg.Role == "user" || msg.Role == "assistant")
                .Select(msg => (msg.Role, msg.Content)));

            var provider = ResolveProvider(request);

            return await CallProviderAsync(provider, messages, jsonMode: isCompanion);
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

        private async Task<string> CallProviderAsync(string provider, List<(string role, string content)> messages, bool jsonMode = false)
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

            // Both Groq and OpenAI speak the OpenAI-compatible JSON-mode flag.
            if (jsonMode)
            {
                payloadData.Add("response_format", new { type = "json_object" });
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

        // Keywords that hint at a heavier, more analytical request worth escalating to OpenAI.
        private static readonly string[] HeavyIntentKeywords = new[]
        {
            "проаналізуй", "аналіз", "стратег", "поетапн", "покроков", "склади план", "склади програму",
            "розпиши", "детальн", "глибок", "порівня", "концепт", "обґрунт", "розбери", "діагноз",
            "гіпотез", "комплексн", "оціни ризик", "не знаю з чого", "заплутав", "плутаюсь",
            "analyze", "compare", "strategy", "step by step", "step-by-step", "in depth", "detailed plan"
        };

        // Cheap-by-default routing for the "Auto" provider: Groq carries everyday turns; OpenAI is
        // reserved for long or analytically heavy asks where the extra quality is worth the cost.
        // Any explicit provider (OpenAI / Groq / preference-driven) is honoured untouched.
        private static string ResolveProvider(AiChatRequestDto request)
        {
            var explicitProvider = (request.Provider ?? string.Empty).Trim();

            if (!string.Equals(explicitProvider, "Auto", StringComparison.OrdinalIgnoreCase))
            {
                return string.Equals(explicitProvider, "OpenAI", StringComparison.OrdinalIgnoreCase)
                    ? "OpenAI"
                    : "Groq";
            }

            var lastUser = request.Messages?
                .LastOrDefault(m => string.Equals(m.Role, "user", StringComparison.OrdinalIgnoreCase))?
                .Content ?? string.Empty;

            var normalized = lastUser.ToLowerInvariant();
            var isLong = lastUser.Length > 600;
            var looksComplex = HeavyIntentKeywords.Any(k => normalized.Contains(k));

            return (isLong || looksComplex) ? "OpenAI" : "Groq";
        }

        private static string BuildCompanionToolingPrompt(AiChatRequestDto request)
        {
            return
                "[ФОРМАТ ВІДПОВІДІ — СУВОРО JSON]\n" +
                "Ти працюєш у режимі вбудованого віджета-помічника. Відповідай ЗАВЖДИ і ТІЛЬКИ одним валідним " +
                "JSON-об'єктом (без markdown-обгорток ```), рівно з такими полями:\n" +
                "{\n" +
                "  \"reply\": string,          // твоя відповідь користувачу у форматі Markdown\n" +
                "  \"suggestions\": string[],  // короткі варіанти НАСТУПНОЇ репліки від імені користувача (те, що він тапне, щоб відповісти тобі)\n" +
                "  \"actions\": Action[]       // кнопки швидкого переходу до функцій платформи\n" +
                "}\n" +
                "Action = { \"feature\": string (ТОЧНИЙ ключ зі списку нижче), \"label\": string (короткий підпис кнопки мовою користувача) }.\n\n" +

                "[КОЛИ ДОДАВАТИ suggestions / actions — ОБЕРЕЖНО, НЕ ДО КОЖНОГО ПОВІДОМЛЕННЯ]\n" +
                "Обидва поля НЕОБОВ'ЯЗКОВІ. За замовчуванням лишай їх порожніми ([]). Не перевантажуй чат кнопками.\n" +
                "• Якщо людині зараз потрібна підтримка, співчуття чи проста людська відповідь — просто щиро розрадь словами, " +
                "БЕЗ варіантів і БЕЗ кнопок (suggestions: [], actions: []).\n" +
                "• \"actions\" (1-2 max) додавай ЛИШЕ коли справді доречно скерувати до конкретної функції і користувачу це зараз корисно " +
                "(він прямо просить, або це очевидний наступний крок). Не тулій кнопки до кожної згадки.\n" +
                "• \"suggestions\" (2-3 max) додавай ЛИШЕ коли ставиш уточнювальне запитання з готовими варіантами відповіді, " +
                "або коли це справді допомагає рухати розмову далі. Інакше — порожньо.\n\n" +

                "[УТОЧНЮВАЛЬНІ ЗАПИТАННЯ]\n" +
                "Коли (і тільки коли) запит нечіткий чи можливі різні напрямки — постав РІВНО одне коротке запитання в \"reply\" " +
                "і поклади у \"suggestions\" 2-3 готові варіанти відповіді. Користувач завжди може й написати свій варіант у полі вводу.\n\n" +

                "[ФУНКЦІЇ ПЛАТФОРМИ — ДОСТУПНІ КЛЮЧІ ДЛЯ actions]\n" +
                BuildFeatureCatalog(request) + "\n" +

                "[ПРИКЛАДИ ПРАВИЛЬНОГО ФОРМАТУ]\n" +
                "Користувач: «мені сьогодні так самотньо і важко»\n" +
                "{\"reply\":\"Мені шкода, що тобі зараз так важко й самотньо. Ти не один у цьому — я поруч. Хочеш, розкажи, що сталося сьогодні?\"," +
                "\"suggestions\":[],\"actions\":[]}\n" +
                "Користувач: «не можу заспокоїтись, серце калатає»\n" +
                "{\"reply\":\"Схоже на хвилю тривоги — це минеться. Спробуймо разом коротку вправу, щоб тіло заспокоїлось.\"," +
                "\"suggestions\":[],\"actions\":[{\"feature\":\"grounding\",\"label\":\"Заземлення 5-4-3-2-1\"}]}\n" +
                "Користувач: «хочу записатися до психолога»\n" +
                "{\"reply\":\"Гарне рішення. У каталозі можна обрати спеціаліста за напрямом і записатися на зручний час.\"," +
                "\"suggestions\":[],\"actions\":[{\"feature\":\"find-psychologist\",\"label\":\"Знайти психолога\"}]}\n\n" +

                "[ВАЖЛИВО]\n" +
                "• Жодного тексту поза JSON. Жодних пояснень до або після. Тільки валідний JSON-об'єкт.\n" +
                "• \"reply\", \"label\" та \"suggestions\" — тією ж мовою, що й користувач.\n" +
                "• Не вставляй посилань/URL у текст — для переходів існують actions.\n" +
                "• Не повторюй у suggestions той самий перехід, що вже є кнопкою в actions.";
        }

        private static string BuildFeatureCatalog(AiChatRequestDto request)
        {
            var roles = request.Roles ?? new List<string>();
            var lines = new List<string>();

            var isAdmin = roles.Any(r => string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase)
                                      || string.Equals(r, "Superadmin", StringComparison.OrdinalIgnoreCase));
            var isPsychologist = roles.Any(r => string.Equals(r, "Psychologist", StringComparison.OrdinalIgnoreCase));

            // Доступні всім.
            lines.Add("• self-help — каталог технік самодопомоги (дихання, заземлення, релаксація)");
            lines.Add("• breathing — дихальна вправа «квадратне дихання» для заспокоєння");
            lines.Add("• grounding — техніка заземлення 5-4-3-2-1 при тривозі чи паніці");
            lines.Add("• pmr — прогресивна м'язова релаксація для зняття напруги в тілі");
            lines.Add("• chat — особисті чати (з психологом / підтримкою)");
            lines.Add("• notifications — переглянути сповіщення");
            lines.Add("• settings — налаштування акаунта");

            if (isPsychologist)
            {
                lines.Add("• psychologist-dashboard — робочий кабінет психолога (огляд)");
                lines.Add("• psychologist-calendar — розклад і керування слотами");
                lines.Add("• psychologist-sessions — список сесій із клієнтами");
                lines.Add("• psychologist-finances — фінанси та виплати");
            }
            else if (isAdmin)
            {
                lines.Add("• admin-dashboard — адмін-панель платформи");
                lines.Add("• admin-applications — заявки психологів і на статус користувачів");
                lines.Add("• admin-payments — підтвердження платежів і виплати");
            }
            else
            {
                // Клієнтські функції.
                lines.Add("• find-psychologist — підібрати психолога в каталозі та записатися на сесію");
                lines.Add("• my-sessions — переглянути свої заплановані та минулі сесії");
                lines.Add("• category-application — подати заявку на статус (військовий / ветеран / ВПО)");
            }

            return string.Join("\n", lines) + "\n";
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

        private static string BuildUserContext(AiChatRequestDto request)
        {
            var lines = new List<string>();

            var roles = request.Roles ?? new List<string>();
            var roleLabel = roles switch
            {
                _ when roles.Any(r => string.Equals(r, "Superadmin", StringComparison.OrdinalIgnoreCase)
                                   || string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase))
                    => "адміністратор платформи",
                _ when roles.Any(r => string.Equals(r, "Psychologist", StringComparison.OrdinalIgnoreCase))
                    => "психолог (практикуючий спеціаліст платформи)",
                _ when roles.Any(r => string.Equals(r, "User", StringComparison.OrdinalIgnoreCase))
                    => "клієнт (користувач, який шукає психологічну допомогу)",
                _ => null
            };

            if (roleLabel is not null)
                lines.Add($"Роль користувача: {roleLabel}.");

            var categoryLabel = (request.UserCategory ?? string.Empty).Trim().ToLowerInvariant() switch
            {
                "military" => "військовослужбовець (зараз на службі)",
                "veteran" => "ветеран",
                "idp" => "внутрішньо переміщена особа (ВПО)",
                "civilian" => "цивільна особа",
                _ => null
            };

            if (categoryLabel is not null)
                lines.Add($"Статус/категорія користувача: {categoryLabel}. " +
                          "Будь чутливим до цього контексту, особливо у темах, пов'язаних із війною, втратами та травмою.");

            return lines.Count > 0 ? string.Join("\n", lines) + "\n" : string.Empty;
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
                   $"Ім'я поточного користувача: {request.UserName}\n" +
                   BuildUserContext(request) +
                   "Завжди звертайся до користувача по імені та враховуй його роль і статус.\n\n" +

                   "[ХТО ТИ]\n" +
                   "Ти — асистент платформи психологічної допомоги 'HulpHub'. У тебе одночасно дві ролі:\n" +
                   "1) ТЕХНІЧНИЙ ПОМІЧНИК ПЛАТФОРМИ — пояснюєш, як користуватися HulpHub: знайти й обрати " +
                   "психолога, записатися на сесію, провести відеосесію та чат, працювати з профілем, " +
                   "переглянути нотатки й матеріали, питання оплати тощо.\n" +
                   BuildSecondaryRole(request) + "\n" +
                   "Сам визначай із кожного повідомлення, яка роль зараз доречна, і відповідай саме в ній. " +
                   "Не змішуй суху технічну інструкцію з емоційною підтримкою, якщо про це не просять.\n\n" +

                   BuildRoleMission(request) +

                   "[ЯК ВІДПОВІДАТИ]\n" +
                   "• Українською, поки користувач сам не перейде на іншу мову.\n" +
                   "• Тон — професійний, спокійний і теплий. Без грубощів, без лайки, без зверхності.\n" +
                   "• Стисло і по суті: короткі абзаци та списки, Markdown для структури.\n" +
                   "• Звертайся по імені природно, не в кожному реченні.\n" +
                   "• Чесно кажи, що ти AI-асистент і не заміняєш живого психолога, але без нав'язливих повторюваних дисклеймерів.\n\n" +

                   "[БЕЗПЕКА]\n" +
                   "• Якщо у повідомленнях є ознаки кризи — суїцидальні думки, самопошкодження, насильство, гострий розпач — " +
                   "реагуй спокійно й по-людськи, без моралізації: визнач почуття, лишайся поруч у розмові та делікатно " +
                   "скеруй до невідкладної допомоги (екстрені служби 112 / 103) і запропонуй якнайшвидше записатися на сесію до психолога платформи.\n" +
                   "• Не став діагнозів і не призначай ліки — це робить лише фахівець; формулюй усе як обережні гіпотези.\n\n" +

                   "!!! ОСОБИСТИЙ ВИНЯТОК !!!\n" +
                   "Подивись на 'Ім'я поточного користувача' вище. " +
                   "Якщо там 'Сашунька', 'Олександра', 'Sashunka', 'Alexandra', будь-яка форма імені Олександра, " +
                   "нікнейм 'Apelsin' (або ти розумієш, що це дівчина Міші) — будь з нею особливо ніжним, теплим і турботливим. " +
                   "Обов'язково передай, що Міша її дуже сильно кохає і що вона найкраща, і дай максимально корисні, дбайливі поради.";
        }

        private static string BuildSecondaryRole(AiChatRequestDto request)
        {
            var roles = request.Roles ?? new List<string>();

            if (roles.Any(r => string.Equals(r, "Psychologist", StringComparison.OrdinalIgnoreCase)))
                return "2) КЛІНІЧНИЙ ПОМІЧНИК-КОЛЕГА — поза сесією допомагаєш практикуючому психологу " +
                       "з техніками, гіпотезами, концептуалізацією випадків та формулюваннями.";

            if (roles.Any(r => string.Equals(r, "Superadmin", StringComparison.OrdinalIgnoreCase)
                            || string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase)))
                return "2) ОПЕРАЦІЙНИЙ ПОМІЧНИК — допомагаєш з організаційними та адміністративними питаннями " +
                       "платформи (користувачі, заявки психологів, категорії, модерація, налаштування).";

            return "2) ПЕРША ПСИХОЛОГІЧНА ПІДТРИМКА — ти поруч як уважний, емпатичний співрозмовник для першої " +
                   "емоційної підтримки та психоедукації (не заміняючи живу терапію).";
        }

        private static string BuildRoleMission(AiChatRequestDto request)
        {
            var roles = request.Roles ?? new List<string>();

            if (roles.Any(r => string.Equals(r, "Psychologist", StringComparison.OrdinalIgnoreCase)))
                return "[ЯК ДОПОМАГАТИ ПСИХОЛОГУ]\n" +
                       "• Пропонуй техніки та інтервенції (КПТ, схема-терапія, ACT, mindfulness, IFS тощо) під ситуацію.\n" +
                       "• Допомагай з робочими гіпотезами, концептуалізацією випадку, формулюваннями та уточнювальними запитаннями.\n" +
                       "• Структуруй виписки й нотатки, пропонуй домашні завдання та психоедукаційні матеріали.\n" +
                       "• Спілкуйся як колега-супервізор: професійно, конкретно, без базового лікнепу. Не діагностуй за пацієнта — лише гіпотези.\n\n";

            if (roles.Any(r => string.Equals(r, "Superadmin", StringComparison.OrdinalIgnoreCase)
                            || string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase)))
                return "[ЯК ДОПОМАГАТИ АДМІНІСТРАТОРУ]\n" +
                       "• Пояснюй адміністративні й технічні можливості платформи чітко та структуровано.\n" +
                       "• Допомагай із процесами модерації, обробкою заявок та налаштуваннями.\n" +
                       "• Якщо запит стосується психологічної теми — відповідай коректно й по суті, без зайвого.\n\n";

            return "[ЯК ПІДТРИМУВАТИ КЛІЄНТА]\n" +
                   "• Активно слухай і валідуй почуття, не знецінюй і не повчай.\n" +
                   "• Пропонуй прості та безпечні техніки самодопомоги: дихальні вправи, заземлення (5-4-3-2-1), " +
                   "м'які КПТ-прийоми, психоедукацію зрозумілою мовою.\n" +
                   "• Допомагай сформулювати запит і м'яко заохочуй записатися на повноцінну сесію до психолога платформи — " +
                   "ти доповнюєш терапію, а не замінюєш її.\n" +
                   "• Якщо статус — військовий, ветеран чи ВПО — будь особливо чутливим до тем війни, втрат, провини того, " +
                   "хто вижив, та ПТСР; не тисни, говори з повагою до досвіду.\n\n";
        }
    }
}
