import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';

import { EmptyState } from '@/src/components/ui/EmptyState';
import { AppCard } from '@/src/components/ui/AppCard';
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

type NativeAudioPlayer = {
  playing: boolean;
  loop: boolean;
  play: () => void;
  pause: () => void;
  remove: () => void;
  clearLockScreenControls: () => void;
  setActiveForLockScreen: (
    active: boolean,
    metadata?: {
      title?: string;
      artist?: string;
      albumTitle?: string;
      artworkUrl?: string;
    },
    options?: {
      showSeekForward?: boolean;
      showSeekBackward?: boolean;
      showNextTrack?: boolean;
      showPreviousTrack?: boolean;
    }
  ) => void;
  addListener: (
    eventName: 'playbackStatusUpdate',
    listener: (status: { didJustFinish?: boolean; playing?: boolean }) => void
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
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const nativeAudioPlayerRef = useRef<NativeAudioPlayer | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [filteredUpNext, setFilteredUpNext] = useState<Video[]>([]);

  const visibleUpNext = filteredUpNext.filter((item) => item.id !== currentVideoId);
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

  useEffect(() => {
    let active = true;
    const loadVideo = async () => {
      setLoading(true);
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
          setAudioPlaying(false);
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
          const routeId = Array.isArray(id) ? id[0] : id;
          const isCurrentAudio = video ? isAudioItem(video) : false;
          setFilteredUpNext(
            videos.filter((item) => {
              const isItemAudio = isAudioItem(item);
              return (
                !item.isDemo &&
                Boolean(item.localUri) &&
                (item.id === routeId || (isCurrentAudio ? isItemAudio : !isItemAudio))
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
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error) => {
      console.warn('Unable to configure background audio playback:', error);
    });
  }, []);

  useEffect(() => {
    if (!video?.localUri || isAudioItem(video)) return;
    nativeVideoPlayer.play();
  }, [video, nativeVideoPlayer]);

  useEffect(() => {
    if (!video?.localUri || !isAudioItem(video)) return;

    let cancelled = false;
    const player = createAudioPlayer(video.localUri) as unknown as NativeAudioPlayer;
    player.loop = false;
    player.setActiveForLockScreen(
      true,
      {
        title: video.title,
        artist: video.sourceName || undefined,
        artworkUrl: video.thumbnailUri || undefined,
      },
      {
        showSeekForward: true,
        showSeekBackward: true,
        showNextTrack: filteredUpNext.length > 1,
        showPreviousTrack: false,
      }
    );
    player.play();
    nativeAudioPlayerRef.current = player;

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (cancelled) return;
      setAudioPlaying(status.playing ?? player.playing);
      if (status.didJustFinish) {
        player.pause();
        handleAutoplayNext();
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
      player.clearLockScreenControls();
      player.pause();
      player.remove();
      nativeAudioPlayerRef.current = null;
    };
  }, [video, filteredUpNext.length, handleAutoplayNext]);

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
            <SymbolView
              name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
              size={34}
              tintColor={Colors.primary}
            />
            <Text style={styles.previewLabel}>Audio playing in background</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={audioPlaying ? 'Pause audio' : 'Play audio'}
              onPress={() => {
                if (audioPlaying) {
                  nativeAudioPlayerRef.current?.pause();
                } else {
                  nativeAudioPlayerRef.current?.play();
                }
              }}
              style={styles.openButton}>
              <Text style={styles.openButtonText}>
                {audioPlaying ? 'Pause' : 'Play'}
              </Text>
            </Pressable>
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

      <ScrollView style={styles.info} contentContainerStyle={styles.infoContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{video.title}</Text>
        <Text style={styles.source}>{video.sourceName}</Text>
        <AppCard style={styles.detailsCard}>
          <Text style={styles.detailLabel}>
            {video.isDemo
              ? 'DEMO • No local file'
              : isAudioItem(video)
                ? 'Offline audio'
                : 'Offline video'}
          </Text>
          <Text style={styles.detailText}>
            {playbackError ??
              (video.isDemo || !video.localUri
                ? 'This record has no verified local playable file.'
                : `Playing from device storage: ${video.fileName}`)}
          </Text>
        </AppCard>

        <View style={styles.upNextSection}>
          <Text style={styles.upNextHeader}>
            Up Next ({video ? (isAudioItem(video) ? 'Audio' : 'Videos') : 'Media'})
          </Text>
          {visibleUpNext.length > 0 ? (
            <FlatList
                data={visibleUpNext}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${item.title}`}
                    onPress={() =>
                      router.replace({
                        pathname: '/video/[id]',
                        params: { id: item.id },
                      })
                    }
                    style={({ pressed }) => [styles.upNextItem, pressed && styles.pressed]}>
                    <View style={styles.upNextThumbnail}>
                      {isAudioItem(item) ? (
                        <SymbolView
                          name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
                          size={22}
                          tintColor={Colors.primary}
                        />
                      ) : item.thumbnailUri ? (
                        <Image
                          source={{ uri: item.thumbnailUri }}
                          style={styles.upNextThumbnailImage}
                          resizeMode="cover"
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
                      <Text style={styles.upNextMeta}>
                        {formatDuration(item.durationMs)} • {formatFileSize(item.fileSizeBytes)}
                      </Text>
                    </View>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={styles.upNextSeparator} />}
            />
          ) : (
            <Text style={styles.upNextEmpty}>
              {video && isAudioItem(video)
                ? 'No more audio tracks to play'
                : 'No more videos to play'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { margin: Spacing.md },
  player: { backgroundColor: '#050814' },
  backButton: { position: 'absolute', zIndex: 2, top: Spacing.sm, left: Spacing.sm, width: 44, height: 44, borderRadius: Radius.full, backgroundColor: 'rgba(11,16,32,0.86)', alignItems: 'center', justifyContent: 'center' },
  previewSurface: { height: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  openButton: { marginTop: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, height: 44, justifyContent: 'center' },
  openButtonText: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  videoView: { height: 260, width: '100%', backgroundColor: '#000' },
  previewLabel: { ...Typography.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: Spacing.md },
  info: { flex: 1 },
  infoContent: { padding: Spacing.md, paddingBottom: Spacing.xxxl },
  title: { ...Typography.xxl, color: Colors.textPrimary },
  source: { ...Typography.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  detailsCard: { marginTop: Spacing.lg },
  detailLabel: { ...Typography.sm, color: Colors.secondary, fontWeight: '700' },
  detailText: { ...Typography.sm, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 20 },
  upNextSection: { marginTop: Spacing.xl },
  upNextHeader: { ...Typography.lg, color: Colors.textPrimary, fontWeight: '700', marginBottom: Spacing.sm },
  upNextEmpty: { ...Typography.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.lg },
  upNextItem: { flexDirection: 'row', alignItems: 'center', minHeight: 76 },
  pressed: { opacity: 0.75 },
  upNextThumbnail: { width: 112, height: 64, borderRadius: Radius.md, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  upNextThumbnailImage: { width: '100%', height: '100%' },
  upNextInfo: { flex: 1, paddingLeft: Spacing.md },
  upNextTitle: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  upNextMeta: { ...Typography.xs, color: Colors.textSecondary, marginTop: 6 },
  upNextSeparator: { height: Spacing.sm },
});
