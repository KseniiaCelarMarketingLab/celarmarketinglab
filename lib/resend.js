const { Resend } = require('resend');
const { PRODUCTS } = require('./products');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendAccessEmail({ product, email, token }) {
  const p = PRODUCTS[product];
  if (!p) throw new Error(`Unknown product: ${product}`);

  const link = `${p.productUrl}?token=${token}`;

  await resend.emails.send({
    from: 'Celar Marketing Lab <hello@celarmarketinglab.com>',
    to: email,
    subject: `Your access to ${p.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0B0F2B">
        <h2 style="font-family:Arial,sans-serif">Thanks for your purchase — ${p.name}</h2>
        <p>Your access link is ready. It works on any device, no account needed.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#00FFF0;color:#0B0F2B;padding:14px 22px;text-decoration:none;border-radius:2px;display:inline-block;font-weight:700;font-family:Arial,sans-serif">
            Open ${p.name} →
          </a>
        </p>
        <p style="color:#888;font-size:13px">If the button doesn't work, copy and paste this link:<br>${link}</p>
        <p style="color:#888;font-size:12px;margin-top:32px">Celar Marketing Lab · celarmarketinglab.com</p>
      </div>
    `
  });
}

module.exports = { sendAccessEmail };
