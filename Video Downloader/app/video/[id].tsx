import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';

import { EmptyState } from '@/src/components/ui/EmptyState';
import { AppCard } from '@/src/components/ui/AppCard';
import { useAudioPlayback } from '@/src/features/audio/AudioPlaybackProvider';
import { getAllVideos, getVideoById } from '@/src/features/library/library-repository';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { Video } from '@/src/types';
import { formatDuration, formatFileSize } from '@/src/utils/format-media';

type NativeVideoPlayer = {
  play: () => void;
  pause: () => void;
  addListener: (
    eventName: 'playToEnd',
    listener: () => void
  ) => { remove: () => void };
};

function isAudioItem(item: Video) {
  const fileName = item.fileName?.toLowerCase() ?? '';
  const localPath = item.localUri?.toLowerCase() ?? '';
  return (
    item.mediaType === 'audio' ||
    fileName.endsWith('.mp3') ||
    localPath.endsWith('.mp3')
  );
}

export default function VideoPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentVideoId = Array.isArray(id) ? id[0] : id;
  const db = useSQLiteContext();
  const {
    activeTrack,
    isPlaying,
    positionSeconds,
    durationSeconds,
    playTrack,
    seekTo,
    togglePlayback,
    stopPlayback,
  } = useAudioPlayback();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [filteredUpNext, setFilteredUpNext] = useState<Video[]>([]);
  const [trackBarWidth, setTrackBarWidth] = useState(0);
  const isScreenFocused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isScreenFocused.current = true;
      return () => {
        isScreenFocused.current = false;
      };
    }, [])
  );

  const audioPlaying = activeTrack?.id === video?.id && isPlaying;
  const audioPosition = activeTrack?.id === video?.id ? positionSeconds : 0;
  const audioDuration = activeTrack?.id === video?.id ? durationSeconds : 0;
  const audioProgress =
    audioDuration > 0 ? Math.min(100, (audioPosition / audioDuration) * 100) : 0;
  const videoSource =
    video && !isAudioItem(video) && video.localUri ? video.localUri : null;
  const nativeVideoPlayer = useVideoPlayer(videoSource, (player) => {
    player.staysActiveInBackground = true;
    player.showNowPlayingNotification = true;
    player.loop = false;
    player.muted = false;
    if (videoSource) {
      player.play();
    }
  });

  const handleAutoplayNext = useCallback(() => {
    if (!isScreenFocused.current) return;

    if (filteredUpNext.length <= 1) {
      console.log('No more items to autoplay.');
      return;
    }

    const currentIndex = filteredUpNext.findIndex(
      (item) => item.id === currentVideoId
    );
    const nextIndex = (currentIndex + 1) % filteredUpNext.length;
    const nextItem = filteredUpNext[nextIndex];

    if (nextItem) {
      router.replace({
        pathname: '/video/[id]',
        params: { id: nextItem.id },
      });
    }
  }, [filteredUpNext, currentVideoId]);

  const startAudio = useCallback(() => {
    if (!video?.localUri || !isAudioItem(video)) return;
    playTrack({
      id: video.id,
      uri: video.localUri,
      title: video.title,
      artist: video.sourceName ?? undefined,
      artworkUrl: video.thumbnailUri ?? undefined,
      queue: filteredUpNext.flatMap((item) => {
        if (!item.localUri || !isAudioItem(item)) return [];
        return [{
          id: item.id,
          uri: item.localUri,
          title: item.title,
          artist: item.sourceName ?? undefined,
          artworkUrl: item.thumbnailUri ?? undefined,
        }];
      }),
      showNextTrack: filteredUpNext.length > 1,
      onFinish: handleAutoplayNext,
    });
  }, [video, filteredUpNext, playTrack, handleAutoplayNext]);

  const selectQueueItem = useCallback((item: Video) => {
    setVideo(item);
    setPlaybackError(null);
    router.setParams({ id: item.id });
  }, []);

  const moveInQueue = useCallback((offset: -1 | 1) => {
    if (!video || filteredUpNext.length <= 1) return;
    const currentIndex = filteredUpNext.findIndex((item) => item.id === video.id);
    const nextIndex = (currentIndex + offset + filteredUpNext.length) % filteredUpNext.length;
    const nextItem = filteredUpNext[nextIndex];
    if (nextItem) selectQueueItem(nextItem);
  }, [video, filteredUpNext, selectQueueItem]);

  const playPrevious = useCallback(() => {
    if (audioPosition > 3) {
      seekTo(0);
      return;
    }
    moveInQueue(-1);
  }, [audioPosition, seekTo, moveInQueue]);

  useEffect(() => {
    let active = true;
    const loadVideo = async () => {
      setDatabaseError(null);
      setPlaybackError(null);
      try {
        const routeId = Array.isArray(id) ? id[0] : id;
        const record = routeId ? await getVideoById(db, routeId) : null;
        if (active) {
          let playableRecord = record;
          if (record?.assetId) {
            try {
              const asset = await MediaLibrary.getAssetInfoAsync(record.assetId);
              if (!asset) {
                playableRecord = null;
                setPlaybackError('This video was deleted from device storage.');
              } else if (asset.uri !== record.localUri) {
                const { updateVideo } = await import('@/src/features/library/library-repository');
                playableRecord = await updateVideo(db, record.id, { localUri: asset.uri }) ?? record;
              }
            } catch {
              playableRecord = null;
              setPlaybackError('This video is no longer available in device storage.');
            }
          } else if (record?.localUri) {
            try {
              const localFile = new File(record.localUri);
              if (!localFile.exists || (localFile.info().size ?? 0) === 0) {
                setPlaybackError('The local video file is missing or empty.');
              }
            } catch {
              setPlaybackError('The local video file could not be accessed.');
            }
          }
          setVideo(playableRecord);
        }
      } catch (caught) {
        if (active) {
          setDatabaseError(
            caught instanceof Error ? caught.message : 'Unable to load the video record.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadVideo();
    return () => {
      active = false;
    };
  }, [db, id]);

  useEffect(() => {
    let active = true;
    void getAllVideos(db)
      .then((videos) => {
        if (active) {
          const isCurrentAudio = video ? isAudioItem(video) : false;
          setFilteredUpNext(
            videos.filter((item) => {
              return (
                !item.isDemo &&
                Boolean(item.localUri) &&
                isAudioItem(item) === isCurrentAudio
              );
            })
          );
        }
      })
      .catch(() => {
        if (active) setFilteredUpNext([]);
      });
    return () => {
      active = false;
    };
  }, [db, id, video]);

  useEffect(() => {
    if (!video) return;
    if (isAudioItem(video)) {
      startAudio();
    } else {
      stopPlayback();
    }
  }, [video, startAudio, stopPlayback]);

  useEffect(() => {
    if (!video?.localUri || isAudioItem(video)) return;
    nativeVideoPlayer.play();
  }, [video, nativeVideoPlayer]);

  useEffect(() => {
    if (!video || isAudioItem(video) || filteredUpNext.length === 0) return;

    const player = nativeVideoPlayer as NativeVideoPlayer;
    const subscription = player.addListener('playToEnd', () => {
      player.pause();
      handleAutoplayNext();
    });

    return () => {
      subscription.remove();
    };
  }, [video, nativeVideoPlayer, filteredUpNext, handleAutoplayNext]);

  const openExternalPlayer = async () => {
    if (!video?.localUri) return;
    try {
      await Linking.openURL(video.localUri);
    } catch {
      setPlaybackError('No app is available to open this local video.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingState}>
          <Text style={styles.previewLabel}>Loading video record...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (databaseError || !video) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppCard style={styles.errorCard}>
          <EmptyState
            title="Video unavailable"
            description={
              databaseError ??
              'The requested video record could not be found in the local database.'
            }
            actionLabel="Return to Library"
            onAction={() => router.replace('/library')}
          />
        </AppCard>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.player}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} tintColor={Colors.textPrimary} />
        </Pressable>

        {video.isDemo || !video.localUri || playbackError ? (
          <View style={styles.previewSurface}>
            <SymbolView name={{ ios: 'exclamationmark.triangle', android: 'error', web: 'error' }} size={34} tintColor={Colors.textSecondary} />
            <Text style={styles.previewLabel}>
              {playbackError ?? 'This record has no verified local playable file.'}
            </Text>
            {!video.isDemo && video.localUri && playbackError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open in device player"
                onPress={() => void openExternalPlayer()}
                style={styles.openButton}>
                <Text style={styles.openButtonText}>Open in device player</Text>
              </Pressable>
            ) : null}
          </View>
        ) : isAudioItem(video) ? (
          <View style={styles.previewSurface}>
            {video.thumbnailUri ? (
              <Image
                source={{ uri: video.thumbnailUri }}
                style={styles.audioArtwork}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.audioArtworkFallback}>
                <SymbolView
                  name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
                  size={42}
                  tintColor={Colors.primary}
                />
              </View>
            )}
            <Text numberOfLines={2} style={styles.audioTitle}>{video.title}</Text>
            <View style={styles.audioControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play previous track"
                accessibilityState={{ disabled: filteredUpNext.length <= 1 }}
                disabled={filteredUpNext.length <= 1}
                onPress={playPrevious}
                style={({ pressed }) => [
                  styles.audioControlButton,
                  filteredUpNext.length <= 1 && styles.disabledControl,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' }}
                  size={22}
                  tintColor={Colors.textPrimary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={audioPlaying ? 'Pause audio' : 'Play audio'}
                onPress={() => {
                  if (activeTrack?.id === video.id) {
                    togglePlayback();
                  } else {
                    startAudio();
                  }
                }}
                style={({ pressed }) => [styles.mainAudioControl, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: audioPlaying ? 'pause.fill' : 'play.fill', android: audioPlaying ? 'pause' : 'play_arrow', web: audioPlaying ? 'pause' : 'play_arrow' }}
                  size={24}
                  tintColor={Colors.textPrimary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play next track"
                accessibilityState={{ disabled: filteredUpNext.length <= 1 }}
                disabled={filteredUpNext.length <= 1}
                onPress={() => moveInQueue(1)}
                style={({ pressed }) => [
                  styles.audioControlButton,
                  filteredUpNext.length <= 1 && styles.disabledControl,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' }}
                  size={22}
                  tintColor={Colors.textPrimary}
                />
              </Pressable>
            </View>
            <View style={styles.trackTimeline}>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Audio position"
                accessibilityValue={{
                  min: 0,
                  max: Math.floor(audioDuration),
                  now: Math.floor(audioPosition),
                }}
                onLayout={(event) => setTrackBarWidth(event.nativeEvent.layout.width)}
                onPress={(event) => {
                  if (trackBarWidth > 0 && audioDuration > 0) {
                    seekTo((event.nativeEvent.locationX / trackBarWidth) * audioDuration);
                  }
                }}
                style={styles.trackBarTouchArea}>
                <View style={styles.trackBar}>
                  <View style={[styles.trackBarProgress, { width: `${audioProgress}%` }]} />
                </View>
              </Pressable>
              <View style={styles.trackTimes}>
                <Text style={styles.trackTime}>{formatPlaybackTime(audioPosition)}</Text>
                <Text style={styles.trackTime}>{formatPlaybackTime(audioDuration)}</Text>
              </View>
            </View>
          </View>
        ) : videoSource ? (
          <VideoView
            player={nativeVideoPlayer}
            style={styles.videoView}
            nativeControls
            contentFit="contain"
          />
        ) : (
          <View style={styles.previewSurface}>
            <Text style={styles.previewLabel}>Loading native player...</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.upNextHeaderContainer}>
          <Text style={styles.upNextHeader}>
            {isAudioItem(video) ? 'Music list' : 'Video list'}
          </Text>
        </View>
        <FlatList
          style={styles.queueList}
          contentContainerStyle={styles.queueContent}
          data={filteredUpNext}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.id === video.id
                  ? `Now playing: ${item.title}`
                  : `Play ${item.title}`
              }
              accessibilityState={{ selected: item.id === video.id, disabled: item.id === video.id }}
              disabled={item.id === video.id}
              onPress={() => selectQueueItem(item)}
              style={({ pressed }) => [
                styles.upNextItem,
                item.id === video.id && styles.nowPlayingItem,
                pressed && styles.pressed,
              ]}>
              <View style={styles.upNextThumbnail}>
                {item.thumbnailUri ? (
                  <Image
                    source={{ uri: item.thumbnailUri }}
                    style={styles.upNextThumbnailImage}
                    resizeMode="cover"
                  />
                ) : isAudioItem(item) ? (
                  <SymbolView
                    name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
                    size={22}
                    tintColor={Colors.primary}
                  />
                ) : (
                  <SymbolView
                    name={{ ios: 'play.rectangle', android: 'play_arrow', web: 'play_arrow' }}
                    size={22}
                    tintColor={Colors.textSecondary}
                  />
                )}
              </View>
              <View style={styles.upNextInfo}>
                <Text numberOfLines={2} style={styles.upNextTitle}>{item.title}</Text>
                {item.id === video.id ? (
                  <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
                ) : null}
                <Text style={styles.upNextMeta}>
                  {formatDuration(item.durationMs)} • {formatFileSize(item.fileSizeBytes)}
                </Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.upNextSeparator} />}
          ListEmptyComponent={
            <Text style={styles.upNextEmpty}>
              {isAudioItem(video) ? 'No music available' : 'No videos available'}
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { margin: Spacing.md },
  player: { backgroundColor: '#050814' },
  backButton: { position: 'absolute', zIndex: 2, top: Spacing.sm, left: Spacing.sm, width: 44, height: 44, borderRadius: Radius.full, backgroundColor: 'rgba(11,16,32,0.86)', alignItems: 'center', justifyContent: 'center' },
  previewSurface: { height: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  openButton: { marginTop: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, height: 44, justifyContent: 'center' },
  audioArtwork: { width: 100, height: 100, borderRadius: Radius.md, marginBottom: Spacing.sm },
  audioArtworkFallback: { width: 100, height: 100, borderRadius: Radius.md, marginBottom: Spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  audioControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  audioControlButton: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  mainAudioControl: { width: 52, height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  disabledControl: { opacity: 0.4 },
  trackTimeline: { width: '82%', marginTop: Spacing.sm },
  trackBarTouchArea: { height: 24, justifyContent: 'center' },
  trackBar: { height: 5, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  trackBarProgress: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },
  trackTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  trackTime: { ...Typography.xs, color: Colors.textSecondary },
  openButtonText: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  audioTitle: { ...Typography.lg, color: Colors.textPrimary, fontWeight: '700', marginBottom: Spacing.xs, textAlign: 'center' },
  videoView: { height: 260, width: '100%', backgroundColor: '#000' },
  previewLabel: { ...Typography.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: Spacing.md },
  info: { flex: 1 },
  upNextHeaderContainer: { backgroundColor: Colors.background, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  queueList: { flex: 1 },
  queueContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxxl },
  upNextHeader: { ...Typography.lg, color: Colors.textPrimary, fontWeight: '700' },
  upNextEmpty: { ...Typography.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.lg },
  upNextItem: { flexDirection: 'row', alignItems: 'center', minHeight: 76 },
  nowPlayingItem: { backgroundColor: Colors.surfaceSecondary, borderRadius: Radius.md },
  pressed: { opacity: 0.75 },
  upNextThumbnail: { width: 112, height: 64, borderRadius: Radius.md, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  upNextThumbnailImage: { width: '100%', height: '100%' },
  upNextInfo: { flex: 1, paddingLeft: Spacing.md },
  upNextTitle: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  nowPlayingLabel: { ...Typography.xs, color: Colors.primary, fontWeight: '700', marginTop: 4 },
  upNextMeta: { ...Typography.xs, color: Colors.textSecondary, marginTop: 6 },
  upNextSeparator: { height: Spacing.sm },
});
