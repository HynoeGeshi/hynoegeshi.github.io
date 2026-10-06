# Archive revival operations

The owner catalog is canonical in `public.revival_catalog`, keyed by channel/video ID. Sync enumerates the authenticated channel's uploads playlist, follows all pages, reads owner metadata and available Analytics data, and checkpoints each page in `revival_sync`. Private and unlisted metadata stays behind owner RLS. Missing metrics remain unknown; prior recommendation evidence cannot masquerade as a fresh sync.

## Scores and safeguards

Canonical `numeric-v1` scores normalize the existing numeric weights: watch time 32, average viewed percentage 18, views 10, subscriber gains 12 (72 total). The result is on a 0–100 scale. Editorial fit and title clarity add no numeric points. All six Analytics metrics must be available, and the video must be over 180 seconds, fit the gaming archive, have an existing approval, and score at least 90 before the publishing claim can succeed. Public long-form is never made private or unlisted by this subsystem.

The original 30 decisions remain in the database: 10 prior-approved Ready packages and 20 Deferred packages. Ready means metadata is prepared; the numeric/canonical gate may still hold publication. Publication reserves the daily slot before the YouTube write, preserving the one-per-24-hour cap even when readback fails. A lease serializes the channel. Metadata and playlist placement precede the visibility update, and every retry reads current YouTube state. Nothing uploads duplicate video files.

Deferred promotion requires every earlier published revival to have a verified seven-day measurement, at least 25 views, at least 120 watch minutes, at least 15% average viewed, and no subscribers lost. The deferred item also requires canonical 90+ evidence. These conservative thresholds were chosen under the creator's instruction to choose the necessary rules. The measured replay watch time is an Analytics estimate, **not a verified YPP eligibility total**. [YouTube's YPP rules](https://support.google.com/youtube/answer/72851) determine which public watch hours count.

Old Minecraft approval packages carry explicit historical/pre-current SMP titles, descriptions and playlists. Unverified legacy Discord/support URLs are removed from revival packages. Raw original metadata is retained for audit. Current videos and complete series keep their existing public visibility.

## Backend deployment

Apply SQL files in order: `queue.sql`, `catalog.sql`, `canonical_90_gate.sql`, `publication_reservation.sql`, `longform_gate.sql`, `scheduler.sql`, `reservation_fencing.sql`, `observed_coverage.sql`. The installed production migrations are tracked by Supabase. Do not rerun initial policy/table creation against an already migrated project.

Deploy the shared JS/TS files together:

- `youtube-archive-revive`: `endpoint.ts`
- `youtube-revival-catalog-sync`: `catalog_sync.ts`
- `youtube-revival-performance-sync`: `performance_sync.ts`

Gateway JWT verification is disabled because each handler validates the creator session against Supabase Auth and channel ownership, or validates a restricted server-runner credential. OAuth credentials stay in existing private RPCs/Vault. Queue/catalog writes and claim/finalization RPCs are service-only.

The installed 15-minute database cron first completes catalog enumeration, then measures mature published revivals and runs at most one eligible revival per request. The daily slot prevents mass publishing. On `quotaExceeded`, the channel is persisted as paused until 00:10 America/Los_Angeles; no later YouTube request executes in that run. Weekly catalog refreshes update existing IDs.

## Verification

Run `node --test youtube-agent/revival/*.test.mjs`, syntax-check the JS/TS adapters, and run `database_verify.sql` through an administrative SQL session. The database test is transaction-wrapped and rolls back every fixture. Check unauthenticated requests return 401, a forged runner is rejected, and owner reads return only owned data. A paused authenticated run must return the persisted resume time without any YouTube request.

## Current deployment limits

Backend, queue and scheduler are installed. Canonical sync is paused until the YouTube quota reset; no claim is made that the 882 records have been fetched/scored yet. The frontend files are complete, but production deployment was rejected with Vercel `api-deployments-young-hobby-team-24h` (100/100 deployments). Deploy the static dashboard files to the existing `hynoe-youtube-agent` project after that account limit resets. A browser visual check is still required after frontend deployment.
