import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useAudioPlayback } from '@/src/features/audio/AudioPlaybackProvider';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';

export function AudioMiniPlayer() {
  const { activeTrack, isPlaying, togglePlayback, stopPlayback } = useAudioPlayback();

  if (!activeTrack) return null;

  return (
    <View style={styles.container}>
      <View style={styles.trackInfo}>
        <Text numberOfLines={1} style={styles.title}>{activeTrack.title}</Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {isPlaying ? 'Now playing' : 'Paused'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Resume audio'}
        onPress={togglePlayback}
        style={styles.control}>
        <SymbolView
          name={{ ios: isPlaying ? 'pause.fill' : 'play.fill', android: isPlaying ? 'pause' : 'play_arrow', web: isPlaying ? 'pause' : 'play_arrow' }}
          size={22}
          tintColor={Colors.textPrimary}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop audio"
        onPress={stopPlayback}
        style={styles.control}>
        <SymbolView
          name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }}
          size={22}
          tintColor={Colors.textPrimary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 2,
    elevation: 4,
    left: Spacing.md,
    right: Spacing.md,
    bottom: 80,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  trackInfo: { flex: 1, paddingRight: Spacing.sm },
  title: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  subtitle: { ...Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  control: {
    width: 40,
    height: 40,
    marginLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
});
