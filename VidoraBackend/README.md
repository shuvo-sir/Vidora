# Vidora Backend

FastAPI service used as the mobile app's YouTube fallback downloader.

## Run

Use Python 3.9 or newer:

```powershell
python -m pip install -r requirements.txt
python server.py
```

The service listens on `0.0.0.0:8000` by default. Set `VIDORA_HOST` and
`VIDORA_PORT` to change the bind address.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VIDORA_API_KEY` | unset | When set, clients must send `X-API-Key`. Configure this outside trusted networks. |
| `VIDORA_FFMPEG_LOCATION` | detected automatically | FFmpeg executable or directory. The Docker image installs FFmpeg at `/usr/bin/ffmpeg`. |
| `VIDORA_DOWNLOAD_DIR` | `./downloads` | Output directory. |
| `VIDORA_DOWNLOAD_TTL_SECONDS` | `3600` | Age after which output files are removed. |
| `VIDORA_MAX_DOWNLOAD_BYTES` | `1073741824` | Maximum output size. |
| `VIDORA_DOWNLOAD_TIMEOUT_SECONDS` | `900` | Maximum server-side download duration. |
| `VIDORA_MAX_CONCURRENT_DOWNLOADS` | `2` | Maximum simultaneous yt-dlp jobs. |
| `VIDORA_RATE_LIMIT_REQUESTS` | `5` | Requests allowed per client address per window. |
| `VIDORA_RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate-limit window length. |

Set `VIDORA_API_KEY` in production. If it is unset, the server logs a warning
and remains usable for local development.

Place a Netscape-format YouTube `cookies.txt` file in this directory to enable
yt-dlp cookie authentication. The server loads it automatically when present.

## API

- `GET /health` returns `{"status": "ok"}`.
- `POST /download` accepts:

```json
{
  "url": "https://example.com/video",
  "format": "mp4"
}
```

`format` may be `original`, `mp4`, or `mp3`. The response contains
`filename`, `format`, and a relative `download_url` under `/static`.

The service accepts HTTPS URLs only and rejects credentials, custom ports,
localhost, private, link-local, reserved, and multicast addresses.
