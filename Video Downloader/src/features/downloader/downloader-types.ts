export type AnalysisStatus = 'supported' | 'unsupported' | 'failed';
export type DownloadFormat = 'original' | 'mp4' | 'mp3';
export type SourceCategory =
  | 'direct_video_file'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'unknown';
export type AnalysisConfidence = 'verified_mime' | 'filename_fallback';

export type SocialMediaFormat = {
  id: string;
  label: string;
  ext: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  sizeBytes: number | null;
};

export type VideoMetadata = {
  title: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  mp4SizeBytes: number | null;
  mp3SizeBytes: number | null;
  sourceName: string;
  thumbnailUri: string | null;
  durationMs: number | null;
};

export type AnalysisResult = {
  status: AnalysisStatus;
  sourceUrl?: string;
  sourceCategory?: SourceCategory;
  confidence?: AnalysisConfidence;
  metadata?: VideoMetadata;
  supportsRange?: boolean | null;
  requiresRightsConfirmation: true;
  errorCode?: string;
  message: string;
  socialFormats?: SocialMediaFormat[];
};

export type UrlValidationErrorCode =
  | 'empty'
  | 'malformed'
  | 'unsafe_scheme'
  | 'credentials'
  | 'localhost'
  | 'private_host'
  | 'ip_literal'
  | 'unsupported_port';

export type UrlValidationResult =
  | {
      valid: true;
      normalizedUrl: string;
      hostname: string;
      url: URL;
    }
  | {
      valid: false;
      errorCode: UrlValidationErrorCode;
      message: string;
    };

export interface VideoSourceProvider {
  providerId: string;
  displayName: string;
  canHandle(url: URL): boolean;
  analyze(url: URL, signal: AbortSignal): Promise<AnalysisResult>;
}
