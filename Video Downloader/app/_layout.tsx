import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';

import { useColorScheme } from '@/components/useColorScheme';
import { DatabaseProvider } from '@/src/database/DatabaseProvider';
import { AudioPlaybackProvider } from '@/src/features/audio/AudioPlaybackProvider';
import { useDownloadManager } from '@/src/hooks/useDownloadManager';

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

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ShareIntentProvider>
      <SharedLinkHandler />
      <DatabaseProvider>
        <AudioPlaybackProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <DownloadLifecycle />
            <StatusBar style="light" />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="video/[id]" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack>
          </ThemeProvider>
        </AudioPlaybackProvider>
      </DatabaseProvider>
    </ShareIntentProvider>
  );
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
