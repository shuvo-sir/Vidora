import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import { createDownload, clearDemoDownloads } from '@/src/features/downloads/download-repository';
import { clearDemoVideos, createVideo, getTotalLibrarySize, getVideoCount } from '@/src/features/library/library-repository';
import { createId } from '@/src/utils/create-id';

function SettingRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.textPrimary}
      />
    </View>
  );
}

function LinkRow({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
      <Text style={styles.settingTitle}>{title}</Text>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={Colors.textSecondary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [darkTheme, setDarkTheme] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const db = useSQLiteContext();
  const [videoCount, setVideoCount] = useState(0);
  const [librarySize, setLibrarySize] = useState(0);

  const refreshStats = useCallback(async () => {
    try {
      setVideoCount(await getVideoCount(db));
      setLibrarySize(await getTotalLibrarySize(db));
    } catch (caught) {
      Alert.alert(
        'Database unavailable',
        caught instanceof Error ? caught.message : 'Unable to read local database statistics.'
      );
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    void refreshStats();
  }, [refreshStats]));

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
      await refreshStats();
      Alert.alert('Test records cleared', 'Only DEMO records were removed.');
    } catch (caught) {
      Alert.alert('Unable to clear test records', caught instanceof Error ? caught.message : 'Unknown database error.');
    }
  };
  const showSoon = (title: string) =>
    Alert.alert(title, 'This demonstration preference or action is coming in a future phase.');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Settings" subtitle="Personalize your Vidora experience" />

        <Text style={styles.sectionTitle}>General</Text>
        <AppCard>
          <SettingRow title="Premium dark theme" description="Local demonstration preference" value={darkTheme} onValueChange={setDarkTheme} />
          <SettingRow title="Wi-Fi only downloads" description="Future download preference" value={wifiOnly} onValueChange={setWifiOnly} />
          <SettingRow title="Download notifications" description="Future notification preference" value={notifications} onValueChange={setNotifications} />
        </AppCard>

        <Text style={styles.sectionTitle}>Storage</Text>
        <AppCard>
          <View style={styles.storageTop}>
            <Text style={styles.storageValue}>{(librarySize / 1_000_000_000).toFixed(2)} GB</Text>
            <Text style={styles.settingDescription}>recorded in {videoCount} library record{videoCount === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.storageTrack}>
            <View style={styles.storageFill} />
          </View>
          <Text style={styles.settingDescription}>Download location: Device storage / Vidora</Text>
          <Pressable accessibilityRole="button" onPress={() => showSoon('Manage storage')} style={styles.manageButton}>
            <Text style={styles.manageText}>Manage storage</Text>
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
            <SymbolView name={{ ios: 'play.rectangle.fill', android: 'play_arrow', web: 'play_arrow' }} size={28} tintColor={Colors.textPrimary} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  sectionTitle: { ...Typography.lg, color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  settingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingText: { flex: 1, paddingRight: Spacing.sm },
  settingTitle: { ...Typography.md, color: Colors.textPrimary, fontWeight: '600' },
  settingDescription: { ...Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  storageTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  storageValue: { ...Typography.xxl, color: Colors.textPrimary, fontWeight: '700' },
  storageTrack: { height: 8, marginVertical: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  storageFill: { width: '24%', height: '100%', backgroundColor: Colors.primary },
  manageButton: { height: 44, borderRadius: Radius.md, backgroundColor: Colors.surfaceSecondary, marginTop: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  manageText: { ...Typography.sm, color: Colors.primary, fontWeight: '700' },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Colors.border },
  pressed: { opacity: 0.7 },
  aboutCard: { alignItems: 'center' },
  aboutLogo: { width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  appName: { ...Typography.xl, color: Colors.textPrimary, marginTop: Spacing.sm, fontWeight: '700' },
});
