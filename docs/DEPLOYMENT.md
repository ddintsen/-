# Онлайн-просмотр ОРБИТЫ

## Обычный сайт

Адрес после успешной публикации: **https://ddintsen.github.io/-/**.

Один раз в [Settings → Pages](https://github.com/ddintsen/-/settings/pages) выберите **Build and deployment → Source → GitHub Actions**. Настройка должна быть доступна владельцу репозитория; если GitHub показывает ограничение тарифа или прав, публикация Pages этим аккаунтом пока недоступна. Публичность репозитория автоматически не меняется.

После настройки каждый push в main запускает [Publish ORBITA](https://github.com/ddintsen/-/actions/workflows/pages.yml). При необходимости выберите **Run workflow → main** либо повторите неудачный deploy. Публикация подтверждена только после зелёного deploy и открывающегося сайта. Настроенный workflow сам по себе не подтверждает развёртывание.

Workflow использует Node 22, npm ci, проверку типов/токенов/unit, production build и официальные GitHub Pages actions. Дополнительных секретов проекта не требуется. Официальный configure-pages не умеет впервые включать Pages с обычным GITHUB_TOKEN: это начальная настройка владельца, а не причина просить пользователя передать токен.

Проектный base — `/-/`, задаётся VITE_BASE_PATH. CSS-ресурсы, PWA manifest/service worker, ссылка на обзор и XR controller profiles учитывают этот путь. Навигация использует query parameters, поэтому отдельные server rewrites для вкладок не нужны. API остаётся внешним GET-источником; по умолчанию доступны явно помеченные демоданные.

## Браузерная среда

[Запустить в StackBlitz](https://stackblitz.com/github/ddintsen/-?view=preview). Зависимости и dev-сервер запускаются в браузерной среде согласно `.stackblitzrc`. Для закрытого репозитория может потребоваться авторизация GitHub и доступ StackBlitz. Внешний запуск здесь не подтверждён; это ссылка для импорта проекта, а не отдельный опубликованный сайт.

## Переносимый просмотр

`npm run build:preview` создаёт `standalone-dist/orbita-preview.html` с кодом, данными, шрифтами и фоном внутри файла. GitHub workflow прикладывает его как artifact `orbita-preview`. `npm run test:preview` проверяет самодостаточность через HTTP: 10 дашбордов, фокус, навигация, WebGL, ноль дополнительных внешних запросов. Прямую навигацию file:// управляемый Chromium в cloud блокирует политикой администратора, поэтому она здесь не объявляется проверенной. WebXR на Quest требует доверенного HTTPS.

## Фактическая проверка из cloud

- Production build по /-/ проверяется локальным preview и `PREVIEW_URL=.../-/ npm run test:production`: контролируемый service worker, manifest, controller profiles, новый фон, все 10 карточек и WebGL в offline.
- GitHub API и github.io в текущей среде возвращают Forbidden / CONNECT 403. Даже запуск разрешённой эскалацией не дал доступа к API. Это не доказывает, что сайт недоступен в браузере пользователя.
- Анонимный HTTP-запрос страницы репозитория вернул 404; доступ через настроенный Git proxy работает. Видимость репозитория и тариф без API не установлены.
