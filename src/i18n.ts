import { useSyncExternalStore } from "react";

export type Locale = "uk" | "en" | "ru";

const storageKey = "orbita-locale";
const listeners = new Set<() => void>();
const isLocale = (value: unknown): value is Locale =>
  value === "uk" || value === "en" || value === "ru";
let locale: Locale = "uk";
try {
  const saved = localStorage.getItem(storageKey);
  if (isLocale(saved)) locale = saved;
} catch {
  // The language remains usable when storage is unavailable.
}

function notifyLocale(next: Locale) {
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (locale === next) return;
  locale = next;
  listeners.forEach((listener) => listener());
}
if (typeof document !== "undefined") document.documentElement.lang = locale;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey)
      notifyLocale(isLocale(event.newValue) ? event.newValue : "uk");
  });
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (!isLocale(next)) return;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // A blocked preference store must not prevent changing the UI language.
  }
  notifyLocale(next);
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getLocale,
    () => "uk",
  );
}

export function intlLocale(): string {
  return { uk: "uk-UA", en: "en-GB", ru: "ru-RU" }[locale];
}

// Source keys are the existing Russian UI copy. Only exact, known labels are
// translated: arbitrary names and descriptions supplied by an API stay intact.
const messages: Record<string, readonly [string, string]> = {
  Устройства: ["Пристрої", "Devices"],
  "Кассы кратко": ["Каси", "Cash"],
  "Зоны внимания": ["Зони уваги", "Needs attention"],
  "Порог внимания": ["Поріг уваги", "Attention threshold"],
  "План / Порог": ["План / Поріг", "Plan / Threshold"],
  "Выполнение / Статус": ["Виконання / Статус", "Performance / Status"],
  "Не передано": ["Не передано", "Not supplied"],
  "Выбрать дашборд": ["Обрати дашборд", "Choose dashboard"],
  "Центрировать пространство": ["Центрувати простір", "Recenter space"],
  "Предыдущая страница": ["Попередня сторінка", "Previous page"],
  "Следующая страница": ["Наступна сторінка", "Next page"],
  График: ["Графік", "Chart"],
  "Страница {page} / {count}": [
    "Сторінка {page} / {count}",
    "Page {page} / {count}",
  ],
  Орбита: ["Орбіта", "Orbita"],
  "Орбита — обзор": ["Орбіта — огляд", "Orbita — overview"],
  Обзор: ["Огляд", "Overview"],
  Платежи: ["Платежі", "Payments"],
  Кассы: ["Каси", "Cash desks"],
  "Кассовые операции": ["Касові операції", "Cash operations"],
  Оборудование: ["Обладнання", "Equipment"],
  "Платежи по каналам": ["Платежі за каналами", "Payments by channel"],
  "Количество платежей": ["Кількість платежів", "Payment count"],
  "Объём платежей": ["Обсяг платежів", "Payment volume"],
  "Объем платежей": ["Обсяг платежів", "Payment volume"],
  "Платежи с начала года": ["Платежі з початку року", "Payments year to date"],
  "Операции в кассах": ["Операції в касах", "Cash desk operations"],
  "Кассы с начала года": ["Каси з початку року", "Cash desks year to date"],
  "Кассы и команда": ["Каси й команда", "Cash desks and team"],
  "Операции устройств": ["Операції пристроїв", "Device operations"],
  "Объём операций устройств": [
    "Обсяг операцій пристроїв",
    "Device operation volume",
  ],
  "Состояние оборудования": ["Стан обладнання", "Equipment status"],
  Интернет: ["Інтернет", "Internet"],
  "Моб. банк": ["Моб. банк", "Mobile bank"],
  ТСО: ["ТСО", "Self-service"],
  АТМ: ["АТМ", "ATM"],
  "Автоплат.": ["Автоплат.", "Autopay"],
  Автоплатежи: ["Автоплатежі", "Autopay"],
  "Общий план": ["Загальний план", "Overall plan"],
  Разовые: ["Разові", "One-time"],
  Регулярные: ["Регулярні", "Recurring"],
  "Общее количество": ["Загальна кількість", "Total count"],
  "Разовые платежи": ["Разові платежі", "One-time payments"],
  "Регулярные платежи": ["Регулярні платежі", "Recurring payments"],
  "Общий объем": ["Загальний обсяг", "Total volume"],
  "Общий объём": ["Загальний обсяг", "Total volume"],
  "Объем разовых": ["Обсяг разових", "One-time volume"],
  "Объем регулярных": ["Обсяг регулярних", "Recurring volume"],
  Прибыль: ["Прибуток", "Profit"],
  "Пополнение карт": ["Поповнення карток", "Card top-ups"],
  "Снятие наличных": ["Зняття готівки", "Cash withdrawals"],
  Валютообмен: ["Обмін валют", "Currency exchange"],
  "Кол-во операций": ["Кількість операцій", "Operation count"],
  "Объем операций": ["Обсяг операцій", "Operation volume"],
  "Прибыль касс": ["Прибуток кас", "Cash desk profit"],
  "Текущий месяц": ["Поточний місяць", "Current month"],
  "С начала года": ["З початку року", "Year to date"],
  "млн шт.": ["млн шт.", "M txns"],
  "шт.": ["шт.", "pcs"],
  "В ДБО": ["У ДБО", "Digital banking"],
  "В отделениях": ["У відділеннях", "In branches"],
  "Доля в ДБО": ["Частка в ДБО", "Digital share"],
  "доля в ДБО": ["частка в ДБО", "Digital share"],
  "Доля платежей в ДБО": [
    "Частка платежів у ДБО",
    "Digital banking payment share",
  ],
  январь: ["січень", "January"],
  Январь: ["Січень", "January"],
  "отчётный месяц": ["звітний місяць", "reporting month"],
  "Отчётный месяц": ["Звітний місяць", "Reporting month"],
  "Январь / отчётный месяц": [
    "Січень / звітний місяць",
    "January / reporting month",
  ],
  "План на месяц": ["План на місяць", "Monthly plan"],
  "План {period}": ["План {period}", "Plan {period}"],
  "Месячный план": ["Місячний план", "Monthly plan"],
  "За месяц": ["За місяць", "Monthly"],
  "Работающие кассы": ["Працюючі каси", "Operating cash desks"],
  "Открытые вакансии": ["Відкриті вакансії", "Open vacancies"],
  "Простой сегодня": ["Простій сьогодні", "Downtime today"],
  "Простой касс сегодня": ["Простій кас сьогодні", "Cash desk downtime today"],
  "Выполнение плана": ["Виконання плану", "Plan completion"],
  "Выполнение месячного плана": [
    "Виконання місячного плану",
    "Monthly plan completion",
  ],
  "выполнение плана": ["виконання плану", "plan completion"],
  "Работающие устройства": ["Працюючі пристрої", "Operating devices"],
  простой: ["простій", "downtime"],
  Простой: ["Простій", "Downtime"],
  значение: ["значення", "value"],
  день: ["день", "day"],
  операций: ["операцій", "operations"],
  "Операций за месяц": ["Операцій за місяць", "Operations this month"],
  вакансий: ["вакансій", "vacancies"],
  "Низкий простой": ["Низький простій", "Low downtime"],
  "Рабочий уровень": ["Робочий рівень", "Operating level"],
  "Высокий простой": ["Високий простій", "High downtime"],
  Демоданные: ["Демодані", "Demo data"],
  Симуляция: ["Симуляція", "Simulation"],
  "API подключён": ["API підключено", "API connected"],
  "Последний снимок API": ["Останній знімок API", "Latest API snapshot"],
  "Резерв · демоданные": ["Резерв · демодані", "Fallback · demo data"],
  "Ошибка API": ["Помилка API", "API error"],
  "Перейти к аналитике": ["Перейти до аналітики", "Skip to analytics"],
  "Вид аналитики": ["Вид аналітики", "Analytics view"],
  "Как пользоваться": ["Як користуватися", "How to use"],
  "Источники данных": ["Джерела даних", "Data sources"],
  "Включить тёмное окружение": [
    "Увімкнути темне оточення",
    "Use dark environment",
  ],
  "Включить окружение кабинета": [
    "Увімкнути оточення кабінету",
    "Use office environment",
  ],
  "Сменить окружение": ["Змінити оточення", "Change environment"],
  "Отчётный период": ["Звітний період", "Reporting period"],
  "Данные не загружены": ["Дані не завантажено", "Data not loaded"],
  "Показать полные числа": ["Показати повні числа", "Show exact numbers"],
  "Сократить числа": ["Скоротити числа", "Use compact numbers"],
  Кратко: ["Стисло", "Brief"],
  Точно: ["Точно", "Exact"],
  "Обновить данные": ["Оновити дані", "Refresh data"],
  Обновить: ["Оновити", "Refresh"],
  "Открыть в пространстве": ["Відкрити в просторі", "Open in Space"],
  "{source}. Обновление недоступно.": [
    "{source}. Оновлення недоступне.",
    "{source}. Refresh unavailable.",
  ],
  "Обновление недоступно.": ["Оновлення недоступне.", "Refresh unavailable."],
  "Данные API недоступны.": ["Дані API недоступні.", "API data unavailable."],
  Повторить: ["Повторити", "Retry"],
  "Загружаем аналитику": ["Завантажуємо аналітику", "Loading analytics"],
  "Нет доступных данных API": [
    "Немає доступних даних API",
    "No API data available",
  ],
  "Настроить источник": ["Налаштувати джерело", "Configure data source"],
  "Показатель платежей": ["Показник платежів", "Payment measure"],
  Количество: ["Кількість", "Count"],
  Объём: ["Обсяг", "Volume"],
  Вместе: ["Разом", "Combined"],
  "Обновлено {time} · Киев": [
    "Оновлено {time} · Київ",
    "Updated {time} · Kyiv",
  ],
  "{count} зоны внимания": ["{count} зони уваги", "{count} areas to review"],
  "Зоны внимания: {count}": ["Зони уваги: {count}", "Areas to review: {count}"],
  "Дашборды в фокусе": ["Дашборди у фокусі", "Focused dashboards"],
  "Предыдущий дашборд": ["Попередній дашборд", "Previous dashboard"],
  "Следующий дашборд": ["Наступний дашборд", "Next dashboard"],
  Назад: ["Назад", "Back"],
  Далее: ["Далі", "Next"],
  Пространство: ["Простір", "Spatial view"],
  "Загружаем 3D…": ["Завантажуємо 3D…", "Loading 3D…"],
  "Значок разворота открывает график и точные значения. Escape закрывает окно.":
    [
      "Значок розгортання відкриває графік і точні значення. Escape закриває вікно.",
      "The expand icon opens the chart and exact values. Escape closes the dialog.",
    ],
  "В Meta Quest Browser выберите AR или VR. Для выбора панели нажмите курок или соедините большой и указательный пальцы.":
    [
      "У Meta Quest Browser виберіть AR або VR. Щоб вибрати панель, натисніть курок або зведіть великий і вказівний пальці.",
      "In Meta Quest Browser, choose AR or VR. Select a panel with the trigger or by pinching your thumb and index finger.",
    ],
  Факт: ["Факт", "Actual"],
  "План 100%": ["План 100%", "Plan 100%"],
  "план 100%": ["план 100%", "plan 100%"],
  "Платежи по каналам: январь и отчётный месяц, млн шт.": [
    "Платежі за каналами: січень і звітний місяць, млн шт.",
    "Payments by channel: January and reporting month, in millions.",
  ],
  "Количество платежей по каналам, январь и отчётный месяц, в миллионах. Точные значения доступны в фокусе.":
    [
      "Кількість платежів за каналами, січень і звітний місяць, у мільйонах. Точні значення доступні у фокусі.",
      "Payment count by channel, January and reporting month, in millions. Exact values are available in focus.",
    ],
  Всего: ["Усього", "Total"],
  "В фокус": ["У фокус", "Focus"],
  "В фокус: {title}": ["У фокус: {title}", "Focus: {title}"],
  "Точные значения": ["Точні значення", "Exact values"],
  "{title}: точные значения": [
    "{title}: точні значення",
    "{title}: exact values",
  ],
  Показатель: ["Показник", "Measure"],
  Значение: ["Значення", "Value"],
  "Нет данных за этот период": [
    "Немає даних за цей період",
    "No data for this period",
  ],
  "Нет данных по каналам": ["Немає даних за каналами", "No channel data"],
  "Нет данных по работающим кассам": [
    "Немає даних про працюючі каси",
    "No operating cash desk data",
  ],
  Язык: ["Мова", "Language"],
  "Раздел настроек": ["Розділ налаштувань", "Settings section"],
  "Подключение API": ["Підключення API", "API connection"],
  Демонстрация: ["Демонстрація", "Demo Mode"],
  Источник: ["Джерело", "Source"],
  Обновление: ["Оновлення", "Refresh interval"],
  Вручную: ["Вручну", "Manual"],
  "Адрес API": ["Адреса API", "API address"],
  "HTTPS или путь /api/…": ["HTTPS або шлях /api/…", "HTTPS or an /api/… path"],
  "Bearer token": ["Bearer-токен", "Bearer token"],
  "Не сохраняется. Введите после перезагрузки.": [
    "Не зберігається. Введіть після перезавантаження.",
    "Not saved. Re-enter after reloading.",
  ],
  "Скрыть токен": ["Приховати токен", "Hide token"],
  "Показать токен": ["Показати токен", "Show token"],
  "Проверяем API…": ["Перевіряємо API…", "Checking API…"],
  "Проверить соединение": ["Перевірити з’єднання", "Test connection"],
  "Сохранить подключение": ["Зберегти підключення", "Save connection"],
  "API с резервным снимком": [
    "API з резервним знімком",
    "API with fallback snapshot",
  ],
  "Только API": ["Лише API", "API only"],
  Сценарии: ["Сценарії", "Scenarios"],
  "Базовый срез": ["Базовий зріз", "Baseline"],
  "Сбой оборудования": ["Збій обладнання", "Equipment failure"],
  "Закрытие года": ["Закриття року", "Year end"],
  "Примените или отмените изменения, чтобы сменить сценарий.": [
    "Застосуйте або скасуйте зміни, щоб змінити сценарій.",
    "Apply or discard your changes before switching scenarios.",
  ],
  "Симуляция данных": ["Симуляція даних", "Data simulation"],
  Остановить: ["Зупинити", "Stop"],
  Запустить: ["Запустити", "Start"],
  "Выберите сценарий, чтобы перейти с API на демоданные.": [
    "Виберіть сценарій, щоб перейти з API на демодані.",
    "Choose a scenario to switch from API to demo data.",
  ],
  Показатели: ["Показники", "Metrics"],
  "Доля в ДБО, %": ["Частка в ДБО, %", "Digital share, %"],
  "Вакансии кассиров": ["Вакансії касирів", "Cashier vacancies"],
  "Простой АТМ, %": ["Простій АТМ, %", "ATM downtime, %"],
  "Применить показатели": ["Застосувати показники", "Apply metrics"],
  "Загрузить актуальные": ["Завантажити актуальні", "Load latest"],
  "Данные изменились в другой вкладке или симуляции. Загрузите актуальные; ваш черновик остаётся в редакторе.":
    [
      "Дані змінилися в іншій вкладці або симуляції. Завантажте актуальні; ваша чернетка залишається в редакторі.",
      "Data changed in another tab or simulation. Load the latest version; your draft stays in the editor.",
    ],
  "Редактор JSON": ["Редактор JSON", "JSON editor"],
  Копировать: ["Копіювати", "Copy"],
  Скачать: ["Завантажити", "Download"],
  "Применить демоданные": ["Застосувати демодані", "Apply demo data"],
  "Есть несохранённые изменения": ["Є незбережені зміни", "Unsaved changes"],
  "Продолжить редактирование": ["Продовжити редагування", "Keep editing"],
  "Отбросить изменения": ["Відкинути зміни", "Discard changes"],
  "Не удалось проверить API.": [
    "Не вдалося перевірити API.",
    "Could not test the API.",
  ],
  "Сохранено в этом браузере": [
    "Збережено в цьому браузері",
    "Saved in this browser",
  ],
  "Данные изменились. Загрузите актуальную версию перед применением.": [
    "Дані змінилися. Завантажте актуальну версію перед застосуванням.",
    "Data changed. Load the latest version before applying.",
  ],
  "Демоданные обновлены": ["Демодані оновлено", "Demo data updated"],
  "Некорректный JSON. Проверьте запятые, кавычки и скобки.": [
    "Некоректний JSON. Перевірте коми, лапки й дужки.",
    "Invalid JSON. Check commas, quotes and brackets.",
  ],
  "Проверьте данные.": ["Перевірте дані.", "Check the data."],
  "Данные изменились. Загрузите актуальную версию.": [
    "Дані змінилися. Завантажте актуальну версію.",
    "Data changed. Load the latest version.",
  ],
  "Доли и простой: от 0 до 100. Вакансии: целое неотрицательное число.": [
    "Частки й простій: від 0 до 100. Вакансії: ціле невід’ємне число.",
    "Shares and downtime: 0 to 100. Vacancies: a non-negative integer.",
  ],
  "Ключевые показатели обновлены": [
    "Ключові показники оновлено",
    "Key metrics updated",
  ],
  "JSON скопирован": ["JSON скопійовано", "JSON copied"],
  "Копирование недоступно. Выделите текст в редакторе или скачайте JSON.": [
    "Копіювання недоступне. Виділіть текст у редакторі або завантажте JSON.",
    "Copy unavailable. Select the editor text or download JSON.",
  ],
  "Перед скачиванием исправьте JSON.": [
    "Перед завантаженням виправте JSON.",
    "Fix the JSON before downloading.",
  ],
  "Ответ получен · {latency} мс": [
    "Відповідь отримано · {latency} мс",
    "Response received · {latency} ms",
  ],
  "Каждые {seconds} с": ["Кожні {seconds} с", "Every {seconds} s"],
  "Применён сценарий «{scenario}»": [
    "Застосовано сценарій «{scenario}»",
    "Applied scenario “{scenario}”",
  ],
  Закрыть: ["Закрити", "Close"],
  "Не удалось обновить. Повторите.": [
    "Не вдалося оновити. Спробуйте ще раз.",
    "Update failed. Try again.",
  ],
  "Обновить приложение": ["Оновити застосунок", "Update app"],
  "Не удалось запустить WebGL. Включите аппаратное ускорение браузера; обычные дашборды остаются доступны.":
    [
      "Не вдалося запустити WebGL. Увімкніть апаратне прискорення браузера; звичайні дашборди залишаються доступними.",
      "Could not start WebGL. Enable browser hardware acceleration; standard dashboards remain available.",
    ],
  "Данные недоступны": ["Дані недоступні", "Data unavailable"],
  "Завершить XR-сеанс": ["Завершити XR-сеанс", "End XR session"],
  "← Назад": ["← Назад", "← Back"],
  Панорама: ["Панорама", "Overview"],
  "Далее →": ["Далі →", "Next →"],
  "Браузер не начал XR-сеанс. Проверьте разрешения и поддержку устройства.": [
    "Браузер не почав XR-сеанс. Перевірте дозволи й підтримку пристрою.",
    "The browser did not start an XR session. Check permissions and device support.",
  ],
  "Не удалось начать XR-сеанс. Откройте приложение по доверенному HTTPS в Meta Quest Browser и разрешите доступ.":
    [
      "Не вдалося почати XR-сеанс. Відкрийте застосунок через довірений HTTPS у Meta Quest Browser і дозвольте доступ.",
      "Could not start an XR session. Open the app over trusted HTTPS in Meta Quest Browser and allow access.",
    ],
  "Нет данных": ["Немає даних", "No data"],
  "Войти в AR": ["Увійти в AR", "Enter AR"],
  "Войти в VR": ["Увійти в VR", "Enter VR"],
  "Окружение предпросмотра": [
    "Оточення попереднього перегляду",
    "Preview environment",
  ],
  Кабинет: ["Кабінет", "Office"],
  "Тёмное окружение": ["Темне оточення", "Dark environment"],
  "Вернуть аналитику": ["Повернути аналітику", "Return to analytics"],
  "Осмотреть комнату": ["Оглянути кімнату", "Explore room"],
  "Свернуть 3D-просмотр": ["Згорнути 3D-перегляд", "Collapse 3D view"],
  "Развернуть 3D-просмотр": ["Розгорнути 3D-перегляд", "Expand 3D view"],
  Свернуть: ["Згорнути", "Collapse"],
  Развернуть: ["Розгорнути", "Expand"],
  "Процедурный 3D-кабинет": ["Процедурний 3D-кабінет", "Procedural 3D office"],
  "Интерактивный 3D-просмотр десяти дашбордов": [
    "Інтерактивний 3D-перегляд десяти дашбордів",
    "Interactive 3D view of ten dashboards",
  ],
  "WebGL недоступен. Используйте обычный обзор.": [
    "WebGL недоступний. Скористайтеся звичайним оглядом.",
    "WebGL unavailable. Use the standard overview.",
  ],
  "Нет данных для пространственного просмотра": [
    "Немає даних для просторового перегляду",
    "No data for spatial view",
  ],
  "Повторить загрузку": ["Повторити завантаження", "Retry loading"],
  "Приблизить дашборд": ["Наблизити дашборд", "Focus dashboard"],
  "Панорамный обзор": ["Панорамний огляд", "Panoramic overview"],
  "К панораме": ["До панорами", "Back to overview"],
  Поворот: ["Поворот", "Rotation"],
  "Посмотреть на кассы": ["Подивитися на каси", "Look at cash desks"],
  "Поворот взгляда в градусах": [
    "Поворот погляду в градусах",
    "View rotation in degrees",
  ],
  "Посмотреть на оборудование": [
    "Подивитися на обладнання",
    "Look at equipment",
  ],
  Центр: ["Центр", "Centre"],
  "Для AR и VR откройте сайт в Meta Quest Browser.": [
    "Для AR і VR відкрийте сайт у Meta Quest Browser.",
    "For AR and VR, open this site in Meta Quest Browser.",
  ],
  "Укажите HTTPS-адрес API или путь /api/dashboard.": [
    "Укажіть HTTPS-адресу API або шлях /api/dashboard.",
    "Enter an HTTPS API address or /api/dashboard path.",
  ],
  "Используйте URL без паролей, query-параметров и фрагмента. Токен задаётся отдельно.":
    [
      "Використовуйте URL без паролів, query-параметрів і фрагмента. Токен задається окремо.",
      "Use a URL without passwords, query parameters or a fragment. Enter the token separately.",
    ],
  "Нужен HTTPS-адрес. HTTP допустим только для localhost.": [
    "Потрібна HTTPS-адреса. HTTP дозволено лише для localhost.",
    "An HTTPS address is required. HTTP is allowed only for localhost.",
  ],
  "API вернул HTTP {status}. Проверьте доступ и состояние сервера.": [
    "API повернув HTTP {status}. Перевірте доступ і стан сервера.",
    "The API returned HTTP {status}. Check access and server status.",
  ],
  "Ответ API превышает 1 МБ.": [
    "Відповідь API перевищує 1 МБ.",
    "The API response exceeds 1 MB.",
  ],
  "API вернул невалидный JSON.": [
    "API повернув невалідний JSON.",
    "The API returned invalid JSON.",
  ],
  "Некорректная схема данных.": [
    "Некоректна схема даних.",
    "Invalid data schema.",
  ],
  "API не ответил за 4 секунды. Повторите запрос или проверьте сервер.": [
    "API не відповів за 4 секунди. Повторіть запит або перевірте сервер.",
    "The API did not respond within 4 seconds. Retry or check the server.",
  ],
  "Не удалось прочитать API. Проверьте сеть, HTTPS и разрешение CORS на сервере.":
    [
      "Не вдалося прочитати API. Перевірте мережу, HTTPS і дозвіл CORS на сервері.",
      "Could not read the API. Check the network, HTTPS and the server’s CORS permissions.",
    ],
  "Не удалось загрузить данные.": [
    "Не вдалося завантажити дані.",
    "Could not load data.",
  ],
  "Число значений должно совпадать с числом дней": [
    "Кількість значень має збігатися з кількістю днів",
    "The number of values must match the number of days",
  ],
  "Ожидается строка.": ["Очікується рядок.", "Expected a string."],
  "Ожидается {expected}; получено: {received}.": [
    "Очікується {expected}; отримано: {received}.",
    "Expected {expected}; received: {received}.",
  ],
  строка: ["рядок", "string"],
  число: ["число", "number"],
  "целое число": ["ціле число", "integer"],
  массив: ["масив", "array"],
  объект: ["об’єкт", "object"],
  "логическое значение": ["логічне значення", "boolean"],
  "отсутствующее значение": ["відсутнє значення", "missing value"],
  "большое целое число": ["велике ціле число", "big integer"],
  символ: ["символ", "symbol"],
  "нефинитное число": ["нескінченне число або NaN", "non-finite number"],
  "значение подходящего типа": [
    "значення відповідного типу",
    "value of the correct type",
  ],
  "Ожидается число.": ["Очікується число.", "Expected a number."],
  "Ожидается целое число.": ["Очікується ціле число.", "Expected an integer."],
  "Ожидается массив.": ["Очікується масив.", "Expected an array."],
  "Ожидается объект.": ["Очікується об’єкт.", "Expected an object."],
  "Неверный тип значения.": [
    "Неправильний тип значення.",
    "Invalid value type.",
  ],
  "Минимум: {minimum}.": ["Мінімум: {minimum}.", "Minimum: {minimum}."],
  "Максимум: {maximum}.": ["Максимум: {maximum}.", "Maximum: {maximum}."],
  "Неверный формат значения.": [
    "Неправильний формат значення.",
    "Invalid value format.",
  ],
  "Недопустимое значение.": ["Неприпустиме значення.", "Value is not allowed."],
  "Некорректное значение.": ["Некоректне значення.", "Invalid value."],
  "Проверьте {path}: {message}": [
    "Перевірте {path}: {message}",
    "Check {path}: {message}",
  ],
  "корень JSON": ["корінь JSON", "JSON root"],
  "Данные применены в этой вкладке. Локальное сохранение недоступно.": [
    "Дані застосовано в цій вкладці. Локальне збереження недоступне.",
    "Data applied in this tab. Local storage is unavailable.",
  ],
  "Настройки действуют в этой вкладке; сохранение недоступно.": [
    "Налаштування діють у цій вкладці; збереження недоступне.",
    "Settings apply in this tab; saving is unavailable.",
  ],
};

