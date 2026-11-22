import { Image, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/src/components/ui/AppCard';
import { AppButton } from '@/src/components/ui/AppButton';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { AnalysisResult, DownloadFormat } from '@/src/features/downloader/downloader-types';

function formatBytes(bytes: number | null) {
  if (bytes === null) return 'Size unavailable';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${bytes} bytes`;
}

export function VideoPreview({
  result,
  onDownload,
  selectedFormat = 'mp4',
  onFormatChange,
}: {
  result: AnalysisResult;
  onDownload?: () => void;
  selectedFormat?: DownloadFormat;
  onFormatChange?: (format: DownloadFormat) => void;
}) {
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
        <View style={styles.infoRow}>
          <Text style={styles.label}>MIME type</Text>
          <Text style={styles.value}>{metadata.mimeType ?? 'Unavailable'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>File size</Text>
          <Text style={styles.value}>{formatBytes(metadata.fileSizeBytes)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Confidence</Text>
          <Text style={styles.value}>
            {result.confidence === 'verified_mime'
              ? 'Verified video MIME type'
              : 'Filename fallback'}
          </Text>
        </View>
        <Text style={styles.rights}>
          Only download content you own or have permission to save.
        </Text>
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
                  {format === 'mp4' ? 'MP4 (Video)' : 'MP3 (Audio)'}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
        <AppButton
          title="Download"
          onPress={onDownload ?? (() => undefined)}
          size="lg"
          disabled={!onDownload}
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
  rights: { ...Typography.sm, color: Colors.warning, marginTop: Spacing.md, lineHeight: 20 },
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
