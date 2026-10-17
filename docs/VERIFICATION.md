# Проверки первой рабочей версии

Итог зафиксирован 17 октября 2026 (Europe/Kyiv). Среда: Linux cloud, Node 24.19.0, npm 11.9.0, системный Chromium. Все тесты выполнялись на реализации в этом checkout.

| Проверка | Результат |
|---|---|
| Повторная установка `bash scripts/cloud-install.sh` | npm ci, tokens:check, production build и 38 unit-тестов прошли |
| `npm run typecheck` | Прошёл |
| `npm run format:check` | Прошёл |
| `npm run tokens:check` | Прошёл, CSS/JSON соответствуют DESIGN.md |
| `npm run test` | **38 passed**, 0 failed/skipped |
| `npm run test:e2e` | **13 passed**, 0 failed/skipped; включает axe и реальный WebGL |
| `npm run build` | Прошёл; PWA precache около 2,23 МБ |
| `npm run test:production` | Production HTML, manifest, SW-controlled reload, 10 дашбордов offline, WebGL offline, profile Quest, 0 JS errors |
| HTTPS dev | HTML получен по https://localhost:5174 с curl --cacert локального сертификата; TLS-проверка не отключалась |
| Premium static audit strict | **0 findings** (`docs/evidence/premium-audit.json`) |
| DESIGN.md lint | **0 errors**; 15 warnings о token references в prose-owned component maps; реальные runtime-ссылки проверены tokens:check |
| Production dependency audit | 0 known vulnerabilities на дату проверки |
| Исходные материалы | SPEC, HTML-прототип и исходный JSON сохранены; реальная серверная конфигурация не менялась |

## Функциональная матрица

- Все 10 дашбордов: открытие фокуса, точные значения, Escape и возврат фокуса на триггер.
- Обзор/платежи/кассы/оборудование: URL state, browser Back, обе темы, полные/сокращённые числа.
- Данные: исходный JSON, пустые ряды, длинные подписи, все пороги простоев (включая 2,01 и 6,5001), перевыполнение плана.
- API: успешный ответ, HTTP 500, неверная схема, невалидный JSON, сеть, 4с timeout, отмена, поздний ответ после смены данных, Hybrid/Strict.
- Настройки: валидация URL и показателей, скрытый токен, отсутствие токена в localStorage/sessionStorage, очистка при reload, нативный select с клавиатуры.
- Demo: сценарии, быстрый редактор, полная JSON-валидация, несохранённые изменения, экспорт, симуляция start/stop, синхронизация двух вкладок, конфликт редактора с обновлением во второй вкладке.
- A11y: axe WCAG 2/2.1/2.2 AA теги в обзоре, фокусе, настройках; отдельная проверка настроек demo в тёмной теме на узком экране. Это автоматизированная проверка, не полная сертификация WCAG.
- Layout: 1720 desktop screenshot, 1440/768/390px, отсутствие горизонтального overflow, reduced motion, доступность действий на мобильном.
- XR: feature detection, disabled кнопки с объяснением без аппаратной поддержки, настоящий WebGL, поворот, focus через select, отсутствие ошибок JS; scene code и профили доступны без сети.

## Найдено и исправлено

1. Контраст номеров блоков — убрана прозрачность.
2. Импорт fixture из public вызывал предупреждение Vite — единственный JSON теперь инъецируется через поддерживаемый define, копия по public URL остаётся доступной.
3. Controller profile loader требует абсолютный base URL — исправлено, JSON-профили Quest включены локально.
4. Quick-поля учитываются в guard несохранённых изменений; границы и конфликты проверяются до применения.
5. Simulation-owner сообщение больше не меняет статус вкладки с активным API.
6. XR-overview адаптирован к чтению издали; подробные графики вынесены в focus.
7. Из precache исключены неиспользуемые комнаты встроенного эмулятора; встроенный эмулятор отключён.

## Непроверенные внешние условия

- Физический Meta Quest 3S: passthrough, pinch, контроллеры, оптика, комфорт углов/расстояний, GPU frame time, FPS и PWA-установка. Системный Chromium этого не доказывает.
- Реальный корпоративный API, его CORS, права доступа, единицы и достоверность исходных показателей. В тестах использованы управляемые ответы.
- Настройка между ноутбуком и отдельным шлемом: нужен серверный механизм; текущая синхронизация только между вкладками одного браузерного профиля.
- Полная матрица Safari/Firefox, ручной screen reader и 200% zoom не выполнялись.
- Нативный APK, внешний deployment, GitHub push, публикация среды и восстановление в новой задаче не выполнялись.

## Сборочные замечания

Rollup сообщает о большом отдельном XR-chunk (~1,05 МБ до gzip, ~286 КБ gzip) и комментариях pure annotations внутри Zod. Это предупреждения зависимостей, сборка успешна. XR загружается по запросу. npm сообщает deprecation у транзитивных glob/react-fontawesome; production audit не обнаружил уязвимостей. Их обновление потребует согласованного обновления соответствующих upstream-пакетов, а не отключения проверки.

## Артефакты

`docs/evidence/`: e2e-results.json, premium-audit.json, dependency-audit.json, production-smoke.json, desktop.png, dark.png, mobile.png, settings-mobile.png, spatial.png, spatial-focus.png. Скриншоты не добавляются в Git автоматически (gitignore), но сохранены в рабочей среде и экспортном архиве.


## 2026-10-17 — визуальная версия 2
- `npm run typecheck`, `npm run format:check`, `npm run tokens:check`: PASS.
- `npm run test`: 38/38 PASS.
- `npm run test:e2e`: 13/13 PASS, 0 skipped/flaky/errors. Отчёт `evidence/e2e-results.json`.
- `npm run build`: PASS; `evidence/build-v2.log`. Precache 69 files / 4607.97 KiB.
- `npm run test:production`: PASS; offline room.png decode, 10 dashboards, WebGL, manifest/profiles, 0 page errors. `evidence/production-smoke.json`.
- Strict static UI audit: 0 findings (`evidence/premium-audit.json`). DESIGN lint: 0 errors, 20 orphan-token warnings; runtime adapter drift check PASS.
- Browser images inspected: desktop-v2, dark-v2, mobile-v2, settings-v2, equipment-v2, focus-v2. No mobile horizontal overflow. Физический Quest остаётся за пределами проверки.
