import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppCard } from '@/src/components/ui/AppCard';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { Download } from '@/src/types';

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function DownloadItem({
  item,
  progressPercent,
  bytesPerSecond,
  statusMessage,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onDelete,
  onOpen,
}: {
  item: Download;
  progressPercent?: number | null;
  bytesPerSecond?: number | null;
  statusMessage?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
}) {
  const progress =
    progressPercent !== undefined && progressPercent !== null
      ? progressPercent
      : item.totalBytes > 0
      ? Math.min(100, Math.round((item.downloadedBytes / item.totalBytes) * 100))
      : item.status === 'completed'
        ? 100
        : 0;
  const actionLabel =
    item.status === 'completed'
      ? 'View'
      : item.status === 'failed'
        ? 'Retry'
        : item.status === 'paused'
          ? 'Resume'
          : 'Pause';

  const action = () => {
    if (item.status === 'downloading') onPause?.();
    else if (item.status === 'paused') onResume?.();
    else if (item.status === 'failed') onRetry?.();
    else if (item.status === 'completed') onOpen?.();
  };

  const confirmDelete = () => {
    if (item.status !== 'completed') return;
    Alert.alert(
      'Delete video?',
      'This will delete the video file and remove it from Downloads and Library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Pressable
      accessibilityLabel={item.status === 'completed' ? `${item.title}. Long press to delete video` : undefined}
      onLongPress={item.status === 'completed' ? confirmDelete : undefined}
      delayLongPress={600}>
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumbnail}>
            <SymbolView name={{ ios: 'play.rectangle', android: 'play_arrow', web: 'play_arrow' }} size={28} tintColor={Colors.textSecondary} />
          </View>
          <View style={styles.info}>
            <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
            <Text style={styles.source}>{item.sourceName ?? 'Unknown source'}{item.isDemo ? ' • DEMO' : ''}</Text>
            {item.status === 'failed' && item.errorMessage ? (
              <Text numberOfLines={3} style={styles.errorMessage}>
                {item.errorMessage}
              </Text>
            ) : null}
            {(item.status === 'downloading' || item.status === 'queued') && statusMessage ? (
              <Text numberOfLines={2} style={styles.statusMessage}>
                {statusMessage}
              </Text>
            ) : null}
            <View style={styles.sizeRow}>
              <Text style={styles.sizeText}>{formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}</Text>
              <Text style={[styles.status, item.status === 'failed' && styles.failed]}>
                {item.status === 'completed' ? 'Completed' : `${progress}%`}
              </Text>
            </View>
            {bytesPerSecond && bytesPerSecond > 0 ? (
              <Text style={styles.speed}>{Math.round(bytesPerSecond / 1024)} KB/s</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${item.title}`}
            onPress={action}
            style={styles.action}>
            <SymbolView
              name={
                item.status === 'failed'
                  ? { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }
                  : item.status === 'completed'
                    ? { ios: 'checkmark', android: 'check', web: 'check' }
                    : item.status === 'paused'
                      ? { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
                      : { ios: 'pause.fill', android: 'pause', web: 'pause' }
              }
              size={20}
              tintColor={Colors.textPrimary}
            />
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` },
              item.status === 'failed' && styles.progressFailed,
            ]}
          />
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, marginHorizontal: Spacing.sm },
  title: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  source: { ...Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  errorMessage: { ...Typography.xs, color: Colors.error, marginTop: Spacing.xs, lineHeight: 16 },
  statusMessage: { ...Typography.xs, color: Colors.secondary, marginTop: Spacing.xs },
  sizeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  sizeText: { ...Typography.xs, color: Colors.textSecondary },
  status: { ...Typography.xs, color: Colors.secondary },
  failed: { color: Colors.error },
  action: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    marginTop: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },
  progressFailed: { backgroundColor: Colors.error },
  speed: { ...Typography.xs, color: Colors.secondary, marginTop: 2 },
});
