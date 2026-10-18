# Каталог пакета и происхождение материалов

## Основные документы

| Файл | Для чего |
| --- | --- |
| 00-START-HERE.md | Быстрый вход и порядок чтения |
| 01-FULL-CONTEXT.md | Самодостаточный полный контекст для одного вложения агенту |
| 02-REQUESTS-AND-SCREENSHOTS.md | История прямых поручений, вложения,4 фрагмента,9+7 исторических экранов и текущие снимки |
| 03-AUDIT-PROMPT.md | Готовое поручение на аудит, без неявного разрешения на новый редизайн |
| 04-VERSIONS-AND-VERIFICATION.md | Точные версии, что опубликовано, что проверялось и что не проверено |
| 05-FILES-AND-LINKS.md | Этот каталог |

## Исходные материалы

`source-documents/01-Pasted-text.md` — оригинальный текст загруженного TXT, сохранён как MD. `02-orbita-review-and-prompt-original.md` — второе исходное вложение без изменения байтов. `03-orbita-earlier-review.md` — ранее сохранённое ревью первого этапа. `04-chat-hotfix-summary.md`, `05-glass-room-and-header-request.md`, `06-space-environment-request.md` — сохранённые в проекте записи запросов. Некоторые формулировки в них уже заменены более поздними прямыми требованиями, указанными в основных документах пакета.

`reference-docs/` содержит снимок проектных документов: AGENTS, CONTEXT, DESIGN, UX-CONTRACT, HANDOFF, WORKLOG, DECISIONS, API_CONTRACT, QUEST_ACCEPTANCE, DEPLOYMENT, SPEC, VERIFICATION и краткий AUDIT-CONTEXT. Эти копии нужны для автономного чтения. Относительные ссылки внутри копий могут вести в полную структуру репозитория, которая не целиком включена в пакет; для перехода к таким файлам используйте GitHub baseline из 04-VERSIONS-AND-VERIFICATION.md. Не считать ранний абзац хронологического журнала текущим состоянием.

## Снимки

- `screens/current/`:18 свежих PNG runtime 57d1769, manifest с датой/источником, только реальные browser captures.
- `screens/history-iteration-1/`:9 существующих PNG соответствующих экранов первого ревью, источник docs/evidence/screenshots-2026-10-17/.
- `screens/history-iteration-2/`:7 существующих PNG предыдущей Quest-итерации 504f106, источник docs/evidence/quest-2026-10-18/screens/.

Итого 34 PNG. Четыре inline-фрагмента пользователя не входят в это число и не подменены изображениями из репозитория. Прежняя комната доступна в Git8fa40fb и docs/evidence/glass-room-2026-10-18/, её дополнительные 14 PNG в этот пакет не дублируются; архив полного контекста содержит главное для текущего аудита и две исходные группы ревью.

## Подтверждения

- `evidence/brand-theme/`: последняя публикация, сравнение assets и 18 browser cases.
- `evidence/space/`: проверки космоса/контраста,72 header-hover cases, происхождение SVG/текстуры, production/offline/upgrade/standalone и предыдущая публикация.
- `evidence/hotfix/audit-crosscheck.md`: матрица сверки полного исходного документа с hotfix.
- `MANIFEST.json`: размеры и SHA-256 каждого файла, кроме самого manifest; runtime и baseline.

Происхождение логотипа и Земли записано в отдельных JSON; оригинальная геометрия SVG сохранена. Официальный домен банка из cloud был недоступен; pinned публичная копия не выдаётся за прямое скачивание с него. В пакет не включены tokens, конфигурация персонального API, адрес получателя почты, node_modules или build cache.

## Скачивание

- Полный ZIP: https://raw.githubusercontent.com/ddintsen/-/main/docs/downloads/orbita-full-context-2026-10-18.zip
- Только Markdown: https://raw.githubusercontent.com/ddintsen/-/main/docs/downloads/orbita-context-markdown-2026-10-18.zip
- Один полный MD: https://raw.githubusercontent.com/ddintsen/-/main/docs/transfer/orbita-full-context-2026-10-18/01-FULL-CONTEXT.md
- Просмотр всех файлов: https://github.com/ddintsen/-/tree/main/docs/transfer/orbita-full-context-2026-10-18

Для передачи другому агенту достаточно полного ZIP. Если принимаются только текстовые файлы — передайте Markdown ZIP или 01-FULL-CONTEXT.md; в варианте только MD изображений нет, а относительные ссылки на них требуют полного архива либо репозитория.
