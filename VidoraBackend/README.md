# Vidora Backend

FastAPI service used as the mobile app's YouTube fallback downloader.

## Run locally

Use Python 3.12 and install the pinned dependencies:

```powershell
cd VidoraBackend
python --version
python -m pip install -r requirements.txt
python server.py
```

The development server binds to `0.0.0.0:8000`. `PORT` takes precedence when
set; otherwise `VIDORA_PORT` can change the port and `VIDORA_HOST` can change
the bind address.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VIDORA_API_KEY` | unset | When set, clients must send `X-API-Key`. Configure this outside trusted networks. |
| `VIDORA_FFMPEG_LOCATION` | detected automatically | FFmpeg executable or directory. The Docker image installs FFmpeg at `/usr/bin/ffmpeg`. |
| `VIDORA_DOWNLOAD_DIR` | `./downloads` | Temporary output directory. Heroku's filesystem is ephemeral. |
| `VIDORA_DOWNLOAD_TTL_SECONDS` | `3600` | Age after which output files are removed. |
| `VIDORA_MAX_DOWNLOAD_BYTES` | `1073741824` | Maximum output size. |
| `VIDORA_DOWNLOAD_TIMEOUT_SECONDS` | `900` | Maximum server-side download duration. |
| `VIDORA_MAX_CONCURRENT_DOWNLOADS` | `2` | Maximum simultaneous yt-dlp jobs. |
| `VIDORA_RATE_LIMIT_REQUESTS` | `5` | Requests allowed per client address per window. |
| `VIDORA_RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate-limit window length. |
| `VIDORA_HOST` | `0.0.0.0` | Bind address used by `python server.py`. |
| `VIDORA_PORT` | `8000` | Local port fallback when `PORT` is unset. |
| `PORT` | platform-provided | Listening port; takes precedence over `VIDORA_PORT`. |
| `LOG_LEVEL` | `INFO` | Python logging level. |

The Python-buildpack deployment installs FFmpeg from `Aptfile` using Heroku's
APT buildpack. The retained Dockerfile also installs FFmpeg if you later choose
a Docker deployment. Heroku deployment instructions and recommended production
limits are in [HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md).

`VIDORA_API_KEY` is optional and unset by default. If enabled, callers must
send `X-API-Key`; never put this key in an Expo `EXPO_PUBLIC_*` variable.
The native Android app cannot keep a shared backend secret confidential.

For local use only, a Netscape-format YouTube `cookies.txt` file can be placed
in this directory. It is ignored by Git and Docker and must not be deployed as
a committed file.

## API

- `GET /health` returns `{"status": "ok"}`.
- `POST /analyze` accepts a video URL and returns estimated MP4/MP3 sizes.
- `POST /download` accepts:

```json
{
  "url": "https://example.com/video",
  "format": "mp4"
}
```

`format` may be `original`, `mp4`, or `mp3`. The response contains
`filename`, `format`, and a relative `download_url` under `/static`.
- `GET /static/{filename}` serves a temporary download. Its file remains
  available until its TTL expires, then a later download or static request
  removes it; Heroku's dyno filesystem is also ephemeral.

Request bodies are limited to 16 KiB and video URLs to 2048 characters. The
service accepts HTTPS URLs and rejects credentials, custom ports, localhost,
private, link-local, reserved, and multicast addresses. The in-memory rate
limit is a basic per-process guard, not authentication or a durable
abuse-prevention system.
