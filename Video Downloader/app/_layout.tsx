import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as Network from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';

import { DatabaseProvider } from '@/src/database/DatabaseProvider';
import { AudioPlaybackProvider } from '@/src/features/audio/AudioPlaybackProvider';
import { useSettings } from '@/src/features/settings/SettingsProvider';
import { initializeSettings } from '@/src/store/settings-store';
import { useNetworkStore } from '@/src/store/network-store';
import { DownloadManagerProvider, useDownloadManager } from '@/src/hooks/useDownloadManager';
import { AnimatedSplash } from '@/src/components/ui/AnimatedSplash';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const finishSplash = useCallback(() => setIsSplashVisible(false), []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    SplashScreen.hideAsync().catch((caught: unknown) => {
      console.error('Unable to hide the native splash screen:', caught);
    });
  }, []);

  return (
    <>
      {loaded ? <RootLayoutNav /> : null}
      {isSplashVisible ? <AnimatedSplash onFinish={finishSplash} /> : null}
    </>
  );
}

function RootLayoutNav() {
  return (
    <ShareIntentProvider>
      <SharedLinkHandler />
      <DatabaseProvider>
        <AppBootstrap>
          <DownloadManagerProvider>
            <RootLayoutContent />
          </DownloadManagerProvider>
        </AppBootstrap>
      </DatabaseProvider>
    </ShareIntentProvider>
  );
}

function RootLayoutContent() {
  const { settings, colors } = useSettings();
  const isDark = settings.theme === 'dark';
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.secondary,
    },
  };

  return (
    <AudioPlaybackProvider>
      <ThemeProvider value={navigationTheme}>
        <DownloadLifecycle />
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="video/[id]" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </AudioPlaybackProvider>
  );
}

function AppBootstrap({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let receivedNetworkEvent = false;
    const setNetworkState = useNetworkStore.getState().setNetworkState;
    const setNetworkError = useNetworkStore.getState().setError;
    const subscription = Network.addNetworkStateListener((state) => {
      receivedNetworkEvent = true;
      setNetworkState(state);
    });

    const loadSettings = initializeSettings(db).catch((caught: unknown) => {
      console.error('Unable to load saved preferences:', caught);
    });
    const loadNetwork = Network.getNetworkStateAsync()
      .then((state) => {
        if (!receivedNetworkEvent) setNetworkState(state);
      })
      .catch((caught: unknown) => {
        const message =
          caught instanceof Error
            ? caught.message
            : 'Unable to read the current network state.';
        setNetworkError(message);
        console.error('Unable to read the current network state:', caught);
      });

    void Promise.all([loadSettings, loadNetwork]).then(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [db]);

  if (!ready) return null;
  return <>{children}</>;
}

function SharedLinkHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const handledShareIntent = useRef<typeof shareIntent | null>(null);

  useEffect(() => {
    if (!hasShareIntent || handledShareIntent.current === shareIntent) return;

    handledShareIntent.current = shareIntent;
    const sharedUrl = (shareIntent.webUrl ?? shareIntent.text)?.trim();
    if (sharedUrl) {
      router.push({ pathname: '/', params: { sharedUrl } });
    }

    resetShareIntent();
  }, [hasShareIntent, resetShareIntent, shareIntent]);

  return null;
}

function DownloadLifecycle() {
  useDownloadManager();
  return null;
}
