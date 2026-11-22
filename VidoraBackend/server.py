from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import secrets
import shutil
import socket
import subprocess
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlparse

import yt_dlp
from yt_dlp.utils import PostProcessingError
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("vidora.backend")

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = Path(
    os.getenv("VIDORA_DOWNLOAD_DIR", str(BASE_DIR / "downloads"))
).resolve()
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
COOKIE_FILE = BASE_DIR / "cookies.txt"

DOWNLOAD_TTL_SECONDS = int(os.getenv("VIDORA_DOWNLOAD_TTL_SECONDS", "3600"))
MAX_DOWNLOAD_BYTES = int(
    os.getenv("VIDORA_MAX_DOWNLOAD_BYTES", str(1024 * 1024 * 1024))
)
DOWNLOAD_TIMEOUT_SECONDS = int(
    os.getenv("VIDORA_DOWNLOAD_TIMEOUT_SECONDS", "900")
)
MAX_CONCURRENT_DOWNLOADS = max(
    1, int(os.getenv("VIDORA_MAX_CONCURRENT_DOWNLOADS", "2"))
)
RATE_LIMIT_REQUESTS = max(1, int(os.getenv("VIDORA_RATE_LIMIT_REQUESTS", "5")))
RATE_LIMIT_WINDOW_SECONDS = max(
    1, int(os.getenv("VIDORA_RATE_LIMIT_WINDOW_SECONDS", "60"))
)
API_KEY = os.getenv("VIDORA_API_KEY")

download_semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
rate_limit_lock = asyncio.Lock()
request_times: dict[str, deque[float]] = defaultdict(deque)

app = FastAPI(title="Vidora Backend", version="1.0.0")


class VideoRequest(BaseModel):
    url: str
    format_type: Optional[Literal["mp4", "mp3"]] = None
    format: Optional[Literal["original", "mp4", "mp3"]] = None


def error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def cleanup_expired_files() -> int:
    cutoff = time.time() - DOWNLOAD_TTL_SECONDS
    removed = 0
    for path in DOWNLOAD_DIR.iterdir():
        if not path.is_file():
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            logger.warning("Could not remove expired file %s", path.name)
    return removed


def validate_public_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.hostname:
        raise error(
            "invalid_url",
            "Only HTTPS URLs with a hostname are supported.",
            422,
        )
    if parsed.username or parsed.password or parsed.port:
        raise error(
            "invalid_url",
            "Credentials and non-standard ports are not supported.",
            422,
        )

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(
        (".localhost", ".local", ".internal")
    ):
        raise error("private_host", "Local and internal hosts are not supported.", 422)

    try:
        addresses = {
            ipaddress.ip_address(result[4][0])
            for result in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        }
    except socket.gaierror:
        raise error("host_unreachable", "The source host could not be resolved.", 422)

    if not addresses or any(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
        for address in addresses
    ):
        raise error("private_host", "Private or reserved hosts are not supported.", 422)

    return value.strip()


