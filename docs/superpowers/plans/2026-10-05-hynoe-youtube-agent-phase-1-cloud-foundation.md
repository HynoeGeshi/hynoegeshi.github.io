# Hynoe YouTube Agent Phase 1 — Cloud Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure cloud foundation for the Hynoe YouTube Agent: creator authentication, owner-isolated Supabase data, idempotent VOD/job creation, a minimal private queue dashboard, and a deployable Vercel app.

**Architecture:** Use a private `HynoeGeshi/hynoe-youtube-agent` repository containing a Next.js App Router dashboard plus Supabase migrations/tests. Browser code receives only the Supabase publishable key; privileged keys stay server-side. Database ownership is enforced by RLS using `auth.uid()` through `channels.owner_user_id`, and VOD enqueueing is atomic/idempotent in Postgres so duplicate triggers cannot create duplicate active jobs.

**Tech Stack:** Node.js 24.x; current stable Next.js App Router compatible with Node 24.x; TypeScript; pnpm; Supabase Auth/Postgres; `@supabase/ssr`; Vitest; Playwright for browser smoke tests; Vercel; PostgreSQL; gitleaks or an equivalent free secret scanner.

**Spec:** `docs/superpowers/specs/2026-10-05-hynoe-youtube-agent-design.md`

## Global Constraints

- The implementation repository must be private before application code is added.
- No OAuth client secret, refresh token, Gemini/API key, Supabase secret/service-role key, webhook secret, or machine credential may be committed.
- No privileged secret may use a `NEXT_PUBLIC_` prefix.
- Every table in the exposed `public` schema must have RLS enabled before production use.
- Authorization must use ownership predicates, not merely `TO authenticated`.
- Do not use user-editable `user_metadata` for authorization.
- Do not use `SECURITY DEFINER` to bypass RLS for normal application flows.
- All package versions must be pinned by the lockfile.
- Public publishing is out of scope for Phase 1.
- Heavy video/media processing is out of scope for Phase 1.
- Current Supabase docs/changelog must be checked before implementation because Supabase changes frequently.

## Review Focus

1. **Unauthenticated request:** protected pages and all creator data must be inaccessible and redirect/return 401 appropriately.
2. **Cross-owner access:** a second authenticated test user must not read, update, delete, or enqueue against another owner's channel/resources.
3. **Duplicate source:** two submissions for the same `channel_id + youtube_video_id` must yield one source and one active processing job.
4. **Secret leakage:** production/client bundles and repository history must contain no server secret or privileged key.
5. **Failure/retry state:** a failed database insert or malformed VOD input must return a readable error and must not leave a half-created orphan source/job pair.

---

### Task 1: Private Repository + Toolchain Guardrails

**Files:**
- Create in private repo: `.gitignore`
- Create in private repo: `.env.example`
- Create in private repo: `.nvmrc`
- Create in private repo: `README.md`
- Create in private repo: `package.json`
- Create in private repo: `pnpm-lock.yaml`
- Create in private repo: `apps/dashboard/**` via current stable Next.js App Router scaffold
- Create in private repo: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: approved design spec and this plan.
- Produces: a private repository with a buildable/testable Next.js app and CI baseline for later tasks.

- [ ] **Step 1: Create or verify private repository**

Repository name: `HynoeGeshi/hynoe-youtube-agent`.

Verify visibility is `private` before writing application code. The currently connected GitHub action set does not expose repository creation; if the repository does not yet exist, create it through an authorized GitHub surface before continuing.

- [ ] **Step 2: Set up an isolated implementation branch/worktree**

Branch: `feat/cloud-foundation`.

Verify the workspace is isolated before editing.

- [ ] **Step 3: Scaffold the dashboard**

Use Node `24.x`, pnpm, TypeScript, Next.js App Router, ESLint, and a `src/` directory. Do not add secrets while scaffolding.

- [ ] **Step 4: Add environment contract**

`.env.example` contains names only, never values:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_ORIGIN=
```

`SUPABASE_SECRET_KEY` must only be imported by server-only modules.

- [ ] **Step 5: Add baseline CI**

CI must run, at minimum:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

Add a free secret scan step covering tracked files and commits available to CI.

- [ ] **Step 6: Verify baseline**

Run locally:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: all pass before Supabase integration begins.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: bootstrap private youtube agent app"
```

