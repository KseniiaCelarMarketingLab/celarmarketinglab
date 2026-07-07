# Celar Marketing Lab — Website

## Files
- `celar.html` — главная страница (с прелоадером-ракетой, квизом "Find Your Orbit", анимированными орбитами)
- `celar_cases.html` — страница кейсов (Vigor & Sage, Ax Lindholm, Katerina Azarova)
- `celar_products.html` — страница продуктов (SMM Challenge, Brand Voice, ICP Workbook и др. со Stripe-оплатой)
- `vercel.json` — настройка маршрутизации (открывает celar.html на корневом URL)

## Деплой на GitHub + Vercel

### 1. Обновление репозитория на GitHub
У тебя уже есть репозиторий `KseniiaKklsh/Celar-Marketing-Lab-`. Чтобы обновить файлы:
1. Зайди в репозиторий на github.com
2. Если файлы уже есть — открой каждый файл → значок карандаша (Edit) → удали старое содержимое → вставь новое из соответствующего файла → Commit changes
   ИЛИ
   Add file → Upload files → выбери новые версии файлов с тем же именем → GitHub предложит заменить → Commit changes
3. Если файлов ещё нет — Add file → Upload files → выбери все 4 файла (celar.html, celar_cases.html, celar_products.html, vercel.json) → Commit changes

### 2. Деплой на Vercel
1. Зайди на vercel.com → залогинься через GitHub
2. New Project → выбери репозиторий `Celar-Marketing-Lab-`
3. Framework Preset: оставь "Other" (или "No Framework")
4. Build Command и Output Directory — оставь пустыми (это статичный сайт)
5. Deploy

Если проект на Vercel уже подключён к этому репозиторию — просто запушь обновлённые файлы на GitHub, и Vercel передеплоит сайт автоматически в течение минуты.

### 3. Подключение домена celarlab.com
1. В проекте на Vercel → Settings → Domains
2. Добавь `celarlab.com`
3. Vercel покажет DNS-записи (обычно A-запись или CNAME) — добавь их у регистратора домена
4. Подожди обновления DNS (от нескольких минут до 24 часов)

После деплоя:
- `celarlab.com` → главная страница
- `celarlab.com/celar_cases.html` → кейсы
- `celarlab.com/celar_products.html` → продукты

Все внутренние ссылки в навигации уже настроены правильно — переходы между страницами работают без 404.

## Что нового в этой версии
- Кейс Ax Lindholm обновлён актуальными метриками LinkedIn (43,524 impressions, 2,790 followers)
- Добавлен новый кейс Katerina Azarova (личный бренд, Instagram)
- Все эмодзи-иконки заменены на брендовые SVG в фирменной палитре CML
- Добавлены геймифицированные космические декорации (орбиты, планеты, корабли) на все три страницы
- Подключены реальные ссылки на оплату через Stripe для всех 6 платных продуктов
- Квиз на главной странице расширен до 6 вопросов для более точных рекомендаций
- 
