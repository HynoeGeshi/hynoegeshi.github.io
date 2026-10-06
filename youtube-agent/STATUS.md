# Hynoe YouTube Agent Status

Canonical channel: https://www.youtube.com/@Hynoe

## Live backend

Supabase project: `bgtxfzvzksgvradodafo` (`us-east-2`, free project)

Fresh security advisor result after OAuth Vault hardening: **0 security lints**.

## Live dashboard

Production Vercel project: `hynoe-youtube-agent`

Production alias: `https://hynoe-youtube-agent.vercel.app`

Latest production deployment is `READY`. Vercel Authentication now applies only to preview deployments; production access is protected by the application's Supabase authentication and RLS model.

## Implemented

- Secure Supabase project and RLS-backed schema
- VOD queueing and duplicate protection
- Worker leases and recoverable job states
- Transcript, clip candidate, approval, publishing, analytics, learning, and recommendation tables
- Private clip-preview storage
- Browser dashboard authentication
- Creator account signup + verified-email requirement
- Manual VOD intake
- Signed private clip playback
- Clip edit / approve / reject actions
- RTX 4070 local worker source
- Faster-Whisper CUDA transcription pipeline
- Candidate scoring and overlap removal
- FFmpeg/NVENC 1080x1920 rendering with captions
- Windows worker installer / launchers
- Private Google OAuth state + token storage
- Supabase Vault-backed OAuth client-secret storage
- Authenticated one-time OAuth credential setup inside the dashboard
- `youtube-oauth-config` Edge Function
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
- Dashboard button to manually sync analytics
- Dashboard flow where approval immediately attempts the private YouTube upload

## One external authorization still required

Google requires the channel owner to create/authorize a real OAuth **Web application** client. The dashboard now handles secure storage, so the Google client ID and client secret do not need to be added to source code or Supabase environment variables.

Enable:

- YouTube Data API v3
- YouTube Analytics API

Use this exact authorized redirect URI:

`https://bgtxfzvzksgvradodafo.supabase.co/functions/v1/youtube-oauth-callback`

Then paste the Google OAuth Client ID and Client Secret into **One-time Google OAuth setup** in the live dashboard and click **Save encrypted credentials**. The secret is stored in Supabase Vault. Click **Connect @Hynoe YouTube** and authorize the Google account that owns the channel. The callback rejects the connection if the authorized channel ID does not match `@Hynoe`.

## Current end-to-end state

The software path is:

`@Hynoe VOD -> secure queue -> RTX worker -> transcription -> ranked clips -> vertical renders -> private previews -> human approval -> private YouTube upload -> analytics snapshots -> recommendations`

Cloud/backend and dashboard portions are deployed. A real end-to-end channel run still requires (1) the Google OAuth authorization above and (2) installing/running the prepared local worker on the creator PC for the GPU media-processing stages.
