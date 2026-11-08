# Shashin (写真)

A private daily-photo app. Each user posts one photo per day, only their accepted friends can see it,
and a Library dashboard shows every week's posts like an album.

## Stack
- React + Vite + TypeScript (strict), Tailwind CSS v4 (Vite plugin), React Router, TanStack Query.
- Animation: `motion`. React Bits–style components live in `src/components/bits` (BlurText, Aurora,
  Dock, CountUp, ClickSpark, FadeContent, SpotlightCard). Prefer adding real React Bits components
  (`npx shadcn@latest add @react-bits/<Name>-TS-TW`) when they fit.
- Backend: Supabase (Postgres, Auth, Storage, RLS). When `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_PUBLISHABLE_KEY` are not set, the app runs in **demo mode** on IndexedDB
  (`src/lib/backend/local.ts`) so it works with zero setup.
- Mobile: mobile-first web app + PWA manifest now; Capacitor for Android/iOS later.

## Design direction
Dark, warm, minimal, film-photo feel. Accent `#FFD84D` on near-black `#0E0E10`. Design at 390px wide,
large touch targets, safe-area padding. WebGL / heavy backgrounds only on the sign-in screen.
Respect `prefers-reduced-motion`.

## Rules
- Small components in `src/components`; screens in `src/screens`.
- Data access only through `src/lib` (the `Backend` interface in `src/lib/backend/types.ts`).
  Both backends (Supabase and demo) must implement every method.
- Dates: always use `src/lib/dates.ts` (`localDate()` is the phone's local day, never UTC).
- Never commit secrets (`.env` is gitignored). Only the publishable/anon key goes in the client.
- Every DB change is a migration file in `supabase/migrations`.

## Git rules
- Never add Co-Authored-By, Claude-Session, "Generated with Claude Code" or any other Claude/AI
  attribution to commit messages or PR descriptions.
- Commits use the repo's configured git user only. Use Conventional Commits (feat:, fix:, chore:).

## Workflow
Build in phases. At the end of each phase run `npm run check` (lint + typecheck + tests + build),
then commit.
