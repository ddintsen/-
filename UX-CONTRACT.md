# UX Contract — ОРБИТА

## Product context
Руководитель читает 10 аналитических дашбордов; разработчик подключает GET API в настройках. Русский язык, ru-RU числа, временные метки Europe/Kyiv, метаданные отчёта из API. Цель — WCAG 2.2 AA в браузере; XR проверяется отдельно в шлеме.

## Business-context sources
| Scope | Source | Date |
|---|---|---|
| Данные и шкалы | docs/SPEC.md §1–2, docs/API_CONTRACT.md | 2026-10-16 |
| Исправления противоречий | docs/DECISIONS.md | 2026-10-16 |
| Секреты и локальное хранение | docs/DECISIONS.md §5–6 | 2026-10-16 |
| Платежи/роли/удаление | Не применимо: только чтение аналитики, нет банковских транзакций, пользовательской базы или удаления записей | 2026-10-16 |

## Visual contract
DESIGN.md → scripts/tokens.mjs → src/styles/tokens.css + tokens.json. Общие компоненты используют эти токены. Кабинет / Тёмное окружение сохраняют иерархию.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | components/ui.tsx NativeSelect | UX contract | native: OS-owned popup разрешён для технических настроек | keyboard + popup |
| Form | components/ui.tsx Field + api/schema.ts | API contract | settings / demo editor | E2E invalid + success |
| Scrollbar | styles/app.css global baseline | DESIGN.md | dialog geometry | computed style |
| Toast | components/ui.tsx Toast | UX contract | success/info | live region |
| Dialog | components/ui.tsx Modal (Radix) | UX contract | focus / settings / XR / unsaved | Escape + restoration |
| Charts | components/charts.tsx + api/model.ts | API contract | overview / focus / XR | value + empty tests |

## Navigation and dataset
Фиксированные 10 карточек — render all, без пагинации. Вкладки навигации: обзор, платежи, кассы, оборудование; `?view=` восстанавливает выбор и Back/Forward. `?admin=1` открывает настройки. Никаких токенов/URL API в адресной строке. Дата — read-only метаданные, не фиктивный фильтр.
Фокус: кнопка каждой карточки открывает подробную визуализацию и таблицу точных данных. Escape и «Закрыть» возвращают фокус на исходную кнопку. Одинаковое поведение у всех 10 карточек.

## Flow ledger
| Operation | Pending | Success | Failure | Source |
|---|---|---|---|---|
| Настройка API | Заблокировать повторное сохранение/проверку | Локально сохранить несекретные настройки, начать чтение | Поля остаются; ошибка рядом, повтор доступен | SPEC §1.2 |
| Проверка соединения | 4с timeout; AbortController | HTTP + полная валидация, задержка; не меняет активные данные сама | HTTP/CORS/timeout/schema различимы | API_CONTRACT |
| Demo JSON | Проверка схемы до записи | Применить только к mock, синхронизировать вкладки | Не менять предыдущие данные; путь ошибки | SPEC §7 |
| Закрыть несохранённую форму | App-owned confirmation | Сохранить или явно отбросить изменения | Оставить редактор открытым | UX contract |
| Обновить | Индикатор, старые данные остаются | Новые валидные данные/время | Hybrid: stale/mock с предупреждением; Strict: ошибка без демозамены | SPEC §1.2 |

## Async and resilience
GET с таймаутом 4000мс, отмена/номер поколения защищают от старого ответа при смене конфигурации. Polling последовательный, без наложения запросов. Интервалы 0/5/15/30/60с. Mock читает локальный JSON. Состояния источника mock / simulation / live / fallback / error честные.
Последний live-снимок только в памяти. localStorage хранит только демоданные и несекретные настройки. Синхронизация BroadcastChannel + storage только демоданных. Симуляция живёт в активировавшей вкладке, второй запуск в другой вкладке прекращает предыдущий через канал. Конфликт JSON-редактора сообщает о новой версии, не затирает набранный текст.

## Forms and overlays
noValidate, Zod, явные label, aria-invalid + aria-describedby, фокус первого ошибочного поля. Нативные select используют OS-popup намеренно. Textarea resize:none, большой редактор прокручивается. Bearer token masked, reveal button, только память. Endpoint HTTPS или относительный /api путь; HTTP допустим только для localhost-разработки, URL credentials/query/hash запрещены. Поля не очищаются при ошибке.
Radix Modal владеет focus trap, inert background, Escape, возвратом фокуса. Нет alert/confirm/prompt. Toast — одна aria-live область; ошибки API остаются в статусе/форме. Unsaved guard на закрытие и beforeunload; смена вкладок внутри настроек не теряет поля.

## Verification
Unit: схемы, границы простоев, данные всех десяти моделей, сценарии, fallback/strict/timeout. Browser: панорама, три блока, 10 фокусов, настройки, невалидный JSON, синхронизация, keyboard, mobile, reduced motion, две темы, axe. XR: рендер WebGL и fallback без поддержки; фактические контроллеры/руки/passthrough/оптика требуют Quest 3S. Commands/results — docs/WORKLOG.md и docs/VERIFICATION.md.

## Пространственная навигация
Выбор любой из 10 карточек открывает подробный фокус. В нём «Предыдущий дашборд» / «Следующий дашборд» меняют карточку в пределах 1–10; на границах соответствующая кнопка disabled. «К панораме» снимает фокус. Внутри XR эти же действия доступны на mesh-кнопках под карточкой; в браузере — через native select и DOM-кнопки с именами. Статус сообщает текущую карточку. Изменение фокуса не перемещает камеру.

Переключатель окружения в предпросмотре использует общий theme приложения. «Развернуть 3D-просмотр» увеличивает область canvas в том же диалоге; scroll owner остаётся диалогом. Фото в browser preview декоративное; реальный AR требует совместимого шлема. Source: docs/SPEC.md §1.3 и docs/DECISIONS.md.

## Упрощение визуала и 3D-кабинет · 2026-10-17
Названия вместо декоративных номеров во всех DOM/XR-представлениях. Нет постоянных рамок панелей и акцентных штрихов у заголовков. Hover XR осветляет поверхность, focus-visible браузера остаётся явным. Аналитические величины и семантика цветов не меняются.

Комнатой владеет spatial/ProceduralRoom.tsx, материалами — DESIGN.md. Одна геометрия для browser preview и VR, не монтируется в immersive-ar. «Осмотреть комнату» доступно в браузере независимо от наличия данных: скрывает карточки и селектор, разрешает поворот ±180°; возврат очищает фокус и yaw. Настройки источника/данные не меняются. В XR эта функция недоступна; вход/выход возвращает панораму. Неподдерживаемый WebGL по-прежнему имеет объяснение и обычный обзор.