type TemplateValues = Record<string, string | number>;
function interpolate(text: string, values: TemplateValues): string {
  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : match,
  );
}

/** Translate known UI copy without rewriting arbitrary API-provided text. */
export function t(text: string, values: TemplateValues = {}): string {
  const translated = Object.prototype.hasOwnProperty.call(messages, text)
    ? messages[text]
    : undefined;
  if (translated)
    return interpolate(
      locale === "ru" ? text : translated[locale === "uk" ? 0 : 1],
      values,
    );
  // Errors live in state as source text so changing language also updates an
  // already displayed error. These patterns are deliberately whole-message.
  const http =
    /^API вернул HTTP (\d{3})\. Проверьте доступ и состояние сервера\.$/.exec(
      text,
    );
  if (http)
    return t(
      "API вернул HTTP {status}. Проверьте доступ и состояние сервера.",
      { status: http[1] },
    );
  const scenario = /^Применён сценарий «([^»]+)»$/.exec(text);
  if (scenario)
    return t("Применён сценарий «{scenario}»", { scenario: t(scenario[1]) });
  const validation = /^Проверьте ([A-Za-z0-9_.]+|корень JSON): ([\s\S]+)$/.exec(
    text,
  );
  if (validation)
    return t("Проверьте {path}: {message}", {
      path: t(validation[1]),
      message: t(validation[2]),
    });
  const minimum = /^Минимум: (\d+(?:\.\d+)?)\.$/.exec(text);
  if (minimum) return t("Минимум: {minimum}.", { minimum: minimum[1] });
  const maximum = /^Максимум: (\d+(?:\.\d+)?)\.$/.exec(text);
  if (maximum) return t("Максимум: {maximum}.", { maximum: maximum[1] });
  const type = /^Ожидается ([а-яё ]+); получено: ([а-яё ]+|null)\.$/i.exec(
    text,
  );
  if (type)
    return t("Ожидается {expected}; получено: {received}.", {
      expected: t(type[1]),
      received: t(type[2]),
    });
  return interpolate(text, values);
}

