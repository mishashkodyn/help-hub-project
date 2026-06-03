# HulpHub — гайд для Claude

Платформа психологічної допомоги. Backend: .NET 8 Clean Architecture (Domain / Application /
Infrastructure / WebApi), EF Core 8 (SQL Server + SQLite), Identity + JWT, AutoMapper.
Real-time: SignalR (Chat / Notification / OnlineUsers / Session / VideoChat) + WebRTC.
AI: Deepgram (транскрипція), AiService, сховище R2/S3/Azure Blob.
Frontend: `ClientApp/` — Angular 19, Material 19, Tailwind 4, Transloco, ngx-markdown.

## Ролі та категорії користувачів
- Ролі (Identity): **Superadmin, Admin, Psychologist, User**. Окремої ролі «Client» немає — клієнт це `User`.
- «Військовий/статус» — поле `ApplicationUser.UserCategory`: `Civilian | Military | Veteran | IDP`.

## Тестові облікові записи (для входу/перевірки UI, чату, відеодзвінків)
Логіни й паролі тестових юзерів лежать у **`.claude/test-credentials.local.md`**
(файл у `.gitignore`, у репозиторій не потрапляє). **Читай цей файл, коли треба залогінитись**
для перевірки frontend, SignalR/WebRTC чи дизайну. Якщо там порожньо — попроси користувача заповнити.

## Субагенти (`.claude/agents/`)
- `backend-dev` — .NET бек (контролери, сервіси, DTO, auth), межі Clean Architecture.
- `database` — EF Core, DbContext, міграції (dual-provider SQL Server + SQLite).
- `frontend-dev` — Angular: логіка компонентів, сервіси, інтеграція з API/SignalR.
- `realtime-signalr` — SignalR-хаби та WebRTC відеочат; тестування на двох peer-сесіях.
- `design-ui` — візуальний дизайн із жорсткими анти-AI правилами.
- `i18n-translator` — переклади Transloco (en/ua), синхронізація ключів. Застосовується завжди при роботі з UI-текстами.
- `thesis-assistant` — read-only аналіз коду → текст для дипломної роботи (українською).

## Локалізація (обов'язкове правило)
Інтерфейс багатомовний (Transloco, `en` + `ua`). **Жодного хардкоду тексту в шаблонах/TS** —
будь-який видимий користувачу рядок виноситься в ключ і додається ОДРАЗУ в обидва файли
`ClientApp/src/assets/i18n/en.json` та `ua.json` (структура ключів синхронна). Коли робота
зачіпає UI-тексти — залучай агента `i18n-translator`.

## Команди
- Build backend: `dotnet build API.sln`
- Run backend: `dotnet run --project WebApi`
- Frontend: `cd ClientApp && npm start` (dev на http://localhost:4200)
- Міграції: `dotnet ef migrations add <Name> --project Infrastructure --startup-project WebApi`
