# Hynoe YouTube Agent — Design Specification

**Date:** 2026-10-05
**Status:** Proposed for implementation
**Owner:** Hynoe

## 1. Purpose

Build a semi-automatic YouTube operations agent for the Hynoe channel that converts real livestreams and uploaded gameplay into reusable content, reduces repetitive channel-management work, and improves recommendations over time using the channel's own analytics.

The system must preserve Hynoe's personality, gameplay, face/logo usage, and creative control. It must not become a faceless auto-content generator. Automation should handle repetitive research, transcription, clipping, formatting, metadata, scheduling preparation, analytics, and recommendations while keeping publishing-sensitive actions behind an approval gate.

## 2. Success Criteria

V1 is successful when it can:

1. Detect a completed YouTube stream or manually submitted VOD.
2. Create a processing job without manual copy/paste.
3. Process long gameplay locally on the creator PC using the RTX 4070 where possible.
4. Transcribe the VOD with timestamps.
5. Identify candidate highlights and rank them for Short potential.
6. Produce 3-8 candidate vertical clips from a typical long stream when enough good moments exist.
7. Generate captions, hook/title suggestions, descriptions, hashtags, and source timestamps for each candidate.
8. Surface candidates in a private approval dashboard with Approve, Reject, and Edit actions.
9. Never publish public content without an explicit approval event in V1.
10. Prepare approved content for YouTube and track publishing status.
11. Pull 24-hour and 7-day performance data after publication.
12. Feed performance back into future clip scoring and recommendations.
13. Keep all API keys, OAuth refresh tokens, service-role keys, and AI credentials out of the public GitHub Pages repository and browser-visible code.
14. Remain useful on a free-first stack, with paid services optional rather than required.

## 3. Architectural Choice

Use a **hybrid architecture**.

### Cloud control plane

The cloud side is responsible for jobs, state, authentication, approvals, YouTube metadata/actions, analytics ingestion, and the dashboard. It must remain available even when the gaming PC is off.

Primary components:

- **Supabase** for Postgres, authentication, row-level security, job state, clip metadata, analytics, and secure server-side functions where useful.
- **Activepieces** for free-first orchestration where it materially reduces custom integration code, especially YouTube triggers/actions and scheduled workflows.
- **Private dashboard web app** for reviewing jobs, clips, metadata, performance, and recommendations.
- **YouTube Data API / YouTube Analytics API** for first-party channel control and reporting.
- **Gemini free tier or another explicitly configured AI provider** for text-level reasoning, metadata generation, transcript summarization, clip-ranking support, and analytics summaries. Provider usage must be abstracted enough to swap later.

### Local media worker

A Windows-local worker runs on Hynoe's gaming PC and performs heavy media work:

- Faster-Whisper transcription with timestamps.
- FFmpeg media extraction, cropping, re-encoding, audio normalization, and caption burn-in.
- PySceneDetect or equivalent scene/change detection where it helps candidate discovery.
- Optional local model support through Ollama later.

The local worker polls or subscribes for pending jobs, downloads or accesses the source file, processes it, uploads lightweight outputs/metadata to the cloud, and marks job stages complete.

### Why hybrid

Long-form video processing is the most expensive part of the workflow. Running it on the existing RTX 4070 avoids recurring cloud GPU/video-processing costs while preserving a cloud dashboard and channel automation even when local processing is idle.

## 4. Security Model

Security is a hard requirement.

- No OAuth client secrets, refresh tokens, AI keys, Supabase service-role keys, webhook secrets, or privileged API credentials may be committed to GitHub.
- The existing `hynoegeshi.github.io` repository remains public-facing/static and must not contain privileged backend logic or secrets.
- Privileged YouTube actions execute only in server-side code or trusted automation infrastructure.
- The browser dashboard uses a publishable Supabase key only and relies on RLS.
- All creator-only tables require authenticated access and creator ownership checks.
- Service-role access is limited to server-side functions and local-worker authentication flows.
- Local worker authentication uses a rotatable machine credential or signed token, never a hardcoded public secret.
- Webhooks must be signed/verified where providers support signatures.
- All state-changing endpoints validate input server-side.
- Sensitive logs must redact tokens and Authorization headers.
- CORS is limited to known dashboard origins.
- Rate limits must protect login, worker polling, approval actions, and public callback endpoints.
- Database migrations must enable RLS before creator data is considered production-ready.

## 5. Core Data Model

Minimum logical entities:

### `channels`
Creator/channel configuration including YouTube channel identity and non-secret preferences.

### `video_sources`
Represents livestream VODs, uploads, or manually submitted source media.

Key fields: YouTube video ID, source type, duration, game/topic, source status, timestamps.

### `processing_jobs`
One media-processing workflow per source.

States:
`queued -> claimed -> downloading -> transcribing -> analyzing -> rendering -> awaiting_review -> completed`