async def enforce_rate_limit(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    async with rate_limit_lock:
        timestamps = request_times[client]
        while timestamps and now - timestamps[0] >= RATE_LIMIT_WINDOW_SECONDS:
            timestamps.popleft()
        if len(timestamps) >= RATE_LIMIT_REQUESTS:
            raise error("rate_limited", "Too many requests. Try again later.", 429)
        timestamps.append(now)


def verify_api_key(provided_key: Optional[str]) -> None:
    if API_KEY and not secrets.compare_digest(provided_key or "", API_KEY):
        raise error("unauthorized", "A valid API key is required.", 401)
    if not API_KEY:
        logger.warning(
            "VIDORA_API_KEY is unset; the download endpoint is unauthenticated."
        )


def build_ydl_options(job_id: str, requested_format: str) -> dict:
    options: dict = {
        "format": {
            "mp4": "best[ext=mp4]/best",
            "mp3": "bestaudio/best",
            "original": "best",
        }[requested_format],
        "outtmpl": str(DOWNLOAD_DIR / f"{job_id}-%(id)s.%(ext)s"),
        "noplaylist": True,
        "restrictfilenames": True,
        "max_filesize": MAX_DOWNLOAD_BYTES,
        "socket_timeout": 30,
        "retries": 2,
        "quiet": True,
        "no_warnings": True,
    }
    if COOKIE_FILE.is_file():
        options["cookiefile"] = str(COOKIE_FILE)

    ffmpeg_location = os.getenv("VIDORA_FFMPEG_LOCATION")
    if ffmpeg_location:
        options["ffmpeg_location"] = ffmpeg_location
    elif shutil.which("ffmpeg"):
        options["ffmpeg_location"] = str(Path(shutil.which("ffmpeg")).parent)
    elif Path("/usr/bin/ffmpeg").is_file():
        options["ffmpeg_location"] = "/usr/bin"
    elif Path("C:/ffmpeg/bin/ffmpeg.exe").exists():
        options["ffmpeg_location"] = "C:/ffmpeg/bin"

    if requested_format == "mp3":
        options["extractor_args"] = {
            "youtube": {"player_client": ["android", "ios"]}
        }
        options["user_agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
        options["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]
    return options


def check_ffmpeg_for_mp3() -> None:
    configured_location = os.getenv("VIDORA_FFMPEG_LOCATION")
    executable: Optional[Path] = None

    if configured_location:
        location = Path(configured_location).expanduser()
        if location.is_file():
            executable = location
        elif location.is_dir():
            for name in ("ffmpeg.exe", "ffmpeg"):
                candidate = location / name
                if candidate.is_file():
                    executable = candidate
                    break

    if executable is None:
        resolved = shutil.which("ffmpeg")
        if resolved is not None:
            executable = Path(resolved)

    if executable is None and Path("C:/ffmpeg/bin/ffmpeg.exe").exists():
        executable = Path("C:/ffmpeg/bin/ffmpeg.exe")

    if executable is None:
        raise error(
            "ffmpeg_not_found",
            "FFmpeg not found. Please ensure it is installed and the path is correct.",
            500,
        )

    try:
        result = subprocess.run(
            [str(executable), "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        raise error(
            "ffmpeg_not_found",
            "FFmpeg not found. Please ensure it is installed and the path is correct.",
            500,
        )
    except subprocess.CalledProcessError as exc:
        raise error(
            "ffmpeg_check_failed",
            f"FFmpeg check failed: {exc}",
            500,
        )

    encoder_output = f"{result.stdout}\n{result.stderr}"
    if "libmp3lame" not in encoder_output:
        raise error(
            "ffmpeg_missing_mp3_encoder",
            "FFmpeg is missing the 'libmp3lame' encoder required for MP3. "
            "Please install a full FFmpeg build.",
            500,
        )


def download_source(
    url: str, job_id: str, requested_format: str
) -> tuple[Path, dict[str, object]]:
    options = build_ydl_options(job_id, requested_format)
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(url, download=True)
    except PostProcessingError as exc:
        logger.error("MP3 post-processing failed for job %s: %s", job_id, exc)
        raise error(
            "mp3_postprocessing_failed",
            "MP3 conversion failed. The server's FFmpeg build may be missing "
            "the MP3 encoder (libmp3lame).",
            500,
        )

    candidates = [
        path
        for path in DOWNLOAD_DIR.glob(f"{job_id}-*")
        if path.is_file() and path.stat().st_size <= MAX_DOWNLOAD_BYTES
    ]
    if not candidates:
        raise RuntimeError("The downloader did not produce a valid output file.")
    output = max(candidates, key=lambda path: path.stat().st_mtime)
    return output, {
        "filesize": output.stat().st_size,
        "duration": info.get("duration") if isinstance(info, dict) else None,
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/download")
async def download_video(
    request: Request,
    payload: VideoRequest,
    x_api_key: Optional[str] = Header(default=None),
) -> dict[str, object]:
    await enforce_rate_limit(request)
    verify_api_key(x_api_key)
    source_url = validate_public_url(payload.url)
    requested_format = (
        payload.format_type
        if payload.format_type is not None
        else payload.format
        if payload.format in {"mp4", "mp3"}
        else "mp4"
    )
    cleanup_expired_files()
    job_id = secrets.token_urlsafe(16)

    async with download_semaphore:
        try:
            if requested_format == "mp3":
                await run_in_threadpool(check_ffmpeg_for_mp3)
            output, metadata = await asyncio.wait_for(
                run_in_threadpool(
                    download_source, source_url, job_id, requested_format
                ),
                timeout=DOWNLOAD_TIMEOUT_SECONDS,
            )
        except HTTPException as http_exc:
            detail = http_exc.detail
            message = (
                detail.get("message")
                if isinstance(detail, dict) and detail.get("message")
                else detail
            )
            logger.error(
                "HTTP Error: %s - %s",
                http_exc.status_code,
                message,
            )
            raise
        except asyncio.TimeoutError:
            logger.error("Download timed out for job %s", job_id)
            for path in DOWNLOAD_DIR.glob(f"{job_id}-*"):
                path.unlink(missing_ok=True)
            http_exc = error("download_timeout", "The download timed out.", 504)
            logger.error("HTTP Error: 504 - The download timed out.")
            raise http_exc
        except yt_dlp.utils.DownloadError:
            logger.exception("yt-dlp failed for job %s", job_id)
            http_exc = error(
                "download_failed",
                "The source could not be downloaded.",
                502,
            )
            logger.error(
                "HTTP Error: 502 - The source could not be downloaded."
            )
            raise http_exc
        except Exception:
            logger.exception("Unexpected download failure for job %s", job_id)
            http_exc = error(
                "download_failed",
                "The source could not be downloaded.",
                502,
            )
            logger.error(
                "HTTP Error: 502 - The source could not be downloaded."
            )
            raise http_exc

    return {
        "status": "success",
        "filename": output.name,
        "download_url": f"/static/{output.name}",
        "format": requested_format,
        "filesize": metadata["filesize"],
        "duration": metadata["duration"],
    }


@app.get("/static/{filename}")
async def download_file(filename: str) -> FileResponse:
    path = (DOWNLOAD_DIR / filename).resolve()
    if path.parent != DOWNLOAD_DIR or not path.is_file():
        raise error("not_found", "The requested file was not found.", 404)
    return FileResponse(path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("VIDORA_HOST", "0.0.0.0"),
        port=int(os.getenv("VIDORA_PORT", "8000")),
    )
