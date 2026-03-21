# ExamOps

ExamOps is a bilingual operations platform for exam proctoring management.

The repository now includes:

- planning and tracking docs under `docs/`
- the canonical Prisma schema under `prisma/schema.prisma`
- a real Next.js App Router foundation under `src/`

## Start Here

- `AI_START_HERE.md`
- `CODEX_PROMPT.md`
- `docs/examops-spec-v3.md`
- `docs/examops-master-plan.md`
- `docs/backlog.md`
- `PROJECT_STATUS.md`

## Local Development

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Run the first migration with `npm run db:migrate`.
4. Seed the database with `npm run db:seed`.
5. Run the app with `npm run dev`.

Runtime auth variables:

- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `NEXTAUTH_URL` (required in production, for example `https://est-weld-delta.vercel.app`)

Production database variables:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL` (recommended for migrations)

Optional seed variable:

- `SEED_APP_USERS_PASSWORD`

Default seeded accounts include:

- `admin@examops.local`
- `coordinator@examops.local`
- `dataentry@examops.local`
- `senior@examops.local`
- `viewer@examops.local`

## Current Foundation Notes

- The current bootstrap targets Next.js `14.2.x`.
- This choice is intentional because the workspace Node version is `19.6.0`, while the latest Next.js `16.x` line requires Node `20.9.0` or newer.
- Database-backed auth now expects seeded `app_users` records with hashed passwords.
- Bilingual shell, theme controls, and the remaining foundation work are tracked in `docs/backlog.md`.
- Vercel deploys run `prisma generate`, `prisma migrate deploy`, and `prisma db seed` via `npm run build:vercel`.