---

### Task 2: Supabase Project + Core Schema

**Files:**
- Create: `supabase/config.toml`
- Create with Supabase CLI: `supabase/migrations/<generated>_cloud_foundation.sql`
- Create: `tests/db/schema.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: Supabase organization `Hynoe` (`gfrqlsylqbqdvopdnkdj`).
- Produces: project URL/publishable key/secret key environment configuration plus the Phase 1 database schema.

- [ ] **Step 1: Verify current Supabase guidance**

Check the current Supabase changelog and current docs for Auth, RLS, API keys, and migrations before applying schema changes.

- [ ] **Step 2: Confirm project cost before creation**

Use the `Hynoe` Supabase organization. Retrieve the current cost for a new project, present it, and obtain explicit confirmation before creating the project.

Project name: `hynoe-youtube-agent`.

Preferred region: `us-east-2` unless current account constraints make another U.S. region materially better.

- [ ] **Step 3: Initialize Supabase config and create migration through the CLI**

Discover current CLI syntax with `supabase --help` and `supabase migration new --help`.

Create migration named `cloud_foundation`; do not invent a timestamped filename manually.

- [ ] **Step 4: Write schema test first**

`tests/db/schema.test.ts` asserts these relations/constraints exist after migration:

- `channels`
- `video_sources`
- `processing_jobs`
- `job_events`
- FK from sources/jobs/events to `channels`
- unique source identity for non-null `youtube_video_id`
- valid job state constraint
- indexes on all `channel_id` foreign-key columns

- [ ] **Step 5: Implement the schema**

Create:

`channels`
- `id uuid primary key default gen_random_uuid()`
- `owner_user_id uuid not null references auth.users(id) on delete cascade`
- `youtube_channel_id text null`
- `name text not null`
- `created_at timestamptz not null default now()`
- unique index on `owner_user_id`
- unique partial index on non-null `youtube_channel_id`

`video_sources`
- `id uuid primary key default gen_random_uuid()`
- `channel_id uuid not null references channels(id) on delete cascade`
- `youtube_video_id text null`
- `source_type text not null check in ('youtube','local','manual')`
- `title text not null`
- `duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0)`
- `game_topic text null`
- `source_status text not null default 'discovered' check in ('discovered','queued','processing','ready','no_viable_clips','failed')`
- timestamps
- partial unique index on `(channel_id, youtube_video_id)` where YouTube ID is non-null

`processing_jobs`
- `id uuid primary key default gen_random_uuid()`
- `channel_id uuid not null references channels(id) on delete cascade`
- `video_source_id uuid not null references video_sources(id) on delete cascade`
- `state text not null default 'queued' check in ('queued','claimed','downloading','transcribing','analyzing','rendering','awaiting_review','completed','failed_retryable','failed_terminal')`
- `attempt_count integer not null default 0 check (attempt_count >= 0)`
- `claimed_by text null`
- `lease_expires_at timestamptz null`
- `error_code text null`
- `error_message text null`
- timestamps
- index on `(channel_id, state, created_at)`
- partial unique index ensuring one non-terminal active job per `video_source_id`

`job_events`
- `id bigint generated by default as identity primary key`
- `channel_id uuid not null references channels(id) on delete cascade`
- `job_id uuid not null references processing_jobs(id) on delete cascade`
- `actor_type text not null check in ('user','system','worker')`
- `event_type text not null`
- `details jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

- [ ] **Step 6: Apply schema and run schema tests**

Expected: migration applies once cleanly and all schema assertions pass.

- [ ] **Step 7: Commit**

```bash
git add supabase tests README.md .env.example
git commit -m "feat: add cloud foundation schema"
```

---

### Task 3: RLS + Ownership Isolation

**Files:**
- Modify: `supabase/migrations/<generated>_cloud_foundation.sql` while still in development, or create a new migration via `supabase migration new rls_policies` if the first migration has already been committed/applied to shared environments.
- Create: `tests/db/rls.test.ts`

**Interfaces:**
- Consumes: authenticated Supabase users and the four Phase 1 tables.
- Produces: database-enforced single-owner isolation for every creator table.

- [ ] **Step 1: Write failing RLS integration tests**

Create two temporary authenticated users A and B using an admin-only test client.

Assertions:

