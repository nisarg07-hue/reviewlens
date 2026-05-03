# ReviewLens — AI Review Intelligence

Paste any Amazon, G2, or Trustpilot URL. Get an AI-powered breakdown of pain points, praises, and improvement suggestions in 30 seconds.

## Stack (100% free tier)

| Layer | Service | Free limit |
|---|---|---|
| Frontend + Hosting | Next.js 14 + Vercel | 100GB/mo |
| Database + Auth | Supabase | 500MB, 50k MAU |
| AI Analysis | Claude API (Sonnet) | Pay per use |
| Amazon scraping | RapidAPI | 500 calls/mo |
| G2 scraping | Cheerio / ScrapingBee | 1000 credits |
| Trustpilot | Official Consumer API | Free |
| Payments | Stripe | Free until revenue |

---

## Setup (15 minutes)

### 1. Clone and install

```bash
git clone <your-repo>
cd reviewlens
npm install
```

### 2. Copy env file

```bash
cp .env.example .env.local
```

Fill in at minimum:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New query**
3. Paste the contents of `supabase-schema.sql` and run it
4. Copy your project URL and keys from **Settings → API**

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Optional API keys (add for better scraping)

| Key | Where to get | Free limit |
|---|---|---|
| `RAPIDAPI_KEY` | [rapidapi.com](https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data) | 500 calls/mo |
| `TRUSTPILOT_API_KEY` | [developers.trustpilot.com](https://developers.trustpilot.com) | Free |
| `SCRAPINGBEE_KEY` | [scrapingbee.com](https://www.scrapingbee.com) | 1000 credits |

The app works without these — it falls back to direct scraping — but Amazon blocks direct requests aggressively.

---

## Deploy to Vercel (5 minutes)

```bash
npm i -g vercel
vercel --prod
```

When prompted, add your env variables via the Vercel dashboard (**Settings → Environment Variables**).

---

## Project structure

```
reviewlens/
├── app/
│   ├── page.tsx              ← Landing page + URL input
│   ├── analyze/page.tsx      ← Analysis results
│   └── api/analyze/route.ts  ← Scraping + Claude orchestration
├── lib/
│   ├── claude.ts             ← Claude API integration
│   ├── supabase.ts           ← DB helpers + usage tracking
│   └── scrapers/
│       ├── index.ts          ← Platform detection + dispatcher
│       ├── amazon.ts         ← Amazon (RapidAPI + Cheerio fallback)
│       ├── g2.ts             ← G2 (Cheerio)
│       └── trustpilot.ts     ← Trustpilot (API + public scrape fallback)
├── types/index.ts            ← All TypeScript types
└── supabase-schema.sql       ← DB schema (run in Supabase SQL editor)
```

---

## Monetization (already wired)

- Free tier: 3 reports/month (tracked in `users.reports_this_month`)
- Pro ($29/mo): 50 reports — add Stripe checkout
- Agency ($79/mo): unlimited

To add Stripe: see [stripe.com/docs/billing/quickstart](https://stripe.com/docs/billing/quickstart)

---

## Roadmap

- [ ] Auth (Supabase email magic link — 10 min to add)
- [ ] Stripe checkout + webhook
- [ ] PDF export
- [ ] Competitor comparison (analyze 2 URLs side by side)
- [ ] Google Maps + Yelp scrapers
- [ ] Weekly re-analysis alerts (Supabase cron + Resend)
