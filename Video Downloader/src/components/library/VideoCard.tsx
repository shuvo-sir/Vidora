import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { Video } from '@/src/types';
import { formatDuration, formatFileSize } from '@/src/utils/format-media';

export function VideoCard({ video, compact }: { video: Video; compact: boolean }) {
  const openVideo = () => router.push({ pathname: '/video/[id]', params: { id: video.id } });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${video.title}`}
      onPress={openVideo}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compact : styles.grid,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.thumbnail, compact && styles.compactThumbnail]}>
        {video.thumbnailUri ? (
          <Image
            source={{ uri: video.thumbnailUri }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <SymbolView name={{ ios: 'play.rectangle', android: 'play_arrow', web: 'play_arrow' }} size={compact ? 24 : 32} tintColor={Colors.textSecondary} />
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

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  grid: { width: '48%', marginBottom: Spacing.md },
  compact: { width: '100%', flexDirection: 'row', marginBottom: Spacing.sm },
  pressed: { opacity: 0.82 },
  thumbnail: { height: 112, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  thumbnailImage: { width: '100%', height: '100%' },
  compactThumbnail: { width: 112, height: 84 },
  duration: { position: 'absolute', right: Spacing.sm, bottom: Spacing.sm, backgroundColor: 'rgba(11,16,32,0.88)', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  durationText: { ...Typography.xs, color: Colors.textPrimary },
  info: { flex: 1, padding: Spacing.sm },
  title: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  meta: { ...Typography.xs, color: Colors.textSecondary, marginTop: 4 },
  compactMeta: { flexDirection: 'row', justifyContent: 'space-between' },
});
