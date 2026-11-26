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
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.types import ASGIApp, Message, Receive, Scope, Send

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
MAX_REQUEST_BODY_BYTES = 16 * 1024

download_semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
rate_limit_lock = asyncio.Lock()
request_times: dict[str, deque[float]] = defaultdict(deque)

app = FastAPI(title="Vidora Backend", version="1.0.0")


class RequestBodyTooLarge(Exception):
    pass


class RequestSizeLimitMiddleware:
    def __init__(self, application: ASGIApp) -> None:
        self.application = application

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        if scope["type"] != "http":
            await self.application(scope, receive, send)
            return

        content_length = next(
            (
                value
                for key, value in scope["headers"]
                if key.lower() == b"content-length"
            ),
            None,
        )
        if content_length is not None:
            try:
                body_size = int(content_length)
            except ValueError:
                response = JSONResponse(
                    {
                        "detail": {
                            "code": "invalid_content_length",
                            "message": "Invalid Content-Length header.",
                        }
                    },
                    status_code=400,
                )
                await response(scope, receive, send)
                return
            if body_size > MAX_REQUEST_BODY_BYTES:
                await self._reject_too_large(scope, receive, send)
                return

        received_bytes = 0

        async def limited_receive() -> Message:
            nonlocal received_bytes
            message = await receive()
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > MAX_REQUEST_BODY_BYTES:
                    raise RequestBodyTooLarge
            return message

        try:
            await self.application(scope, limited_receive, send)
        except RequestBodyTooLarge:
            await self._reject_too_large(scope, receive, send)

    @staticmethod
    async def _reject_too_large(
        scope: Scope, receive: Receive, send: Send
    ) -> None:
        response = JSONResponse(
            {
                "detail": {
                    "code": "request_too_large",
                    "message": "Request body must not exceed 16 KiB.",
                }
            },
            status_code=413,
        )
        await response(scope, receive, send)


app.add_middleware(RequestSizeLimitMiddleware)


class VideoRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    format_type: Optional[Literal["mp4", "mp3"]] = None
    format: Optional[Literal["original", "mp4", "mp3"]] = None


class AnalysisRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


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


def cleanup_job_files(job_id: str) -> None:
    for path in DOWNLOAD_DIR.glob(f"{job_id}-*"):
        try:
            if path.is_file():
                path.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove temporary file %s", path.name)


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
    cookie_path = str(COOKIE_FILE.resolve())
    if os.path.exists(cookie_path):
        options["cookiefile"] = cookie_path
        logger.info("Successfully loaded cookies from: %s", cookie_path)
    else:
        logger.warning(
            "cookies.txt NOT FOUND on server. YouTube will likely block the request."
        )
    options["extractor_args"] = {
        "youtube": {"player_client": ["web", "mweb"]}
    }

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
        logger.error(
            "MP3 post-processing failed for job %s (%s)",
            job_id,
            type(exc).__name__,
        )
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


@app.post("/analyze")
async def analyze_video(
    request: Request,
    payload: AnalysisRequest,
    x_api_key: Optional[str] = Header(default=None),
) -> dict[str, object]:
    await enforce_rate_limit(request)
    verify_api_key(x_api_key)
    source_url = validate_public_url(payload.url)

    def extract_size_metadata() -> dict[str, object]:
        options = {
            "noplaylist": True,
            "restrictfilenames": True,
            "quiet": True,
            "no_warnings": True,
        }
        if COOKIE_FILE.is_file():
            options["cookiefile"] = str(COOKIE_FILE)

        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(source_url, download=False)

        mp4_size = None
        mp3_size = None
        formats = info.get("formats", []) if isinstance(info, dict) else []
        mp4_candidates = []
        audio_candidates = []
        for media_format in formats:
            if not isinstance(media_format, dict):
                continue
            exact_size = media_format.get("filesize")
            approx_size = media_format.get("filesize_approx")
            size = exact_size if exact_size is not None else approx_size
            if not isinstance(size, (int, float)):
                continue
            size = max(0, int(size))
            extension = str(media_format.get("ext") or "").lower()
            vcodec = str(media_format.get("vcodec") or "none").lower()
            acodec = str(media_format.get("acodec") or "none").lower()
            if vcodec != "none" and (extension == "mp4" or acodec != "none"):
                mp4_candidates.append((size, extension == "mp4"))
            if vcodec == "none" and acodec != "none":
                audio_candidates.append(size)

        if mp4_candidates:
            mp4_candidates.sort(key=lambda candidate: (candidate[1], candidate[0]), reverse=True)
            mp4_size = mp4_candidates[0][0]
        elif isinstance(info.get("filesize"), (int, float)):
            mp4_size = max(0, int(info["filesize"]))
        if audio_candidates:
            mp3_size = max(audio_candidates)

        duration = info.get("duration") if isinstance(info, dict) else None
        if isinstance(duration, (int, float)):
            mp3_size = max(0, int(duration * 192000 / 8))

        return {
            "mp4_size_bytes": mp4_size,
            "mp3_size_bytes": mp3_size,
        }

    try:
        return await run_in_threadpool(extract_size_metadata)
    except yt_dlp.utils.DownloadError as exc:
        logger.error("yt-dlp failed to analyze video (%s)", type(exc).__name__)
        raise error("analysis_failed", "The source could not be analyzed.", 502)
    except Exception as exc:
        logger.error("Unexpected analysis failure (%s)", type(exc).__name__)
        raise error("analysis_failed", "The source could not be analyzed.", 502)


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
            cleanup_job_files(job_id)
            logger.error("Download request failed with HTTP %s", http_exc.status_code)
            raise
        except asyncio.TimeoutError:
            logger.error("Download timed out for job %s", job_id)
            cleanup_job_files(job_id)
            http_exc = error("download_timeout", "The download timed out.", 504)
            raise http_exc
        except yt_dlp.utils.DownloadError as exc:
            logger.error(
                "yt-dlp failed for job %s (%s)",
                job_id,
                type(exc).__name__,
            )
            cleanup_job_files(job_id)
            http_exc = error(
                "download_failed",
                "The source could not be downloaded.",
                502,
            )
            raise http_exc
        except Exception as exc:
            logger.error(
                "Unexpected download failure for job %s (%s)",
                job_id,
                type(exc).__name__,
            )
            cleanup_job_files(job_id)
            http_exc = error(
                "download_failed",
                "The source could not be downloaded.",
                502,
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
    cleanup_expired_files()
    path = (DOWNLOAD_DIR / filename).resolve()
    if path.parent != DOWNLOAD_DIR or not path.is_file():
        raise error("not_found", "The requested file was not found.", 404)
    return FileResponse(path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("VIDORA_HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", os.getenv("VIDORA_PORT", "8000"))),
    )
