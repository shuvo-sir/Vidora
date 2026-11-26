# Deploy Vidora Backend to Heroku (Windows)

This guide deploys **only `VidoraBackend/`** from the `Downloader/` Git
repository. It does not deploy the Expo application.

## Important deployment choice

The backend is FastAPI and MP3 conversion requires FFmpeg. This guide uses the
Heroku Python buildpack plus the APT buildpack, which installs `ffmpeg` from
the new `Aptfile`. The runtime is pinned to Python 3.12 in `.python-version`.
The existing Dockerfile is retained but is not used by this buildpack
deployment.

The classic `heroku/python` and `heroku-community/apt` buildpacks are for
Cedar-generation apps; create the app on the supported `heroku-24` stack.
Fir-generation apps use Cloud Native Buildpacks and cannot use this classic
APT buildpack setup.

**Important limitation:** `/analyze` and `/download` do long-running work
synchronously. Heroku's router ends a web request after 30 seconds. Therefore
these endpoints can return an H12 timeout for work that takes longer than 30
seconds; the running download may continue after the client receives that
timeout. The existing API needs an asynchronous job/polling design or an
external worker/storage service for reliable long-running production downloads.
This guide does not rewrite that functionality.

## 1. Install Heroku CLI on Windows

Install Git for Windows if needed, then download and run the 64-bit Heroku CLI
installer from [Heroku's CLI installation page](https://devcenter.heroku.com/articles/heroku-cli).
Open a **new PowerShell** window and verify both tools:

```powershell
git --version
heroku --version
```

## 2. Log in

```powershell
heroku login
```

Complete the browser sign-in. Do not share your Heroku credentials or paste
tokens into source files.

## 3. Check the Git repository

In PowerShell, go to the repository root (the folder containing `.git`):

```powershell
Set-Location "C:\path\to\Downloader"
git rev-parse --show-toplevel
git status --short
git remote -v
```

Confirm the top-level path ends in `Downloader` and review the worktree before
deploying. The deployment prefix below is relative to this repository root.

## 4. Create a Heroku application

Choose a globally unique app name:

```powershell
heroku create your-unique-vidora-backend-name --stack heroku-24
```

If you already created the app, verify that it is a Cedar-generation app with
the `heroku-24` stack before continuing. A Fir app can't use this classic
buildpack setup. Record the app name and HTTPS URL printed by Heroku.

## 5. Connect the Heroku Git remote and add buildpacks

```powershell
heroku git:remote --app your-unique-vidora-backend-name
heroku buildpacks:add --index 1 heroku-community/apt --app your-unique-vidora-backend-name
heroku buildpacks:add heroku/python --app your-unique-vidora-backend-name
heroku buildpacks --app your-unique-vidora-backend-name
git remote -v
```

The APT buildpack must come before the Python buildpack so it installs FFmpeg
into the build environment. The `heroku` remote should point to the Git URL
for the intended application. `Aptfile` must remain at the deployed app root
and contain the package name `ffmpeg`. The Procfile adds the APT build's nested
audio and math library directories to `LD_LIBRARY_PATH`, which FFmpeg needs at
runtime.

## 6. Configure Heroku Config Vars

The Heroku router provides `PORT`; **do not set it yourself**. The following
values keep output temporary and limit resource use on one dyno:

```powershell
heroku config:set `
  VIDORA_DOWNLOAD_DIR=/tmp/vidora-downloads `
  VIDORA_DOWNLOAD_TTL_SECONDS=1800 `
  VIDORA_MAX_DOWNLOAD_BYTES=104857600 `
  VIDORA_MAX_CONCURRENT_DOWNLOADS=1 `
  VIDORA_RATE_LIMIT_REQUESTS=3 `
  VIDORA_RATE_LIMIT_WINDOW_SECONDS=60 `
  --app your-unique-vidora-backend-name
```

The current app has no shared-secret authentication mechanism suitable for a
public mobile client. Leave `VIDORA_API_KEY` unset for this app or the Android
client's POST requests will be rejected. An `EXPO_PUBLIC_*` variable is visible
inside the installed app and must never contain a backend secret. The backend
does enforce a basic in-memory request rate limit, but it is not a substitute
for authentication or a distributed abuse-control system.

## 7. Deploy only the backend folder

From the `Downloader/` repository root, run:

```powershell
git subtree push --prefix=VidoraBackend heroku main
```

This creates a subtree commit whose repository root is the **contents of
`VidoraBackend/`** and pushes that commit to Heroku's `main` branch. Heroku
therefore sees `Aptfile`, `.python-version`, `Procfile`, `server.py`, and the
backend requirements at its application root. The configured Python buildpack
installs the requirements, and the APT buildpack installs FFmpeg. The sibling
`Video Downloader/` folder is not included, so its `node_modules`, Android
files, assets, and Expo configuration are not deployed. The backend
`.gitignore` excludes local virtual environments, caches, downloads, `.env`
files, and `cookies.txt`.

This command performs the deployment. Run it only after reviewing the changes
and deciding to deploy.

## 8. View Heroku logs

```powershell
heroku logs --tail --app your-unique-vidora-backend-name
```

Use `Ctrl+C` to stop tailing logs. The backend avoids writing submitted video
URLs and API-key values to its application logs.

## 9. Check the running application

Use the HTTPS app URL Heroku assigned:

```powershell
$baseUrl = "https://your-unique-vidora-backend-name.herokuapp.com"
Invoke-RestMethod "$baseUrl/health"
```

Expected JSON:

```json
{"status":"ok"}
```

The OpenAPI schema is available at `$baseUrl/openapi.json`. The `/docs`
interactive page is also exposed by FastAPI; do not treat it as an
authentication boundary.

## 10. Troubleshooting

- **Build fails or Heroku reports no web process:** confirm the app uses the
  `heroku-24` stack, both buildpacks are configured in the correct order, and
  the subtree command was run from `Downloader/`.
- **FFmpeg is missing in the build or MP3 requests fail:** verify the deployed
  root contains `Aptfile` with the exact line `ffmpeg` and that the APT
  buildpack is first.
- **Python version or dependency resolution fails:** verify `.python-version`
  contains `3.12` and that `requirements.txt` is at the deployed root.
- **`Application error` or health check fails:** inspect `heroku logs --tail`;
  confirm the Procfile starts `server:app` and binds `0.0.0.0` using Heroku's
  `PORT`.
- **H12 / request timeout:** Heroku's web router has a 30-second limit. This
  backend currently waits for analysis/download work inside the request, so a
  slow source can time out. Increasing the client's timeout does not change
  the router limit.
- **The phone cannot reach the backend:** confirm the app URL uses `https://`,
  update the Expo environment variable, and rebuild/restart Expo so the
  variable is embedded in the app.
- **POST returns 401:** `VIDORA_API_KEY` is set, but the mobile app does not
  send a key. Do not fix this by embedding a secret in the app; unset the key
  or add an appropriate server-side authentication design.

## 11. Redeploy future backend changes

Commit or otherwise preserve the reviewed backend changes in the repository,
then from the repository root run the same command:

```powershell
git subtree push --prefix=VidoraBackend heroku main
```

Only the subtree is pushed. Check the logs and `/health` after each deployment.
No Heroku deployment is run as part of preparing this guide.

## Connect the Expo Android app

`Video Downloader/src/config.ts` centralizes the API base URL. Set
`EXPO_PUBLIC_API_BASE_URL` to the Heroku HTTPS URL (no trailing slash), for
example:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-unique-vidora-backend-name.herokuapp.com
```

For an Android emulator talking to a backend running on the development
computer, the app defaults to `http://10.0.2.2:8000` when
`EXPO_PUBLIC_API_BASE_URL` is unset in development. For a physical device, set
`EXPO_PUBLIC_API_BASE_URL_DEV` to the computer's reachable LAN URL, for example
`http://192.168.1.25:8000`. Production builds must set
`EXPO_PUBLIC_API_BASE_URL` through the local Expo environment or the selected
EAS build environment. Restart Expo after changing local environment values.

The legacy `EXPO_PUBLIC_BACKEND_URL` setting remains a development-only
fallback for existing local `.env` files. Update it to the new API variable
when convenient. Never put API credentials in any `EXPO_PUBLIC_*` value.

React Native Android requests do not use browser CORS enforcement, so this
native client does not require permissive CORS headers. If a browser client is
added later, configure an explicit origin allowlist rather than `*`.

The app's download manager fetches `/static/{filename}` and saves the file to
the device. Backend output is temporary, stored on Heroku's ephemeral
filesystem, and removed after its TTL on later download/static requests. The
file remains available during that TTL so an interrupted Android transfer can
resume. Keep the primary download history and permanent files on Android, not
on the dyno.