Failure states include `failed_retryable` and `failed_terminal` with human-readable error messages.

### `transcript_segments`
Timestamped transcript chunks with start/end offsets, text, and optional confidence.

### `clip_candidates`
Proposed Short/highlight candidates.

Fields include source start/end time, duration, score, score reasons, transcript excerpt, hook, title, description, hashtags, render path/status, approval state, and reviewer edits.

### `publishing_jobs`
Tracks approved content through upload, privacy state, schedule, publication, and API errors.

### `analytics_snapshots`
Metrics captured by video/Short and time horizon.

V1 metrics include views, watch time, average view duration, average percentage viewed where available, likes, comments, shares where available, subscribers gained/lost, impressions/CTR where accessible, and retention-derived signals where available.

### `learning_signals`
Derived features that summarize what works for the Hynoe channel: clip duration bands, early-hook timing, game/topic, reaction density, caption density, moment category, title style, posting window, and normalized performance.

### `recommendations`
Agent-generated next actions such as stream angle, moments to intentionally create, title concepts, clip patterns, and metadata suggestions.

## 6. Processing Pipeline

### Stage A — Source detection

Preferred detection order:

1. YouTube completed-stream/new-video trigger when reliable.
2. Scheduled reconciliation job that checks for missed uploads.
3. Manual "Add VOD" fallback in the dashboard.

The system must deduplicate by YouTube video ID/source identity.

### Stage B — Job creation

Create a `processing_job` with source metadata and initial status. A source must never receive duplicate active jobs unless the user explicitly requests reprocessing.

### Stage C — Local claim

The local worker authenticates and claims one queued job at a time by default. A lease/heartbeat prevents two workers from processing the same job.

If the PC is off, jobs remain queued safely.

### Stage D — Transcription

Use Faster-Whisper with GPU acceleration when CUDA is available. Produce timestamped segments. Store transcript text/metadata in Supabase, not giant raw intermediary files.

### Stage E — Candidate discovery

Candidate windows are generated using a combination of:

- transcript events and reactions;
- scene/action changes;
- silence/dead-air avoidance;
- keyword/event heuristics;
- source metadata/game context;
- AI ranking over compact transcript windows rather than blindly sending the entire raw VOD to an LLM.

Moment categories should include at minimum:

- funny/reaction;
- death/fail/rage;
- boss/combat;
- rare item/drop/discovery;
- build/reveal;
- player interaction/drama;
- challenge/result;
- tutorial/useful insight;
- surprising bug/chaos;
- high-stakes progression.

### Stage F — Scoring

Each candidate receives a 0-100 score and human-readable reasons.

Initial V1 score combines:

- immediate-context clarity;
- hook strength in first seconds;
- reaction/emotion;
- novelty/surprise;
- payoff strength;
- dead-air penalty;
- length suitability;
- game/topic relevance;
- duplication penalty against other candidates.

Later versions add learned weights from actual Hynoe performance.

### Stage G — Render

For selected candidates:

- produce 9:16 output;
- target Shorts-compatible resolution;
- intelligently crop/reframe gameplay without cutting critical HUD/context;
- preserve original voice/audio;
- add readable captions;
- avoid excessive subtitle animation that hurts gameplay readability;
- include safe padding for Shorts UI overlays;
- export a review-quality MP4 plus thumbnail/preview image if useful.

No generative replacement of Hynoe's face/voice is required for V1.

### Stage H — Metadata generation

For each candidate generate:

- concise hook/title options;
- description;
- hashtags;
- source timestamp;
- category/reasoning;
- predicted strengths/weaknesses.

Generated metadata must be editable in the dashboard before approval.

## 7. Approval Dashboard

The dashboard is creator-only.

### Main queue

Show:

- source stream/video;
- processing status;
- candidate count;
- failures/retry controls;
- latest performance summary.

### Candidate review card

Each clip card shows:

- video preview;
- score;
- score reasons;
- duration;
- source timestamp;
- title/hook;
- description/hashtags;
- Approve;
- Reject;
- Edit;
- Re-render if crop/caption settings change.

Approval must create an auditable approval event before any publishing action.

### Publishing area

Show pending, uploaded-private, scheduled, published, failed, and retriable states. API errors must be translated into useful messages rather than raw provider payloads only.

### Analytics area

Show 24-hour and 7-day snapshots for published clips and compare them against recent channel baselines.

### Recommendation area

Show actionable findings such as:

- "Boss/reaction clips are outperforming build clips this week."
- "Your best-performing Shorts reveal the payoff before second 2."
- "18-28 second clips are retaining better than 35-50 second clips."
- suggested stream angle;
- 2-4 moments to intentionally create during the next stream;
- title/thumbnail concept direction.

Recommendations must be grounded in available data; when sample size is small, label confidence as low rather than pretending certainty.

## 8. Publishing Safety