const monthNames = [
  ["январь", "січень", "january"],
  ["февраль", "лютий", "february"],
  ["март", "березень", "march"],
  ["апрель", "квітень", "april"],
  ["май", "травень", "may"],
  ["июнь", "червень", "june"],
  ["июль", "липень", "july"],
  ["август", "серпень", "august"],
  ["сентябрь", "вересень", "september"],
  ["октябрь", "жовтень", "october"],
  ["ноябрь", "листопад", "november"],
  ["декабрь", "грудень", "december"],
];

/** Localize structured report periods; leave descriptive API metadata intact. */
export function formatReportDate(text: string): string {
  const monthYear = /^(\p{L}+) (\d{4})$/u.exec(text.trim());
  if (monthYear) {
    const month = monthNames.findIndex((names) =>
      names.includes(monthYear[1].toLowerCase()),
    );
    if (month >= 0) {
      const date = new Date(Date.UTC(Number(monthYear[2]), month, 1));
      const label = new Intl.DateTimeFormat(intlLocale(), {
        month: "long",
        timeZone: "UTC",
      }).format(date);
      return `${label.charAt(0).toLocaleUpperCase(intlLocale())}${label.slice(1)} ${monthYear[2]}`;
    }
  }
  const iso = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text.trim());
  if (iso) {
    const year = Number(iso[1]),
      month = Number(iso[2]) - 1,
      day = Number(iso[3] ?? 1);
    const date = new Date(Date.UTC(year, month, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month &&
      date.getUTCDate() === day
    )
      return new Intl.DateTimeFormat(intlLocale(), {
        ...(iso[3] ? { day: "numeric" as const } : {}),
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
  }
  const since = /^(?:с|з) (\d{2}\.\d{2}\.\d{4})$/.exec(text.trim());
  if (since)
    return `${locale === "en" ? "since" : locale === "uk" ? "з" : "с"} ${since[1]}`;
  return text;
}

/** Delta values are textual in the API contract; parse only numeric percents. */
export function formatDelta(text: string): string {
  const match = /^([+−-]?)(\d+(?:[.,]\d+)?)%$/.exec(text.trim());
  if (!match) return text;
  return `${match[1]}${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 }).format(Number(match[2].replace(",", ".")))}%`;
}
