# SMM Challenge — Access System Setup
## Что делает эта система

```
Покупатель платит в Stripe
  → Stripe вызывает webhook → api/stripe-webhook.js
  → Генерируется уникальный токен
  → Токен сохраняется в Vercel KV
  → Письмо с ссылкой celarlab.com/course?token=XYZ отправляется через Resend
  → Пользователь открывает ссылку → middleware проверяет токен → курс открывается
```

---

## Шаг 1 — Добавить файлы в репозиторий

В репозиторий `KseniiaKklsh/Celar-Marketing-Lab-` добавить:

```
api/
  stripe-webhook.js
  validate-token.js
middleware.ts
smm-challenge-cml.html   ← переименовать и положить в корень
package.json             ← обновить (добавить зависимости)
vercel.json              ← обновить (добавить /course rewrite)
```

---

## Шаг 2 — Vercel KV

1. Открыть проект на vercel.com
2. Storage → Create Database → KV
3. Нажать Connect → выбрать Production
4. Environment variables добавятся автоматически: `KV_REST_API_URL`, `KV_REST_API_TOKEN`

---

## Шаг 3 — Resend (email)

1. Зарегистрироваться на resend.com (бесплатно до 3000 писем/мес)
2. Domains → Add Domain → `celarlab.com`
3. Добавить DNS записи (они покажут точные значения)
4. API Keys → Create API Key
5. В Vercel → Settings → Environment Variables:
   ```
   RESEND_API_KEY = re_xxxxxxxxxxxx
   ```

---

## Шаг 4 — Stripe Webhook

1. Открыть Stripe Dashboard → Developers → Webhooks
2. Add endpoint:
   - URL: `https://celarlab.com/api/stripe-webhook`
   - Events: `checkout.session.completed`
3. Скопировать **Signing secret** (начинается с `whsec_`)
4. В Vercel → Environment Variables:
   ```
   STRIPE_SECRET_KEY     = sk_live_xxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET = whsec_xxxxxxxxxxxx
   ```

---

## Шаг 5 — Stripe Payment Link (уже есть, небольшое изменение)

В Stripe Dashboard → Payment Links → найти SMM Without Budget link:
- `https://buy.stripe.com/cNiaEW5aa6YB3VR8xz0Jq05`

Открыть → Edit → After payment:
- ✅ Redirect customers to your website
- URL: `https://celarlab.com/celar_products.html?paid=smm`

`client_reference_id` уже прописан в коде сайта — ничего менять не нужно.

---

## Шаг 6 — Deploy

```bash
git add .
git commit -m "add SMM course access system"
git push
```

Vercel задеплоит автоматически.

---

## Проверка

1. Открыть `https://celarlab.com/course` без токена → должен редиректить на страницу покупки
2. Сделать тестовую оплату через Stripe test mode
3. Проверить что письмо пришло с правильной ссылкой
4. Открыть ссылку → курс должен открыться

---

## Стоимость инфраструктуры

| Сервис | Бесплатно | Платно |
|--------|-----------|--------|
| Vercel KV | 30MB, 30K req/мес | $0.20/100K req |
| Resend | 3000 emails/мес | $20/мес за 50K |
| Vercel Functions | 100GB-hrs/мес | включено в Pro |

Для старта — всё в рамках бесплатных лимитов.
