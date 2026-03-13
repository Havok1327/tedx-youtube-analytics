# TEDx YouTube Analytics — Claude Instructions

## Project Overview
Next.js 16 + Drizzle ORM + Turso (libSQL) + Vercel app for tracking TEDx St. Louis YouTube videos.
See `SESSION_NOTES.md` for full architecture, schema, and workflow details.

## Critical Rules

### ⚠️ Local vs Production Video IDs Don't Match
Video IDs in `local.db` differ from production Turso. **Always match by `youtube_id`** when
pushing locally-generated data to production. Never use local `video_id` directly in prod inserts.

### DB Migration Workflow
```bash
npx vercel env pull --scope tedx-admins-projects --environment production .env.production
set -a && source .env.production && set +a && npx drizzle-kit push
rm .env.production
```

### Deployment
- Always deploy via **git push** to master — `npx vercel --prod` doesn't pick up env vars
- Vercel auto-deploys from GitHub master branch

### Python Pipeline
- Must be run in a **separate terminal**, NOT inside Claude Code (Claude CLI can't nest sessions)
- All phases are incremental — safe to re-run, skips existing data
- `scripts/tedx_pipeline.py phase4` takes ~60-90 min for all videos

## Key Files
- `SESSION_NOTES.md` — Full reference: schema, routes, workflows, history
- `PLAN-exec-feedback.md` — Feature roadmap
- `src/db/schema.ts` — Drizzle schema (13 tables)
- `scripts/tedx_pipeline.py` — AI pipeline (phases 1-4)
- `scripts/text_utils.py` — Timestamp correction utilities
- `scripts/push_key_moments_prod.js` — Pattern for pushing local data to prod by youtube_id

## Database
- Local: `local.db` (SQLite, set via `TURSO_DATABASE_URL=file:local.db` in `.env.local`)
- Production: Turso remote DB (credentials in Vercel)
- Use `@libsql/client/web` (not `@libsql/client`) in serverless — required for Vercel compatibility
