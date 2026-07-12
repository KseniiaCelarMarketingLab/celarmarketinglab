# Brand Voice Cheatsheet — Setup TZ

Built to sit alongside the SMM Challenge infra, but fully independent (own Redis
key prefix `bvc:`, own webhook endpoint, own token) so nothing here can touch
or break the SMM Challenge.

## Files delivered
- `brand-voice-cheatsheet.html` → upload to repo root (same pattern as `smm-challenge-cml.html`)
- `api/bvc-webhook.js`
- `api/bvc-validate-token.js`
- `api/bvc-save-progress.js`
- `api/bvc-load-progress.js`

## What the tool does
3 steps, ~10 minutes: 6 tone-of-voice sliders (Formal↔Casual, Serious↔Playful,
Reserved↔Bold, Technical↔Simple, Authoritative↔Approachable, Traditional↔Innovative)
→ pick up to 3 of 10 example phrasings that sound "most like us" → auto-generated
one-pager (voice snapshot bars, top-3 do/don't rules, reference phrasing, word bank)
with a working "Export as PDF" button (`window.print()` + print stylesheet — no
extra library needed).

## Your manual steps

### 1. Stripe
- Create a new **Payment Link**, price **€12**, one-time.
- Success URL: `https://celarmarketinglab.com/brand-voice-cheatsheet.html?paid=bvc`
- Create a **separate webhook endpoint** in Stripe (Developers → Webhooks → Add endpoint):
  - URL: `https://celarmarketinglab.com/api/bvc-webhook`
  - Event: `checkout.session.completed`
  - Stripe will give you a signing secret for this endpoint — save it.
- Note: same "no `client_reference_id` via Payment Link UI" limitation applies here too — this webhook doesn't rely on it.

### 2. Vercel environment variables
Add (Settings → General → Environment Variables):
| Variable | Value |
|---|---|
| `STRIPE_BVC_WEBHOOK_SECRET` | the signing secret from the new webhook endpoint above |
| `STRIPE_SECRET_KEY` | can reuse your existing one |
| `UPSTASH_REDIS_REST_URL` | reuse existing |
| `UPSTASH_REDIS_REST_TOKEN` | reuse existing (⚠️ rotate this first if it's still the exposed one) |
| `RESEND_API_KEY` | reuse existing |

### 3. Email
Reuses your verified `celarmarketinglab.com` Resend domain — no new DNS records needed. Sender used: `hello@celarmarketinglab.com` (change in `bvc-webhook.js` if you'd rather send from a different address).

### 4. `celar_products.html` — swap the "Coming soon" button
In the Brand Voice Cheatsheet product card/modal, replace the disabled "Coming soon" button with a real checkout link:
```html
<a href="https://buy.stripe.com/YOUR_NEW_BVC_LINK" class="btn-primary" style="text-decoration:none;text-align:center;display:block">
  Get it — €12
</a>
```
Swap `YOUR_NEW_BVC_LINK` for the Payment Link from step 1. If you'd like, send me the current `celar_products.html` and I'll make this edit directly rather than you patching it by hand.

### 5. Test before going live
1. Use Stripe test mode, complete a test checkout.
2. Confirm the webhook fires (Stripe dashboard → webhook → recent deliveries).
3. Confirm you receive the access email with a working token link.
4. Open the link, fill the tool, refresh — progress should reload.
5. Try "Export as PDF" — should print a clean one-pager, no nav/UI chrome.

## Notes / things to revisit
- Redis key schema is fully separate: `bvc:token:*`, `bvc:email:*`, `bvc:progress:*` — safe to inspect in the Upstash Data Browser without any SMM risk.
- No new digital product needs `middleware.ts` — same as SMM, keep it deleted.
- The 3-day money-back guarantee language isn't in the tool itself since it's a single-purchase reference doc, not a course — let me know if you want it added to the confirmation email or the product card copy.
