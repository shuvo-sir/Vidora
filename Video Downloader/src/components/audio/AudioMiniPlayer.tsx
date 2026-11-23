import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { useAudioPlayback } from '@/src/features/audio/AudioPlaybackProvider';
import { Radius, Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export function AudioMiniPlayer() {
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
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
      backgroundColor: colors.surfaceSecondary,
    },
    track: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    artwork: { width: 44, height: 44, borderRadius: Radius.sm },
    artworkFallback: {
      width: 44,
      height: 44,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    trackInfo: { flex: 1, paddingRight: Spacing.sm },
    title: { ...Typography.sm, color: colors.textPrimary, fontWeight: '700' },
    subtitle: { ...Typography.xs, color: colors.textSecondary, marginTop: 2 },
    control: {
      width: 40,
      height: 40,
      marginLeft: Spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
    },
    disabledControl: { opacity: 0.4 },
  }), [colors]);
  const {
    activeTrack,
    isPlaying,
    canSkipTracks,
    skipToPrevious,
    skipToNext,
    togglePlayback,
  } = useAudioPlayback();

  if (!activeTrack) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open player for ${activeTrack.title}`}
        onPress={() =>
          router.push({
            pathname: '/video/[id]',
            params: { id: activeTrack.id },
          })
        }
        style={styles.track}>
        {activeTrack.artworkUrl ? (
          <Image
            source={{ uri: activeTrack.artworkUrl }}
            style={styles.artwork}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.artworkFallback}>
            <SymbolView
              name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
              size={20}
              tintColor={colors.primary}
            />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text numberOfLines={1} style={styles.title}>{activeTrack.title}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {isPlaying ? 'Now playing' : 'Paused'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play previous track"
        accessibilityState={{ disabled: !canSkipTracks }}
        disabled={!canSkipTracks}
        onPress={skipToPrevious}
        style={[styles.control, !canSkipTracks && styles.disabledControl]}>
        <SymbolView
          name={{ ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' }}
          size={20}
          tintColor={colors.textPrimary}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Resume audio'}
        onPress={togglePlayback}
        style={styles.control}>
        <SymbolView
          name={{ ios: isPlaying ? 'pause.fill' : 'play.fill', android: isPlaying ? 'pause' : 'play_arrow', web: isPlaying ? 'pause' : 'play_arrow' }}
          size={22}
          tintColor={colors.textPrimary}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play next track"
        accessibilityState={{ disabled: !canSkipTracks }}
        disabled={!canSkipTracks}
        onPress={skipToNext}
        style={[styles.control, !canSkipTracks && styles.disabledControl]}>
        <SymbolView
          name={{ ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' }}
          size={20}
          tintColor={colors.textPrimary}
        />
      </Pressable>
    </View>
  );
}
