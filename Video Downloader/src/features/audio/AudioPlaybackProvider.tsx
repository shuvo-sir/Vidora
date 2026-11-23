import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type AudioQueueTrack = {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
};

type AudioTrack = AudioQueueTrack & {
  queue?: AudioQueueTrack[];
  showNextTrack?: boolean;
  onFinish?: () => void;
};

type ActiveAudioTrack = Pick<AudioTrack, 'id' | 'title' | 'artist' | 'artworkUrl'>;

type AudioPlaybackContextValue = {
  activeTrack: ActiveAudioTrack | null;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  canSkipTracks: boolean;
  playTrack: (track: AudioTrack) => void;
  skipToPrevious: () => void;
  skipToNext: () => void;
  seekTo: (positionSeconds: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
};

const AudioPlaybackContext = createContext<AudioPlaybackContextValue | null>(null);

export function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const trackRef = useRef<AudioTrack | null>(null);
  const playAdjacentTrackRef = useRef<(offset: -1 | 1) => void>(() => {});
  const [activeTrack, setActiveTrack] = useState<ActiveAudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [canSkipTracks, setCanSkipTracks] = useState(false);

  const releasePlayer = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    trackRef.current = null;
    if (player) {
      player.clearLockScreenControls();
      player.pause();
      player.remove();
    }
  }, []);

  const stopPlayback = useCallback(() => {
    releasePlayer();
    setActiveTrack(null);
    setIsPlaying(false);
    setPositionSeconds(0);
    setDurationSeconds(0);
    setCanSkipTracks(false);
  }, [releasePlayer]);

  const playTrack = useCallback((track: AudioTrack) => {
    const currentPlayer = playerRef.current;
    if (currentPlayer && trackRef.current?.id === track.id && trackRef.current.uri === track.uri) {
      trackRef.current = track;
      setCanSkipTracks(Boolean(track.queue && track.queue.length > 1));
      currentPlayer.play();
      setIsPlaying(true);
      return;
    }

    releasePlayer();
    const player = createAudioPlayer(track.uri, { updateInterval: 250 });
    player.loop = false;
    player.setActiveForLockScreen(
      true,
      {
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
      },
      {
        showSeekForward: true,
        showSeekBackward: true,
        showNextTrack: Boolean(track.showNextTrack),
        showPreviousTrack: false,
      }
    );
    playerRef.current = player;
    trackRef.current = track;
    setActiveTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artworkUrl: track.artworkUrl,
    });
    setIsPlaying(true);
    setPositionSeconds(0);
    setDurationSeconds(0);
    setCanSkipTracks(Boolean(track.queue && track.queue.length > 1));

    player.addListener('playbackStatusUpdate', (status) => {
      if (playerRef.current !== player) return;
      setIsPlaying(status.playing ?? player.playing);
      setPositionSeconds(status.currentTime);
      setDurationSeconds(status.duration);
      if (status.didJustFinish) {
        const finishedTrack = trackRef.current;
        if (finishedTrack?.queue && finishedTrack.queue.length > 1) {
          playAdjacentTrackRef.current(1);
        } else {
          player.pause();
          setIsPlaying(false);
        }
        finishedTrack?.onFinish?.();
      }
    });
    player.play();
  }, [releasePlayer]);

  const playAdjacentTrack = useCallback((offset: -1 | 1) => {
    const currentTrack = trackRef.current;
    const queue = currentTrack?.queue;
    if (!currentTrack || !queue || queue.length <= 1) return;

    const currentIndex = queue.findIndex((track) => track.id === currentTrack.id);
    if (currentIndex < 0) return;

    const nextTrack = queue[(currentIndex + offset + queue.length) % queue.length];
    if (nextTrack) {
      playTrack({
        ...nextTrack,
        queue,
        showNextTrack: true,
        onFinish: currentTrack.onFinish,
      });
    }
  }, [playTrack]);

  useEffect(() => {
    playAdjacentTrackRef.current = playAdjacentTrack;
  }, [playAdjacentTrack]);

  const skipToPrevious = useCallback(() => {
    playAdjacentTrack(-1);
  }, [playAdjacentTrack]);

  const skipToNext = useCallback(() => {
    playAdjacentTrack(1);
  }, [playAdjacentTrack]);

  const seekTo = useCallback((requestedPosition: number) => {
    const player = playerRef.current;
    if (!player) return;

    const duration = player.duration;
    const position = Math.max(0, Math.min(requestedPosition, duration));
    setPositionSeconds(position);
    void player.seekTo(position).catch((error) => {
      console.warn('Unable to seek audio playback:', error);
    });
  }, []);

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, []);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error) => {
      console.warn('Unable to configure background audio playback:', error);
    });

    return () => releasePlayer();
  }, [releasePlayer]);

  return (
    <AudioPlaybackContext.Provider
      value={{
        activeTrack,
        isPlaying,
        positionSeconds,
        durationSeconds,
        canSkipTracks,
        playTrack,
        skipToPrevious,
        skipToNext,
        seekTo,
        togglePlayback,
        stopPlayback,
      }}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlayback() {
  const context = useContext(AudioPlaybackContext);
  if (!context) {
    throw new Error('useAudioPlayback must be used within an AudioPlaybackProvider.');
  }
  return context;
}
