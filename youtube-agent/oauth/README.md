# YouTube OAuth / publishing configuration

The Hynoe Agent is built so public publishing remains disabled until the channel owner connects Google/YouTube OAuth.

Required Google Cloud OAuth client secrets are **not** stored in GitHub. Configure them only as Supabase Edge Function secrets when the OAuth application is created:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`

Recommended scopes:

- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

The canonical channel is `https://www.youtube.com/@Hynoe`.

Until OAuth is connected, approved clip candidates safely stop at `publishing_jobs.state = 'pending'`.
