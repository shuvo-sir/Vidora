export const CREATE_DOWNLOADS_TABLE = `
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT,
  thumbnail_uri TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  total_bytes INTEGER NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  downloaded_bytes INTEGER NOT NULL DEFAULT 0 CHECK (downloaded_bytes >= 0),
  status TEXT NOT NULL CHECK (status IN ('queued','downloading','paused','completed','failed','cancelled')),
  error_message TEXT,
  local_uri TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  resume_data TEXT,
  assetId TEXT,
  mediaType TEXT
)`;

export const CREATE_VIDEOS_TABLE = `
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  download_id TEXT UNIQUE,
  title TEXT NOT NULL,
  source_name TEXT,
  thumbnail_uri TEXT,
  file_name TEXT NOT NULL,
  local_uri TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  saved_at INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  assetId TEXT,
  mediaType TEXT,
  FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE SET NULL
)`;

export const CREATE_SETTINGS_TABLE = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
)`;

export const CREATE_SCHEMA_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_completed_at ON downloads(completed_at);
CREATE INDEX IF NOT EXISTS idx_videos_saved_at ON videos(saved_at);
CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
`;
