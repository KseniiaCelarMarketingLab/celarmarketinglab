# Celar Marketing Lab — Website

## Files
- `celar.html` — главная страница
- `celar_cases.html` — страница кейсов
- `celar_products.html` — страница продуктов
- `vercel.json` — настройка маршрутизации (открывает celar.html на корневом URL)

## Деплой на GitHub + Vercel

### 1. Загрузка на GitHub
1. Зайди на github.com → New repository → назови, например, `celar-website`
2. На странице репозитория нажми "uploading an existing file"
3. Перетащи туда все 4 файла из этого архива (celar.html, celar_cases.html, celar_products.html, vercel.json)
4. Commit changes

### 2. Деплой на Vercel
1. Зайди на vercel.com → залогинься через GitHub
2. New Project → выбери репозиторий `celar-website`
3. Framework Preset: оставь "Other" (или "No Framework")
4. Build Command и Output Directory — оставь пустыми (это статичный сайт)
5. Deploy

### 3. Подключение домена celarlab.com
1. В проекте на Vercel → Settings → Domains
2. Добавь `celarlab.com`
3. Vercel покажет DNS-записи (обычно A-запись или CNAME) — добавь их у регистратора домена
4. Подожди обновления DNS (от нескольких минут до 24 часов)

После деплоя:
- `celarlab.com` → главная страница
- `celarlab.com/celar_cases.html` → кейсы
- `celarlab.com/celar_products.html` → продукты

Все внутренние ссылки в навигации уже настроены правильно — переходы между страницами будут работать без 404.
