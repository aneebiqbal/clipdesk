# ClipDesk

Turn a downloaded YouTube stream VOD into ready-to-upload 9:16 YouTube Shorts: word-highlighted
captions, AI hook/outro voice-over, and procedurally generated copyright-free music.

## Stack

- `apps/web` — Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui-style primitives
- `apps/api` — Express + Prisma + BullMQ (standalone API, no Next.js API routes)
- `packages/types` — shared Zod schemas and inferred types
- `worker/` — Python pipeline (faster-whisper, Edge TTS, FFmpeg). Copied unchanged from the
  `shorts-agent` prototype; `run_json.py` is a thin JSON-lines wrapper around `agent.py`.

## Prerequisites

- Node.js 20+, npm
- Python 3 with the worker requirements installed: `pip install -r worker/requirements.txt`.
  Then pin PyAV: `pip install "av==18.1.0"`. faster-whisper 1.2.1 calls
  `av.open(..., metadata_errors=...)`, which PyAV 19 removed; Python 3.14 also needs
  `av>=16` for wheels.
- FFmpeg + ffprobe on `PATH`
- Docker (for Postgres and Redis)

## Environment

The backend reads `.env` at the repository root (loaded with `dotenv-cli`). The web app reads
`NEXT_PUBLIC_API_URL` from its environment and falls back to `http://localhost:8765`.

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000 (web) and http://localhost:8765/api/health (API).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Turbo starts the web app (3000) and API (8765) |
| `npm run build` | Build all packages |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Create the default Settings row and built-in topics |
| `npm run lint` | ESLint across the monorepo |
| `npm run typecheck` | `tsc --noEmit` across the monorepo |

## Content Brief (topics & scripts)

Before processing, describe what happened in the stream. The **Content Brief** panel on the main
page lets you create topics, write scripts (description + transcript keywords), and drop manual
timestamps. Two built-in topics are always present: **Voice Highlights** (energy/excited-speech
detection) and **Custom Timestamps**.

- Topics and scripts are persisted (`/api/topics`, `/api/scripts`) and reorderable by drag.
- Manual timestamps are job-scoped and sent with the job.
- The brief auto-saves as a `Brief` record (`/api/briefs`); "Templates" saves/loads named briefs.
- When a job starts, the API resolves the brief to `brief.json` and the Python worker
  (`brief_matcher.py` + `llm_matcher.py`) merges script, energy and manual candidates, tags each
  clip with `topicId` / `scriptId` / `matchScore` / `matchMethod`, and splits long matches into
  series parts.
- The gallery groups clips by topic; the clip modal shows match info, hook variants, thumbnail
  options and feedback buttons.

If a job has no brief, the pipeline runs exactly as before.

## Notes

- The pipeline runs one job at a time (BullMQ concurrency 1) because FFmpeg/Whisper are CPU-heavy.
- Uploaded files live in `storage/uploads`, renders in `storage/output`, temp work in `storage/work`.
- Clip media is served by the API at `/media/<relative path>`; the web app talks to the API via
  `NEXT_PUBLIC_API_URL`.
- No authentication yet; the single-user middleware hook lives in `apps/api/src/lib/http.ts`.
