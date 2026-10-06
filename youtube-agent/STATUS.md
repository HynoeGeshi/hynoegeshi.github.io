# Hynoe YouTube Agent Status

Canonical channel: https://www.youtube.com/@Hynoe

## Live backend

Supabase project: `bgtxfzvzksgvradodafo` (`us-east-2`, free project)

Security advisor result after schema/OAuth changes: **0 security lints**.

## Implemented

- Secure Supabase project and RLS-backed schema
- VOD queueing and duplicate protection
- Worker leases and recoverable job states
- Transcript, clip candidate, approval, publishing, analytics, learning, and recommendation tables
- Private clip-preview storage
- Browser dashboard shell and authentication
- Creator account signup + verified-email requirement
- Manual VOD intake
- Signed private clip playback
- Clip edit / approve / reject actions
- RTX 4070 local worker
- Faster-Whisper CUDA transcription
- Candidate scoring and overlap removal
- FFmpeg/NVENC 1080x1920 rendering with captions
- Windows worker installer / launchers
- Private Google OAuth state + token storage
- `youtube-oauth-start` Edge Function
- `youtube-oauth-callback` Edge Function
  - one-time state validation
  - server-side token exchange
  - verifies authorized YouTube channel ID matches `@Hynoe`
  - private refresh-token storage
- `youtube-upload-approved` Edge Function
  - requires authenticated creator
  - requires explicitly approved clip
  - streams private render to YouTube resumable upload
  - uploads **private** by default
- `youtube-analytics-sync` Edge Function
  - refreshes Google access token server-side
  - pulls YouTube Analytics performance for published videos
  - writes analytics snapshots back to the learning database
- Standalone Vercel project created: `hynoe-youtube-agent`

## External authorization still required

### Google / YouTube OAuth credentials

Google requires a real OAuth Web client owned by the channel owner. These values are intentionally not invented or committed:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`

Authorized redirect URI must be:

`https://bgtxfzvzksgvradodafo.supabase.co/functions/v1/youtube-oauth-callback`

After those secrets are configured in Supabase, the dashboard's **Connect @Hynoe YouTube** button can complete the real channel authorization flow.

### Vercel deployment authorization

The Vercel project was created successfully, but deployment requests currently return `403 Forbidden` because the connected Vercel credential is not authorized for the `hynoe` team scope. Both Git-backed and direct-file deployment attempts hit the same team authorization block.

This is an account authorization issue, not an unfinished application-code issue. The dashboard source remains committed on `docs/hynoe-youtube-agent-spec` under `youtube-agent/`.

## Current end-to-end state

The software path is now:

`@Hynoe VOD -> secure queue -> RTX worker -> transcription -> ranked clips -> vertical renders -> private previews -> human approval -> private YouTube upload -> analytics snapshots -> recommendations`

The backend portions of this path are deployed. The two external account authorizations above are what remain before a real end-to-end channel run can be executed.
