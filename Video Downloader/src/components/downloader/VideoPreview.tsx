import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/src/components/ui/AppCard';
import { AppButton } from '@/src/components/ui/AppButton';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { AnalysisResult, DownloadFormat } from '@/src/features/downloader/downloader-types';

export function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VideoPreview({
  result,
  onDownload,
  selectedFormat = 'mp4',
  onFormatChange,
}: {
  result: AnalysisResult;
  onDownload?: () => void | Promise<void>;
  selectedFormat?: DownloadFormat;
  onFormatChange?: (format: DownloadFormat) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  if (result.status !== 'supported' || !result.metadata) {
    return (
      <AppCard>
        <Text style={styles.stateTitle}>
          {result.status === 'unsupported' ? 'Source not supported' : 'Analysis result'}
        </Text>
        <Text style={styles.message}>{result.message}</Text>
      </AppCard>
    );
  }

  const metadata = result.metadata;
  const isSocial =
    (result.socialFormats?.length ?? 0) > 0 ||
    result.sourceCategory === 'youtube' ||
    result.sourceCategory === 'facebook';
  return (
    <AppCard style={styles.card}>
      <View style={styles.details}>
        {metadata.thumbnailUri ? (
          <Image
            source={{ uri: metadata.thumbnailUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : null}
        <Text style={styles.supported}>
          {isSocial ? 'Supported social media video' : 'Supported direct video file'}
        </Text>
        <Text numberOfLines={2} style={styles.title}>{metadata.title}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Filename</Text>
          <Text selectable style={styles.value}>{metadata.fileName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.value}>{metadata.sourceName}</Text>
        </View>
        {onFormatChange ? (
          <View style={styles.formatSection}>
            <Text style={styles.formatLabel}>Download format</Text>
            <View style={styles.formatRow}>
              {(['mp4', 'mp3'] as DownloadFormat[]).map((format) => (
                <Text
                  key={format}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedFormat === format }}
                  onPress={() => onFormatChange(format)}
                  style={[
                    styles.formatOption,
                    selectedFormat === format && styles.formatOptionActive,
                  ]}>
                  {format === 'mp4'
                    ? `MP4${formatFileSize(metadata.mp4SizeBytes) ? `\n${formatFileSize(metadata.mp4SizeBytes)}` : ''}`
                    : `MP3${formatFileSize(metadata.mp3SizeBytes) ? `\n${formatFileSize(metadata.mp3SizeBytes)}` : ''}`}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
        <AppButton
          title={downloading ? 'Downloading' : 'Download'}
          onPress={async () => {
            if (!onDownload || downloading) return;
            setDownloading(true);
            try {
              await onDownload();
            } finally {
              setDownloading(false);
            }
          }}
          size="lg"
          disabled={!onDownload || downloading}
          style={styles.download}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  details: { padding: Spacing.md },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  supported: { ...Typography.sm, color: Colors.success, fontWeight: '700', marginBottom: Spacing.sm },
  title: { ...Typography.lg, color: Colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.sm },
  label: { ...Typography.sm, color: Colors.textSecondary },
  value: { ...Typography.sm, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  download: { marginTop: Spacing.md },
  formatSection: { marginTop: Spacing.md },
  formatLabel: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700', marginBottom: Spacing.sm },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  formatOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textSecondary,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...Typography.xs,
  },
  formatOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  stateTitle: { ...Typography.lg, color: Colors.textPrimary },
  message: { ...Typography.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
});
