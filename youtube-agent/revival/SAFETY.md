# Hynoe YouTube public-change safety model

Updated October 7, 2026 (America/Chicago).

## Non-negotiable rules

- Analytics, a 90+ score, `approved`, or `auto_publish` never constitute permission to change public YouTube content.
- Every public title, description, playlist, schedule, or visibility change requires Terrell's exact approval for that video's current package.
- Any draft change invalidates its approval.
- Original YouTube video IDs are preserved.
- Safe automation may analyze, deduplicate, draft metadata, render privately, upload privately, sync analytics, and prepare private review work.
- Unapproved work remains `awaiting_review`.

## Live safeguards

- `revival_public_approvals` stores immutable exact approval packages.
- `claim_revival`, `reserve_revival_publication`, and `finish_revival` validate the bound approval.
- `youtube-archive-revive` requires an authenticated owner JWT and revalidates approval before each YouTube write.
- The recurring dispatcher performs only catalog and post-publication analytics sync; it cannot call the public revival endpoint.
- Legacy bulk/public metadata, visibility, playlist, promotion, and Short-scheduling endpoints return HTTP 410 or are otherwise disabled.
- Private Short uploads remain private and are allowed as review preparation.

## Protective rollback completed

Four Shorts that had been scheduled or published from generic score-based approval were returned to private review without deletion or re-upload:

- `oNwQjlWj5S0`
- `B9J_MQHeEZw`
- `2WxaP1anLVM`
- `YXy7fcWg5ts`

YouTube status readback verified all four as private with no `publishAt` value. Their publishing jobs are `awaiting_review`.

## Source verification

The revival policy, catalog scoring, and approval behavior are covered by Node tests. The current local suite passes 13/13 tests.

## Deployment note

The review-only Vercel dashboard source is committed on this branch. Production deployment was blocked by Vercel's free-plan daily deployment limit. The hourly safe operator may deploy it after the limit resets, but must never deploy the older bulk-write UI.