- anon cannot select from any Phase 1 table;
- A can read A's channel;
- B cannot read A's channel;
- B cannot insert/update/delete a source/job/event under A's channel;
- A can operate only on rows belonging to A's channel.

- [ ] **Step 2: Enable RLS on all four public tables**

Enable RLS explicitly on `channels`, `video_sources`, `processing_jobs`, and `job_events`.

- [ ] **Step 3: Add ownership policies**

`channels`: authorize when `(select auth.uid()) = owner_user_id`.

Child tables: authorize only when the referenced channel is owned by `(select auth.uid())`.

For UPDATE policies use both `USING` and `WITH CHECK`.

Do not rely on `TO authenticated` without the ownership predicate.

- [ ] **Step 4: Run RLS tests**

Expected: all cross-user/anon attempts are denied and owner operations pass.

- [ ] **Step 5: Run Supabase security advisors**

Fetch security advisors. Fix all Phase 1 findings related to RLS, exposed functions/views, and dangerous grants before continuing.

- [ ] **Step 6: Commit**

```bash
git add supabase tests/db/rls.test.ts
git commit -m "feat: enforce creator row level security"
```

---

### Task 4: Atomic Idempotent VOD Enqueue

**Files:**
- Create migration via CLI if needed: `supabase/migrations/<generated>_enqueue_video_source.sql`
- Create: `src/lib/jobs/types.ts`
- Create: `src/lib/jobs/enqueue-video-source.ts`
- Create: `tests/db/enqueue-video-source.test.ts`

**Interfaces:**
- Consumes: `channel_id`, `youtube_video_id | null`, `source_type`, `title`, optional `duration_seconds`, optional `game_topic`.
- Produces: `{ sourceId: string; jobId: string; created: boolean }`.

- [ ] **Step 1: Write failing idempotency tests**

Assertions:

- first YouTube submission creates one source and one queued job;
- second concurrent/successive submission with same `(channel_id, youtube_video_id)` returns the existing source/job and `created=false`;
- malformed source type or negative duration fails without inserting either row;
- user B cannot enqueue into user A's channel.

- [ ] **Step 2: Create database function `enqueue_video_source`**

Use an atomic PostgreSQL function executed with invoker rights. Revoke default execute from `PUBLIC`, then grant execute to `authenticated` only.

Signature:

```sql
enqueue_video_source(
  p_channel_id uuid,
  p_youtube_video_id text,
  p_source_type text,
  p_title text,
  p_duration_seconds integer default null,
  p_game_topic text default null
)
```

Return exactly:

```text
source_id uuid
job_id uuid
created boolean
```

The function must honor RLS and must not be `SECURITY DEFINER`.

- [ ] **Step 3: Implement TypeScript wrapper**

`enqueueVideoSource(input: EnqueueVideoSourceInput): Promise<EnqueueVideoSourceResult>` calls the RPC using the authenticated server client and maps database errors into typed application errors.

- [ ] **Step 4: Run tests**

Expected: duplicate submission produces exactly one source and one active job; no orphaned half-write exists on invalid input.

- [ ] **Step 5: Commit**

```bash
git add supabase src/lib/jobs tests/db/enqueue-video-source.test.ts
git commit -m "feat: add idempotent vod enqueue"
```

---

### Task 5: Supabase Auth + Protected App Shell

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/proxy.ts` if required by the current stable Next.js version
- Create: `src/app/login/page.tsx`
- Create: `src/app/(protected)/layout.tsx`
- Create: `src/app/(protected)/page.tsx`
- Create: `src/app/actions/auth.ts`
- Create: `tests/auth/protection.test.ts`
- Create: `tests/e2e/login.spec.ts`

**Interfaces:**
- Consumes: Supabase Auth session cookie.
- Produces: authenticated creator session and protected dashboard shell.

- [ ] **Step 1: Write failing protection tests**

Assertions:

- unauthenticated request to protected root redirects to `/login`;
- authenticated owner reaches protected root;
- server-only admin helper throws when imported from a client bundle test boundary;
- logout clears the session and returns to `/login`.

- [ ] **Step 2: Implement current recommended SSR client pattern**

Use current `@supabase/ssr` guidance, async cookie APIs required by the installed Next.js version, and Node runtime for server routes unless a feature requires otherwise.

- [ ] **Step 3: Implement email/password login**

Use Supabase Auth. Require verified email before privileged creator use. Do not authorize based on `user_metadata`.

- [ ] **Step 4: Implement protected layout**

Server-side user/session check guards all protected routes. Never rely only on client-side hiding.

- [ ] **Step 5: Run unit + browser smoke tests**

Expected: redirect/login/logout/protected access all work.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add protected creator authentication"
```

