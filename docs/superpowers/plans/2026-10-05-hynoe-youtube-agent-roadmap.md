# Hynoe YouTube Agent Implementation Roadmap

> **For agentic workers:** This roadmap decomposes the approved design into independently testable plans. Implement one phase at a time and do not merge a later phase until the current phase passes its acceptance checks.

**Goal:** Ship the Hynoe YouTube Agent as seven small, testable releases instead of one high-risk all-at-once build.

**Spec:** `docs/superpowers/specs/2026-10-05-hynoe-youtube-agent-design.md`

## Phase 1 — Secure Cloud Foundation

Deliver a private authenticated control plane with Supabase schema/RLS, a minimal queue dashboard, idempotent source/job creation, secret handling, and a deployable Next.js app.

**Exit criteria:** creator login works; unauthenticated/cross-user access is blocked; one submitted VOD creates exactly one active processing job; queue is visible; no secret is exposed to the browser or repository; security checks pass.

Plan: `docs/superpowers/plans/2026-10-05-hynoe-youtube-agent-phase-1-cloud-foundation.md`

## Phase 2 — Windows Local Worker

Deliver a Windows/Python worker that authenticates with a rotatable machine credential, claims jobs with leases/heartbeats, reports progress/events, survives crashes, and safely releases expired jobs.

**Exit criteria:** one worker can claim/process a synthetic job; a second worker cannot double-claim it; expired leases recover; revoked credentials stop access; worker status appears in the dashboard.

## Phase 3 — Transcription + Clip Engine

Add Faster-Whisper GPU transcription, transcript persistence, scene/silence heuristics, candidate generation, 0-100 scoring, FFmpeg 9:16 rendering, caption burn-in, and review assets.

**Exit criteria:** a representative gameplay VOD yields timestamped transcript data and only viable candidate clips; obvious dead air is rejected; renders meet Shorts-safe dimensions and preserve intelligible audio/captions.

## Phase 4 — Approval Dashboard

Build the real review UI: preview, score/reasons, source timestamp, title/description/hashtags, edit, approve, reject, re-render, job timeline, and retry actions.

**Exit criteria:** approval/rejection is auditable; rejected clips cannot publish; edits persist; re-render creates a new render revision instead of silently overwriting history.

## Phase 5 — YouTube OAuth + Publishing

Add YouTube channel connection, server-side token storage, upload preparation, privacy/schedule state, quota/error handling, and exactly-once publishing jobs.

**Exit criteria:** only approved clips can create publishing jobs; duplicate clicks cannot duplicate uploads; restricted API projects gracefully remain private; tokens never reach client JavaScript/logs.

## Phase 6 — Analytics + Learning Loop

Pull 24-hour/7-day metrics, store snapshots, normalize against recent comparable Shorts, derive explainable learning signals, and produce confidence-labeled recommendations for clips, stream angles, titles, and intentional moments.

**Exit criteria:** recommendations cite actual stored performance; weak samples are labeled low-confidence; no analytics are fabricated when unavailable.

## Phase 7 — Orchestration + Hardening

Add completed-stream detection, scheduled reconciliation, Activepieces where it clearly reduces custom code, backoff/quota controls, structured logs, end-to-end regression tests, security scans, and recovery playbooks.

**Exit criteria:** missed triggers reconcile; duplicate triggers stay idempotent; transient API failures back off; all core flows pass end-to-end; security advisors/scans are clean or documented.

## Global Rules

- Public publishing stays approval-gated until explicitly changed after V1 is stable.
- Heavy media compute stays local-first on the RTX 4070.
- Raw VODs are not copied into Supabase long-term.
- Secrets never enter the public site repo, browser bundle, generated HTML, or logs.
- Every exposed Supabase table has RLS before production use.
- Every phase must leave the system in a usable state; no phase depends on unmerged half-implementations from a later phase.
