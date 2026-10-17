# Онлайн-просмотр ОРБИТЫ

## Обычный сайт

Опубликованный сайт: **https://ddintsen.github.io/-/**.

Первоначальная настройка уже выполнена владельцем. Для нового репозитория/повторной настройки один раз в [Settings → Pages](https://github.com/ddintsen/-/settings/pages) выберите **Build and deployment → Source → GitHub Actions**. Настройка должна быть доступна владельцу репозитория; если GitHub показывает ограничение тарифа или прав, публикация Pages этим аккаунтом пока недоступна. Публичность репозитория автоматически не меняется.

После настройки каждый push в main запускает [Publish ORBITA](https://github.com/ddintsen/-/actions/workflows/pages.yml). При необходимости выберите **Run workflow → main** либо повторите неудачный deploy. Публикация подтверждена только после зелёного deploy и открывающегося сайта. Настроенный workflow сам по себе не подтверждает развёртывание.

Workflow использует Node 22, npm ci, проверку типов/токенов/unit, production build и официальные GitHub Pages actions. Дополнительных секретов проекта не требуется. Официальный configure-pages не умеет впервые включать Pages с обычным GITHUB_TOKEN: это начальная настройка владельца, а не причина просить пользователя передать токен.

Проектный base — `/-/`, задаётся VITE_BASE_PATH. CSS-ресурсы, PWA manifest/service worker, ссылка на обзор и XR controller profiles учитывают этот путь. Навигация использует query parameters, поэтому отдельные server rewrites для вкладок не нужны. API остаётся внешним GET-источником; по умолчанию доступны явно помеченные демоданные.

Если сохранённая старая PWA показывает «Всё в поле зрения.», recovery-переход после публикации исправления: **https://ddintsen.github.io/-/?orbita-update=1**. Он обновляет выбранную вкладку без удаления demo/config; актуальный обзор имеет h1 «Обзор», без eyebrow и декоративной нумерации. Старый worker мог обслуживать cached index даже при query, поскольку prompt не имел UI применения. Новый worker однократно мигрирует этот протокол. Следующие сборки показывают «Обновить приложение», применяются явно и не перезагружают другие вкладки. Регрессия `npm run test:update` после production build требует историю commit552750e (CI fetch-depth:0), браузер и локальный HTTP server; она воспроизводит реальный старый кэш и последующий обычный update. Артефакт CI — orbita-update-smoke, отдельный от live smoke.

## StackBlitz: публичная main

Пользователь сообщил «сделал паблик» 17 октября 2026. Анонимные GET страницы https://github.com/ddintsen/- и raw main/.stackblitzrc вернули HTTP 200: прежняя закрытость больше не является препятствием чтению GitHub.

[Повторить импорт main в StackBlitz](https://stackblitz.com/github/ddintsen/-/tree/main?view=preview&startScript=dev). Откройте эту ссылку в новой вкладке, дождитесь установки npm-зависимостей и автоматического запуска, затем смотрите Preview. Явная ветка main и startScript=dev указаны в URL. Для следующих обновлений нужно заново импортировать свежую main; сохранённая копия не является live mirror cloud workspace.

Доступность исходников не подтверждает полный запуск StackBlitz: cloud-сеть по-прежнему отвечает CONNECT 403 для его домена. Пользователю задан вопрос о результате открытия. Публичный репозиторий также сам по себе не означает опубликованный HTTPS-сайт для Quest; состояние Pages проверяется отдельно.

## StackBlitz: импорт файлами

Исторически до изменения публичности GitHub import возвращал Repository not found; CI подтверждал private/main. После явного изменения пользователем и проверки HTTP 200 этот барьер снят. Файловый импорт остаётся дополнительным вариантом, независимым от чтения GitHub сервисом.

1. Получите **orbita-stackblitz.html** из artifact **orbita-stackblitz** успешного build в [Actions](https://github.com/ddintsen/-/actions/workflows/pages.yml), либо создайте файл командой `npm run export:stackblitz`.
2. Откройте HTML в обычном браузере и нажмите **Открыть проект в StackBlitz**. Кнопка передаст исходники непосредственно StackBlitz через официальный POST /run с template=node.
3. Дождитесь установки npm-зависимостей и запуска, затем смотрите Preview. Сохранение постоянного проекта может потребовать входа в StackBlitz.

Экспорт содержит рабочие файлы приложения, mock, конфигурацию и lockfile; не включает .git, .env, документы источника, историю, секреты и node_modules. SDK принимает только текст, поэтому три PNG передаются base64 и восстанавливаются в исходные байты перед запуском Vite. Фон, иконки и приложение при этом сохраняются. Изменений в основном приложении для этого не требуется.

Это снимок с sourceCommit в PREVIEW_VERSION.json. Для следующей версии создаётся новый экспорт; saved fork и открытая сессия не являются живой копией cloud workspace. Не обещается автоматическая обратная запись в GitHub.

Локально проверяются восстановление PNG, сборка именно экспортированных файлов и настоящий POST браузера с перехватом на тестовой стороне, включая кириллицу и экранирование исходников. Внешняя загрузка проекта в StackBlitz не проверена: cloud-сеть возвращает CONNECT 403. Файл импорта не является уже созданным hosted URL. Формат проверен по официальному @stackblitz/sdk 1.11.1 (MIT, https://github.com/stackblitz/sdk); новой зависимости в приложение нет.

### Готовые загрузки для проверенной сборки

Сборка коммита 8a96e4f в run 39011423496 успешна, оба artifacts созданы:

- [Скачать импорт в StackBlitz](https://github.com/ddintsen/-/actions/runs/39011423496/artifacts/12091939954) — ZIP с orbita-stackblitz.html.
- [Скачать готовый HTML-просмотр](https://github.com/ddintsen/-/actions/runs/39011423496/artifacts/12092918111) — ZIP с orbita-preview.html.

Загрузка Actions artifacts может потребовать входа в GitHub. Загрузки имеют стандартный срок хранения Actions и представляют конкретную версию; для новых изменений используйте artifacts новой сборки. Это ссылки на файлы, а не на запущенный сайт.

## Переносимый просмотр

`npm run build:preview` создаёт `standalone-dist/orbita-preview.html` с кодом, данными, шрифтами и фоном внутри файла. GitHub workflow прикладывает его как artifact `orbita-preview`. `npm run test:preview` проверяет самодостаточность через HTTP: 10 дашбордов, фокус, навигация, WebGL, ноль дополнительных внешних запросов. Прямую навигацию file:// управляемый Chromium в cloud блокирует политикой администратора, поэтому она здесь не объявляется проверенной. WebXR на Quest требует доверенного HTTPS.

## Фактическая проверка из cloud

- Production build по /-/ проверяется локальным preview и `PREVIEW_URL=.../-/ npm run test:production`: контролируемый service worker, manifest, controller profiles, новый фон, все 10 карточек и WebGL в offline.
- GitHub API и github.io в текущей среде возвращают Forbidden / CONNECT 403. Даже запуск разрешённой эскалацией не дал доступа к API. Это не доказывает, что сайт недоступен в браузере пользователя.
- Анонимный HTTP-запрос страницы репозитория вернул 404; доступ через настроенный Git proxy работает. Исторически CI подтвердил private; затем пользователь изменил видимость, и анонимный GET дал 200. Тариф не установлен.

## Статус без доступа к API из cloud

Jobs `inspect` и `receipt` сохраняют `deployment-status.json` в служебной ветке [deployment-status](https://github.com/ddintsen/-/blob/deployment-status/deployment-status.json). Фаза preflight — состояние до deploy; complete содержит buildResult/deployResult. sourceCommit связывает отчёт с исходным коммитом. Чтение: `git fetch origin deployment-status`, затем `git show FETCH_HEAD:deployment-status.json` без переключения main.

Проверяются API Pages, HTML по ожидаемому адресу и до четырёх same-origin JS/CSS. Токен передаётся только api.github.com; сайт и отчёт его не получают. Запись ветки использует отдельные permissions contents:write и обычный push без force. Она не запускает новый workflow main. Доступность HTML/ресурсов сама по себе не подтверждает deploy именно текущего коммита: проверяйте также phase, sourceCommit и результаты jobs. Если Actions запрещён, ожидает допуска или не может записать ветку, отчёт может не появиться.

Это проверка публикации, а не повышение прав: стандартный Actions token по-прежнему не позволяет впервые включить Pages. В текущей cloud-среде `gh auth status` отдельно сообщил недействительную авторизацию GH_TOKEN; Git proxy при этом читает и пишет репозиторий.

## Первая неудачная попытка — 17 октября 2026

[Run 39009913265](https://github.com/ddintsen/-/actions/runs/39009913265), коммит 4f16cc7: сборка success, deploy failure. Завершённый receipt получен через Git, его снимок — [deployment-2026-10-17.json](evidence/deployment-2026-10-17.json). В 06:27:46 UTC API Pages и публичный адрес вернули 404. Сайт не опубликован.

Пользователь поручил выполнить всё самостоятельно; согласие на публикацию есть. Технический доступ к первичной настройке Pages из текущей среды отсутствует. Cloudflare Quick Tunnel не смог подключиться из-за недоступного DNS, Netlify Drop отвечает 403; временная ссылка также не создана. Никакой из подготовленных launch/deploy URL не объявляется работающим онлайн-просмотром.

## После открытия репозитория пользователем

17 октября 2026 новый run [39013695211](https://github.com/ddintsen/-/actions/runs/39013695211) для 8846f30 подтвердил public/main и успешную сборку. Deploy по-прежнему failure: Pages API 404 и сайт 404. [Completed receipt](evidence/public-deployment-2026-10-17.json). Для постоянного сайта остаётся выбрать Source=GitHub Actions в Settings/Pages и повторить workflow. Рабочая ссылка приложения в очках пока не подтверждена.

## Последнее пользовательское свидетельство StackBlitz

Пользователь сначала выбрал «Идёт установка зависимостей», но затем прислал скриншот: Cloning repo from GitHub, Mounting environment ещё ожидает. Это текущий подтверждённый этап; npm/Vite/Preview не подтверждены. Форматы branch URL и /fork/github проверены по официальному source guide StackBlitz. Предложен [свежий fork/import](https://stackblitz.com/fork/github/ddintsen/-?view=preview&startScript=dev). Причина задержки по одному скриншоту не установлена.

По Pages пользователь ответил «я не понимаю», получил конкретные шаги Settings/Pages → Build and deployment/Source → Deploy from a branch → GitHub Actions. Подтверждения выбора пока нет. Полная передача следующих действий — [HANDOFF.md](HANDOFF.md).

### Настройка сообщена выполненной

После конкретных шагов Source → GitHub Actions пользователь ответил «готово». Новый push передачи запускает проверку публикации; результат нужно подтвердить completed receipt и доступными HTML/assets, не выдавать одно сообщение о настройке за готовый сайт.

## Успешная публикация

**https://ddintsen.github.io/-/** опубликован. Run [39014468288](https://github.com/ddintsen/-/actions/runs/39014468288), source a1cdf58: build/deploy success, API Pages 200/configured workflow, HTML/JS/CSS/registerSW 200. [Receipt](evidence/published-site-2026-10-17.json). Включать Source повторно не требуется.

Добавлена verify job после deploy: npm ci, доступный Chrome/Chromium (с установкой Playwright Chromium при отсутствии), test:production против deployment URL, screenshots и PWA/offline/10-card/WebGL smoke. Artifact orbita-live-smoke содержит свежие файлы из runner.temp; receipt ждёт verify и записывает verificationResult и download URL. Первый запуск прошёл: run 39025574329/source 22159f6, build/deploy/verify success. PRODUCTION_EVIDENCE_DIR можно использовать для отдельной папки evidence при локальном прогоне.

## Опубликованный URL проверен браузером

Run [39025574329](https://github.com/ddintsen/-/actions/runs/39025574329), source 22159f6: build/deploy/verify **success**. Проверены manifest/SW/profiles, 10 дашбордов, offline room и WebGL. [Receipt](evidence/live-site-verified-2026-10-17.json), [screenshots и JSON artifact](https://github.com/ddintsen/-/actions/runs/39025574329/artifacts/12098855173). HTML и ресурсы также 200. Физический Quest остаётся отдельной приёмкой.
