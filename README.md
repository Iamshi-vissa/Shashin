# Shashin 写真

One photo a day, only for your friends. A private photo diary: each person posts one picture a day,
only accepted friends can see it, and the Library collects every week like an album.

**Stack:** React + Vite + TypeScript · Tailwind CSS · motion (React Bits–style components) ·
TanStack Query · Supabase (Postgres, Auth, Storage, RLS).

## Run it

You need [Node.js LTS](https://nodejs.org) (v20+).

```bash
npm install
npm run dev
```

Open http://localhost:5173 on your computer.

**On your phone:** keep your phone on the same Wi-Fi, then open the `Network:` address that
`npm run dev` prints (for example `http://192.168.1.23:5173`). For an app-like experience use your
browser's **Add to Home Screen**.

### Demo mode vs. Supabase

With no `.env` file the app runs in **demo mode**: accounts and photos are stored in your browser
(IndexedDB) and a few demo friends (Aiko, Kenji, Mei, Ravi) are created so the feed and Library have
something to show. Use **Friends → your avatar → Reset demo data** to start over.

To use the real backend so friends on other phones can see your photos:

1. Create a free project at [supabase.com](https://supabase.com) (e.g. region Mumbai, `ap-south-1`).
2. In the dashboard open **SQL Editor**, paste the contents of
   [`supabase/migrations/20261108000000_init.sql`](supabase/migrations/20261108000000_init.sql) and
   run it. This creates the tables, Row Level Security rules, the `photos` / `avatars` storage
   buckets and Realtime.
3. For quick testing, turn off **Authentication → Sign In / Providers → Email → Confirm email**
   (turn it back on before real users join).
4. Copy `.env.example` to `.env` and fill in **Project URL** and the **publishable (anon) key** from
   **Project Settings → API**. Never use the `service_role` key in the app.
5. Restart `npm run dev`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, reachable from your phone on the same network |
| `npm run check` | Lint + typecheck + unit tests + production build |
| `npm test` | Unit tests (date and streak logic) |
| `npm run build` / `npm run preview` | Production build and local preview |

## Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new). Framework **Vite**, build
   `npm run build`, output `dist` (auto-detected). `vercel.json` already handles SPA routes.
2. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your Vercel domain and
   add it to Redirect URLs.

## Project layout

```
src/
  components/bits/   BlurText, Aurora, Dock, CountUp, ClickSpark, FadeContent, SpotlightCard
  components/        PhotoViewer, PersonRow, ProfileSheet, ui/ primitives
  screens/           SignIn, Today, PostScreen, Library, Friends, AddByUsername
  lib/backend/       Backend interface + Supabase and local demo implementations
  lib/dates.ts       Local-day, week and streak helpers (+ tests)
supabase/migrations/ Database schema, RLS and storage policies
```
