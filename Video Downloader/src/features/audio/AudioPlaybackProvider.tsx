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

type AudioTrack = {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  showNextTrack?: boolean;
  onFinish?: () => void;
};

type ActiveAudioTrack = Pick<AudioTrack, 'id' | 'title' | 'artist'>;

type AudioPlaybackContextValue = {
  activeTrack: ActiveAudioTrack | null;
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  playTrack: (track: AudioTrack) => void;
  seekTo: (positionSeconds: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
};

const AudioPlaybackContext = createContext<AudioPlaybackContextValue | null>(null);

export function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const trackRef = useRef<AudioTrack | null>(null);
  const [activeTrack, setActiveTrack] = useState<ActiveAudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

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
  }, [releasePlayer]);

  const playTrack = useCallback((track: AudioTrack) => {
    const currentPlayer = playerRef.current;
    if (currentPlayer && trackRef.current?.id === track.id && trackRef.current.uri === track.uri) {
      trackRef.current = track;
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
    setActiveTrack({ id: track.id, title: track.title, artist: track.artist });
    setIsPlaying(true);
    setPositionSeconds(0);
    setDurationSeconds(0);

    player.addListener('playbackStatusUpdate', (status) => {
      if (playerRef.current !== player) return;
      setIsPlaying(status.playing ?? player.playing);
      setPositionSeconds(status.currentTime);
      setDurationSeconds(status.duration);
      if (status.didJustFinish) {
        player.pause();
        setIsPlaying(false);
        trackRef.current?.onFinish?.();
      }
    });
    player.play();
  }, [releasePlayer]);

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
        playTrack,
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
