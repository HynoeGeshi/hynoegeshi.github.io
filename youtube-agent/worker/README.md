# Hynoe YouTube Agent — Local RTX Worker

This folder is the Windows media worker for the @Hynoe YouTube automation system.

## What it does

1. Signs in to the private Supabase-backed Hynoe Agent account.
2. Claims exactly one queued processing job with a lease so duplicate workers do not process the same VOD.
3. Reads a local source file when `source_uri` is present, or falls back to the configured YouTube source ID.
4. Transcribes on the NVIDIA GPU using Faster-Whisper.
5. Stores timestamped transcript segments.
6. Finds and scores high-energy/clear-payoff highlight windows.
7. Removes heavily overlapping duplicate candidates.
8. Renders up to 8 vertical 1080x1920 Shorts with full-gameplay foreground, blurred fill background, captions, AAC audio, and NVENC H.264.
9. Uploads private review previews to the `clip-previews` bucket.
10. Stops the job at `awaiting_review`. Nothing is publicly published by this worker.

## Install

Open PowerShell in this directory and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

Edit `.env` and fill only your local creator login values. Do not commit `.env`.

Then test one job:

```powershell
.\.venv\Scripts\python.exe worker.py --once
```

Run continuously:

```powershell
.\.venv\Scripts\python.exe worker.py
```

## Best source workflow

For maximum quality, keep OBS recordings locally and point queued sources at those local files. This avoids recompressing a YouTube VOD before Shorts are rendered. The YouTube-source fallback is intended for your own uploaded content when no original local recording is available.

## GPU

The default transcription configuration is `large-v3` + CUDA `float16`. The video encoder is `h264_nvenc`, which is appropriate for the RTX 4070. If VRAM is constrained, switch `WHISPER_COMPUTE_TYPE` to `int8_float16` or use a smaller Whisper model.
