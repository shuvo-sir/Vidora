import { memo, useMemo } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Radius, Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';
import type { Video } from '@/src/types';
import { formatDuration, formatFileSize } from '@/src/utils/format-media';

function VideoCardComponent({
  video,
  compact,
  onDelete,
}: {
  video: Video;
  compact: boolean;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    card: { borderRadius: Radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    grid: { width: '48%', marginBottom: Spacing.md },
    compact: { width: '100%', flexDirection: 'row', marginBottom: Spacing.sm },
    pressed: { opacity: 0.82 },
    thumbnail: { height: 112, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    audioThumbnail: { backgroundColor: colors.surfaceSecondary },
    audioIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    thumbnailImage: { width: '100%', height: '100%' },
    compactThumbnail: { width: 112, height: 84 },
    duration: { position: 'absolute', right: Spacing.sm, bottom: Spacing.sm, backgroundColor: colors.background, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
    durationText: { ...Typography.xs, color: colors.textPrimary },
    info: { flex: 1, padding: Spacing.sm },
    title: { ...Typography.sm, color: colors.textPrimary, fontWeight: '700' },
    meta: { ...Typography.xs, color: colors.textSecondary, marginTop: 4 },
    compactMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  }), [colors]);
  const openVideo = () => router.push({ pathname: '/video/[id]', params: { id: video.id } });
  const isAudio =
    video.mediaType === 'audio' ||
    video.fileName?.toLowerCase().endsWith('.mp3') ||
    video.localUri?.toLowerCase().endsWith('.mp3');
  const confirmDelete = () => {
    Alert.alert(
      `Delete ${video.mediaType === 'audio' ? 'audio' : 'video'}?`,
      'This removes the file from this device and your Vidora library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDelete(video.id).then((deleted) => {
              if (!deleted) {
                Alert.alert(
                  'Unable to delete',
                  'Media Library permission is required to delete this file.'
                );
              }
            });
          },
        },
      ]
    );
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${video.title}`}
      onPress={openVideo}
      onLongPress={confirmDelete}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.grid,
        pressed && styles.pressed,
      ]}>
      <View style={[
        styles.thumbnail,
        compact && styles.compactThumbnail,
        isAudio && styles.audioThumbnail,
      ]}>
        {isAudio ? (
          <View style={styles.audioIcon}>
            <SymbolView
              name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
              size={compact ? 28 : 38}
              tintColor={colors.primary}
            />
          </View>
        ) : video.thumbnailUri ? (
          <Image
            source={{ uri: video.thumbnailUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <SymbolView name={{ ios: 'play.rectangle', android: 'play_arrow', web: 'play_arrow' }} size={compact ? 24 : 32} tintColor={colors.textSecondary} />
        )}
        <View style={styles.duration}>
          <Text style={styles.durationText}>{formatDuration(video.durationMs)}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.title}>{video.title}{video.isDemo ? ' • DEMO' : ''}</Text>
        {compact ? (
          <View style={styles.compactMeta}>
            <Text style={styles.meta}>{video.sourceName ?? 'Unknown source'}</Text>
            <Text style={styles.meta}>{formatFileSize(video.fileSizeBytes)}</Text>
          </View>
        ) : (
          <>
            <Text numberOfLines={1} style={styles.meta}>{video.sourceName ?? 'Unknown source'}</Text>
            <Text style={styles.meta}>{formatFileSize(video.fileSizeBytes)}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export const VideoCard = memo(VideoCardComponent);
