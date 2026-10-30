# Forge and PM Tracker website

Plain HTML and CSS with no build step. Links are relative, so the site works on GitHub Pages and on any later host.

| Path | Page |
|---|---|
| `index.html` | Home, both products |
| `forge/` | Forge |
| `pm-tracker/` | PM Tracker |
| `contact/` | Contact form |
| `privacy/` | Privacy note |
| `assets/site.js` | Contact form settings |

No license or customer data belongs in this repo. It is public.

## Changing prices

Double-click `tools/edit-prices.bat`. Edit, press Save, then Publish. Prices live in `data/pricing.json`, and the pricing page reads them when it loads. On another PC, clone this repo and press "Pull latest prices" first.

## Rebuilding the PDFs

Run `python tools/build_overviews.py` after changing screenshots or wording, or when the domain changes. The PDFs leave out prices.

## Before launch

- [ ] Paste the Web3Forms key into `assets/site.js`, then send a test message.
- [ ] Create a GoatCounter site and paste its code into `assets/site.js` to switch on analytics.
- [ ] Seed a fictional company with on-time work and re-shoot Forge's screenshots, plus its machine board. PM Tracker's were re-shot on 2026-10-30 from staged demo data, so keep the "Sample data" labels.
- [ ] Add the demo videos (marked on the product pages).
- [ ] Swap the email in `assets/site.js` for the dedicated address.
- [ ] Remove `<meta name="robots" content="noindex">` from every page.
- [ ] Replace "Forge + PM Tracker" with the company name, and add a logo.
- [ ] Confirm the PM Tracker name.
- [ ] Never use PM Tracker's `login.png`, which shows demo passwords. Don't show drawings.
- [ ] Re-check every claim with the product sessions. Don't say "compliant", "certified" or "validated", and don't name competitors.
- [ ] Add real customer logos, results and quotes, with permission (marked on the home page).
- [ ] Add pricing if you decide to publish it.
- [ ] Add a real domain, `sitemap.xml` and `robots.txt`.