---

### Task 6: Minimal Queue Dashboard + Manual VOD Intake

**Files:**
- Create: `src/app/(protected)/queue/page.tsx`
- Create: `src/components/jobs/job-table.tsx`
- Create: `src/components/jobs/add-vod-form.tsx`
- Create: `src/app/actions/jobs.ts`
- Create: `src/lib/jobs/list-jobs.ts`
- Create: `tests/jobs/manual-intake.test.ts`
- Create: `tests/e2e/queue.spec.ts`

**Interfaces:**
- Consumes: authenticated owner channel plus `enqueueVideoSource()`.
- Produces: minimal creator UI for submitting a YouTube video ID/URL and viewing queued job state.

- [ ] **Step 1: Write failing intake tests**

Assertions:

- valid YouTube URL/ID resolves to a normalized video ID;
- duplicate submission creates no duplicate job;
- invalid URL/ID returns a readable validation error;
- job list contains only current owner's rows;
- queued state renders clearly.

- [ ] **Step 2: Implement server-side video ID normalization/validation**

Accept standard YouTube watch URLs, Shorts URLs, live URLs, and raw video IDs. Do not fetch external metadata yet; Phase 5 owns YouTube API enrichment.

- [ ] **Step 3: Implement queue page**

Display source title/input, source type, job state, created/updated times, and latest error if present.

- [ ] **Step 4: Implement manual intake form**

Submit through a Server Action that calls `enqueueVideoSource()` under the authenticated user's session.

- [ ] **Step 5: Run unit/e2e tests**

Expected: owner can submit once, see one queued job, and duplicate submission remains one job.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add secure vod queue dashboard"
```

---

### Task 7: Deployment + Security Verification

**Files:**
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/runbooks/cloud-foundation.md`

**Interfaces:**
- Consumes: passing dashboard build, Supabase project, environment values.
- Produces: reachable private-authenticated Vercel deployment and documented recovery/configuration steps.

- [ ] **Step 1: Create/reuse Vercel project**

Project name: `hynoe-youtube-agent`.

Framework: Next.js.

Node version: `24.x`.

Do not put secret values into git-linked project files.

- [ ] **Step 2: Configure environment variables in Vercel**

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only sensitive:

- `SUPABASE_SECRET_KEY`

Set server-only key as encrypted/sensitive and never expose it through a `NEXT_PUBLIC_` name.

- [ ] **Step 3: Deploy preview and verify**

Check deployment/build logs. Verify `/login` loads and protected `/queue` rejects unauthenticated access.

- [ ] **Step 4: Run security checks**

Run:

- repository secret scan;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- RLS integration tests;
- Supabase security advisors;
- manual browser/network inspection confirming no secret key appears in HTML/JS/network responses.

- [ ] **Step 5: Verify Phase 1 end-to-end acceptance**

Create test owner account/channel, sign in, submit one VOD twice, and confirm:

- one source row;
- one active processing job;
- queue shows one job;
- second test user sees none of those rows;
- unauthenticated user sees none;
- no privileged key is present in client assets.

- [ ] **Step 6: Document operations**

`docs/runbooks/cloud-foundation.md` covers:

- required environment variable names;
- how to rotate the Supabase server key;
- how to disable access quickly;
- how to read job/error state;
- how to re-run security advisors;
- how to deploy/rollback on Vercel.

- [ ] **Step 7: Final commit**

```bash
git add README.md .github docs
git commit -m "chore: verify and document cloud foundation"
```

## Phase 1 Completion Gate

Do not begin the Windows worker until all of the following are true:

- private repository confirmed;
- CI green;
- Vercel deployment green;
- owner authentication works;
- RLS isolation tests pass for anon/user A/user B;
- duplicate VOD test creates exactly one source and one active job;
- Supabase security advisors have no unresolved Phase 1 security finding;
- client-bundle/network inspection finds no privileged secret;
- manual queue flow passes in deployed preview/production environment.
