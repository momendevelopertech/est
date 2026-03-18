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
3. Run the app with `npm run dev`.
4. Generate the Prisma client with `npm run db:generate`.

Bootstrap auth variables:

- `AUTH_SECRET`
- `AUTH_BOOTSTRAP_EMAIL`
- `AUTH_BOOTSTRAP_PASSWORD`
- `AUTH_BOOTSTRAP_NAME`
- `AUTH_BOOTSTRAP_ROLE`

## Current Foundation Notes

- The current bootstrap targets Next.js `14.2.x`.
- This choice is intentional because the workspace Node version is `19.6.0`, while the latest Next.js `16.x` line requires Node `20.9.0` or newer.
- Bilingual shell, theme controls, auth, and route groups are planned next and tracked in `docs/backlog.md`.
