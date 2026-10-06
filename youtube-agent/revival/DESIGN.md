# Controlled archive revival

Preserve every public long-form video's privacy. Revive existing video IDs rather than upload duplicates. Retain the creator-approved ranks 1–10 as Ready and 11–30 as Deferred, without changing score formulas to simulate stronger evidence. Every candidate has exact metadata, playlist, reason, historical metrics and an honest score.

Use an owner-readable, server-write-only queue and a channel-level lock. Persist each attempt before YouTube writes. Publish at most one new archive video per day; set privacy last, after metadata and playlist placement, then verify. Retrying an interrupted attempt first reads YouTube and skips completed actions. Quota errors pause the whole channel until the next midnight in America/Los_Angeles. Ambiguous playlist inserts need readback before another insert.

Deferred promotion fails closed unless numeric rules and verified post-revival public long-form analytics exist. Lifetime archive watch time is not eligible YPP watch time. Do not claim full 882-video coverage from the 30 stored recommendations. Catalog import is paginated, deduplicated and reports actual coverage.

Implementation: policy tests first; queue migration with RLS, locks and durable state; shared tested single-video executor; secure Edge adapter; queue and watch-hour UI; safe seed from existing approval evidence; verify tests, auth denial, database invariants and deployed UI. No YouTube writes while paused.
