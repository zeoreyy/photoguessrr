# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev        # Start dev server
bun run build      # Production build (Cloudflare Workers target)
bun run preview    # Preview production build locally
bun run lint       # ESLint
bun run format     # Prettier
```

There are no tests. Type-check with `bunx tsc --noEmit`.

## Architecture

**PhotoGuessr** is a no-auth multiplayer party game where players upload photos and guess their locations on a map. Built with TanStack Start (SSR-capable React + file-based routing), Supabase (Postgres + Realtime + Storage), Tailwind v4, and Leaflet maps. Deployed to Cloudflare Workers.

### Routes

- `/` — home, join dialog
- `/create` — host creates a room (sets rounds, timer, photos-per-player)
- `/room/$code` — the entire game: lobby → playing → finished, driven by `room.state`

### Player identity

No accounts. Each browser gets a UUID stored in `localStorage` (`src/lib/playerSession.ts`). This UUID is the `players.id` in the DB. The host is identified by `is_host: true` on their player row; all host-only actions (start game, end round, next round) are gated on this flag client-side.

### Multiplayer sync

All state lives in Supabase. `room.$code.tsx` subscribes to Postgres Realtime changes on `rooms`, `players`, `photos`, `rounds`, and `guesses` tables via a single channel (`room-{id}`). The host's browser drives game progression — there is no server-side game logic.

### Game flow

1. **Lobby**: Players upload photos (stored at `rooms/{code}/{playerId}/{photoId}.jpg` in the `photos` bucket). GPS is extracted client-side with `exifr`; photos without GPS need a manual pin. Players mark ready when all photos are pinned/confirmed.
2. **Playing**: Host clicks "Start" → inserts `rounds` rows (one per photo, randomised) and sets `room.state = 'playing'`. Each round has a 5s preview phase then the configured timer. The host's browser calls `endRound()` when all non-submitters have guessed or `overtime >= 1.5s`. The photo's submitter does not score.
3. **Finished**: Final scoreboard. Host can "Play again" (resets to lobby, deletes photos/rounds/guesses) or "End game" (deletes the room).

### Scoring

`scoreFor(distanceKm, scopeDiagKm)` in `src/lib/game.ts`: `5000 * exp(-5 * d / D)`, capped 0–5000. `D` is the Haversine diagonal of the map scope's bounding box (world = ~20 015 km).

### Supabase schema

Five tables: `rooms`, `players`, `photos`, `rounds`, `guesses`. All use permissive RLS (no auth required). All tables have `REPLICA IDENTITY FULL` and are in the `supabase_realtime` publication. See `supabase/migrations/` for the full schema.

The Supabase client is at `src/integrations/supabase/client.ts` (auto-generated; don't hand-edit it).

### Vite config

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`. **Do not manually add** `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, or `cloudflare` plugins — they are already included by that wrapper and duplicates will break the build.

### Styling conventions

Black/dark-neutral background (`bg-black`, `bg-neutral-9xx`), yellow accent (`text-yellow-400`, `bg-yellow-400`), monospace uppercase tracking-widest for labels. `rounded-none` everywhere (no border-radius). Components use shadcn/ui primitives from `src/components/ui/`.