V1 defaults to **approval required**.

- Reject: no publishing action.
- Approve: clip becomes eligible for upload/preparation.
- Public publishing must not happen without the user-approved workflow state.
- If YouTube API restrictions force new-project uploads to remain private until compliance is completed, the system must gracefully support private upload/review rather than failing the whole workflow.
- A later setting may allow auto-scheduling only after enough successful manual approvals and explicit user enablement.

## 9. Analytics Feedback Loop

After publication:

- fetch metrics at approximately 24 hours and 7 days;
- normalize performance against recent Shorts of similar age rather than comparing raw views across different exposure windows;
- update learning signals;
- retain a readable explanation of what changed in recommendations.

V1 learning should be rules/statistics based where possible, not a black-box self-modifying model. This makes recommendations debuggable and prevents unstable behavior from small datasets.

## 10. Free-First Constraints

The system should operate with no required recurring software bill for V1 where current free tiers permit.

- Local PC handles heavy video compute.
- Supabase free tier stores metadata, auth, and analytics.
- Activepieces free tier handles a bounded number of automations.
- Gemini free tier is the initial text/analysis provider where sufficient.
- FFmpeg, Faster-Whisper, and PySceneDetect are local/open-source.

If a free limit is exceeded, the system must fail visibly or fall back rather than silently generating charges.

Large raw VOD files should not be stored long-term in Supabase. Prefer YouTube/local files as the source of truth and store only outputs that need review/distribution.

## 11. Reliability Requirements

- Every pipeline stage is idempotent or guarded against duplicate execution.
- Jobs keep timestamps and error states.
- Retryable failures can be retried from the failed stage without redoing successful expensive work where practical.
- Worker crashes do not leave jobs permanently locked; leases expire.
- Missing local source files result in a clear recoverable state.
- Duplicate YouTube triggers do not create duplicate uploads.
- API rate/quota errors back off rather than loop aggressively.
- Unsupported/very short videos can be marked "no viable clips" instead of forcing output.

## 12. Observability

Provide simple structured logs for:

- job ID;
- source ID;
- stage;
- duration;
- success/failure;
- error category;
- worker version.

Dashboard should expose a readable event timeline per job so debugging does not require opening raw logs first.

## 13. V1 Scope

### Included

- YouTube source detection/manual fallback.
- Secure creator login.
- Processing queue.
- Windows local worker.
- Faster-Whisper transcription.
- Candidate identification/scoring.
- 9:16 FFmpeg render.
- Captions.
- Metadata generation.
- Approval dashboard.
- YouTube upload/preparation flow behind approval.
- Analytics snapshots.
- Basic learning signals and recommendations.
- Retry/error visibility.

### Explicitly deferred

- Fully automatic public publishing without approval.
- Automatic thumbnail generation/replacement.
- Automatic reply-to-comments bot.
- Cross-posting to TikTok/Instagram.
- Cloud GPU rendering.
- Multi-user/team permissions beyond the creator account.
- Fully autonomous long-form video editing.
- Revenue/ad optimization.
- Paid AI/video providers.

These can be added after V1 is stable.

## 14. Implementation Boundaries

The public Hynoe site may later link to the private dashboard, but the dashboard/backend must not rely on GitHub Pages for privileged operations.

Implementation should be split into independently testable subsystems:

1. Cloud data/auth foundation.
2. Local worker and processing contract.
3. Clip analysis/render pipeline.
4. Approval dashboard.
5. YouTube publishing integration.
6. Analytics and feedback loop.
7. Orchestration/automation hardening.

The implementation plan must use test-driven development for application logic and include security checks for RLS, authorization boundaries, duplicate job handling, token/secret exposure, and approval gating.

## 15. Acceptance Test Scenario

A representative end-to-end test is:

1. A completed Minecraft or Gears stream is detected or submitted.
2. One processing job appears in the dashboard.
3. With the PC online, the local worker claims the job.
4. The transcript appears with timestamps.
5. The system finds multiple candidate moments and rejects obvious dead-air sections.
6. At least the top viable candidates render successfully to vertical review files.
7. The dashboard shows score, reason, preview, title, description, hashtags, and source timestamp.
8. Rejecting a clip never creates a publishing job.
9. Editing and approving a clip creates exactly one publishing job.
10. The upload remains non-public until the configured approval/publishing state allows it.
11. After publication, analytics snapshots populate at scheduled checkpoints.
12. Recommendations reference actual observed performance and include confidence when evidence is weak.

## 16. Non-Negotiables

- Never expose secrets in public GitHub, client JavaScript, logs, or generated pages.
- Never auto-publish public content in V1 without explicit approval.
- Never fabricate analytics or trend conclusions when data is missing.
- Never force low-quality clips just to hit a quota.
- Keep Hynoe's real gameplay/personality central to the content.
- Prefer reliability, recoverability, and explainability over maximum automation.
