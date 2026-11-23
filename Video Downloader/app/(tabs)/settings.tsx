import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';

import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { Radius, Spacing, Typography } from '@/src/theme';
import type { AppColors } from '@/src/theme/colors';
import { useSettings } from '@/src/features/settings/SettingsProvider';
import { useSettingsStore } from '@/src/store/settings-store';
import { requestDownloadNotificationPermission } from '@/src/features/settings/download-notifications';
import { createDownload, clearDemoDownloads } from '@/src/features/downloads/download-repository';
import { clearDemoVideos, createVideo, getTotalLibrarySize, getVideoCount } from '@/src/features/library/library-repository';
import { useDownloadManager } from '@/src/hooks/useDownloadManager';
import { createId } from '@/src/utils/create-id';

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
    sectionTitle: { ...Typography.lg, color: colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    settingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    settingText: { flex: 1, paddingRight: Spacing.sm },
    settingTitle: { ...Typography.md, color: colors.textPrimary, fontWeight: '600' },
    settingDescription: { ...Typography.sm, color: colors.textSecondary, marginTop: 4 },
    storageTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    storageValue: { ...Typography.xxl, color: colors.textPrimary, fontWeight: '700' },
    manageButton: { minHeight: 44, borderRadius: Radius.md, backgroundColor: colors.surfaceSecondary, marginTop: Spacing.md, paddingHorizontal: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
    manageText: { ...Typography.sm, color: colors.primary, fontWeight: '700', textAlign: 'center' },
    destructiveText: { ...Typography.sm, color: colors.error, fontWeight: '700', textAlign: 'center' },
    linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
    pressed: { opacity: 0.7 },
    aboutCard: { alignItems: 'center' },
    aboutLogo: { width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    appName: { ...Typography.xl, color: colors.textPrimary, marginTop: Spacing.sm, fontWeight: '700' },
    errorBanner: { ...Typography.sm, color: colors.error, marginTop: Spacing.sm, lineHeight: 20 },
  });
}

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function LinkRow({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <Text style={styles.settingTitle}>{title}</Text>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={18}
        tintColor={colors.textSecondary}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { colors } = useSettings();
  const theme = useSettingsStore((state) => state.theme);
  const wifiOnly = useSettingsStore((state) => state.wifiOnly);
  const notifications = useSettingsStore((state) => state.notifications);
  const isReady = useSettingsStore((state) => state.isReady);
  const error = useSettingsStore((state) => state.error);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const clearError = useSettingsStore((state) => state.clearError);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const manager = useDownloadManager();
  const db = useSQLiteContext();
  const [videoCount, setVideoCount] = useState(0);
  const [librarySize, setLibrarySize] = useState(0);
  const [clearingStorage, setClearingStorage] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const count = await getVideoCount(db);
      const size = await getTotalLibrarySize(db);
      return { count, size };
    } catch (caught) {
      Alert.alert(
        'Database unavailable',
        caught instanceof Error ? caught.message : 'Unable to read local database statistics.'
      );
      return null;
    }
  }, [db]);

  const refreshStats = useCallback(async () => {
    const stats = await loadStats();
    if (stats) {
      setVideoCount(stats.count);
      setLibrarySize(stats.size);
    }
  }, [loadStats]);

  useEffect(() => {
    let active = true;
    void loadStats().then((stats) => {
      if (active && stats) {
        setVideoCount(stats.count);
        setLibrarySize(stats.size);
      }
    });
    return () => {
      active = false;
    };
  }, [loadStats]);

  const updatePreference = async (
    key: 'theme' | 'wifiOnly' | 'notifications',
    value: 'dark' | 'light' | boolean
  ) => {
    try {
      if (key === 'notifications' && value === true) {
        const permissionGranted = await requestDownloadNotificationPermission();
        if (!permissionGranted) {
          Alert.alert(
            'Notifications unavailable',
            'Vidora needs notification permission to alert you when downloads finish. Enable notifications in your device settings, then try again.'
          );
          return;
        }
      }

      if (key === 'theme') {
        if (value !== 'dark' && value !== 'light') {
          throw new Error('Invalid theme preference.');
        }
        await updateSetting(db, key, value);
      } else {
        if (typeof value !== 'boolean') {
          throw new Error('Invalid setting value.');
        }
        await updateSetting(db, key, value);
      }
    } catch (caught) {
      Alert.alert(
        'Unable to save setting',
        caught instanceof Error ? caught.message : 'The preference could not be saved.'
      );
    }
  };

  const clearStorage = async () => {
    setClearingStorage(true);
    try {
      await manager.clearAll();
      await refreshStats();
      Alert.alert('Storage cleared', 'Vidora downloads and library media were removed.');
    } catch (caught) {
      Alert.alert(
        'Unable to clear storage',
        caught instanceof Error ? caught.message : 'Some Vidora media could not be removed.'
      );
    } finally {
      setClearingStorage(false);
    }
  };

  const confirmClearStorage = () => {
    Alert.alert(
      'Delete all Vidora downloads?',
      'This permanently removes all Vidora downloads and library items, including active and queued downloads. Unrelated gallery content will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => void clearStorage() },
      ]
    );
  };

  const addTestDownload = async () => {
    try {
      await createDownload(db, {
        id: createId('demo-download'),
        title: 'Development Test Download',
        sourceUrl: 'https://example.com/demo.mp4',
        sourceName: 'Development Demo',
        fileName: 'development-test.mp4',
        mimeType: 'video/mp4',
        totalBytes: 100_000_000,
        downloadedBytes: 42_000_000,
        status: 'downloading',
        isDemo: true,
        localUri: null,
      });
      await manager.refresh();
      await refreshStats();
      Alert.alert('Demo download added', 'This record is marked as DEMO and persists locally.');
    } catch (caught) {
      Alert.alert('Unable to add test download', caught instanceof Error ? caught.message : 'Unknown database error.');
    }
  };

  const addTestLibraryVideo = async () => {
    try {
      await createVideo(db, {
        id: createId('demo-video'),
        title: 'Development Test Video',
        sourceName: 'Development Demo',
        fileName: 'development-test.mp4',
        localUri: null,
        mimeType: 'video/mp4',
        fileSizeBytes: 100_000_000,
        durationMs: 90000,
        isDemo: true,
      });
      await refreshStats();
      Alert.alert('Demo video added', 'This record has no playable local file.');
    } catch (caught) {
      Alert.alert('Unable to add test video', caught instanceof Error ? caught.message : 'Unknown database error.');
    }
  };

  const clearTestRecords = async () => {
    try {
      await clearDemoVideos(db);
      await clearDemoDownloads(db);
      await manager.refresh();
      await refreshStats();
      Alert.alert('Test records cleared', 'Only DEMO records were removed.');
    } catch (caught) {
      Alert.alert('Unable to clear test records', caught instanceof Error ? caught.message : 'Unknown database error.');
    }
  };
  const showSoon = (title: string) =>
    Alert.alert(title, 'This action is not configured in this version.');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Settings" subtitle="Personalize your Vidora experience" />
        {error ? (
          <Pressable accessibilityRole="alert" onPress={clearError}>
            <Text style={styles.errorBanner}>{error} Tap to dismiss.</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>General</Text>
        <AppCard>
          <SettingRow
            title="Premium dark theme"
            description="Use a dark palette throughout Vidora"
            value={theme === 'dark'}
            disabled={!isReady}
            onValueChange={(value) =>
              void updatePreference('theme', value ? 'dark' : 'light')
            }
          />
          <SettingRow
            title="Wi-Fi only downloads"
            description="When off, downloads may also use mobile data"
            value={wifiOnly}
            disabled={!isReady}
            onValueChange={(value) => void updatePreference('wifiOnly', value)}
          />
          <SettingRow
            title="Download notifications"
            description="Notify when a download completes"
            value={notifications}
            disabled={!isReady}
            onValueChange={(value) => void updatePreference('notifications', value)}
          />
        </AppCard>

        <Text style={styles.sectionTitle}>Storage</Text>
        <AppCard>
          <View style={styles.storageTop}>
            <Text style={styles.storageValue}>{(librarySize / 1_000_000_000).toFixed(2)} GB</Text>
            <Text style={styles.settingDescription}>
              recorded in {videoCount} library record{videoCount === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={[styles.settingDescription, { marginTop: Spacing.md }]}>
            Only media tracked by Vidora is affected.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: clearingStorage || !manager.initialized,
              busy: clearingStorage,
            }}
            disabled={clearingStorage || !manager.initialized}
            onPress={confirmClearStorage}
            style={styles.manageButton}>
            <Text style={styles.destructiveText}>
              {clearingStorage
                ? 'Clearing storage...'
                : manager.initialized
                  ? 'Delete all Vidora downloads'
                  : 'Loading downloads...'}
            </Text>
          </Pressable>
        </AppCard>

        <Text style={styles.sectionTitle}>Support</Text>
        <AppCard>
          <LinkRow title="Privacy Policy" onPress={() => showSoon('Privacy Policy')} />
          <LinkRow title="Terms and Conditions" onPress={() => showSoon('Terms and Conditions')} />
          <LinkRow title="Copyright Information" onPress={() => showSoon('Copyright Information')} />
          <LinkRow title="Contact Support" onPress={() => showSoon('Contact Support')} />
        </AppCard>

        <Text style={styles.sectionTitle}>About</Text>
        <AppCard style={styles.aboutCard}>
          <View style={styles.aboutLogo}>
            <SymbolView
              name={{ ios: 'play.rectangle.fill', android: 'play_arrow', web: 'play_arrow' }}
              size={28}
              tintColor={colors.textPrimary}
            />
          </View>
          <Text style={styles.appName}>Vidora</Text>
          <Text style={styles.settingDescription}>Application version 1.0.0</Text>
        </AppCard>

        {__DEV__ ? (
          <>
            <Text style={styles.sectionTitle}>Database Testing</Text>
            <AppCard>
              <Pressable accessibilityRole="button" onPress={addTestDownload} style={styles.manageButton}>
                <Text style={styles.manageText}>Add Test Download Record</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={addTestLibraryVideo} style={styles.manageButton}>
                <Text style={styles.manageText}>Add Test Library Record</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={clearTestRecords} style={styles.manageButton}>
                <Text style={styles.manageText}>Clear Test Records</Text>
              </Pressable>
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
