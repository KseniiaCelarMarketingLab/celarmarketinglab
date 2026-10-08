# Celar Marketing Lab - static site

Upload the contents of this folder to the root of the GitHub repo connected to Vercel. No build step.

## Files
- 14 HTML pages (index, services, cases, eu-market-entry, academy, about, blog, 5 articles, privacy, 404)
- img-*.webp images, favicon.png, og-*.png link previews (1200x630)
- robots.txt, sitemap.xml, vercel.json (clean URLs, /blog/:slug rewrite, old URL redirects)

## Not fully static (notes)
- Fonts load from Google Fonts (Archivo, Chakra Petch), not self-hosted.
- Home: the 6 service directions are all in the HTML; 5 of them are hidden until a visitor picks one. The quiz needs JavaScript; without it a list of the questions and a link to Services is shown.
- Services: service detail windows are in the HTML but hidden until a card is clicked.
- Cases: without JavaScript all six cases are shown one after another under the list.
- Academy dashboard is a demo: progress and saved tips reset on reload.
- Blog articles have no publish date in the source, so Article datePublished is set to 2026-10-08. Update it in the build if you have real dates.
- Footer company details (KvK, BTW) still to add.
