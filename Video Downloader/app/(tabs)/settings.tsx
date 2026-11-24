import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { AppColors } from '@/src/theme/colors';
import { useSettings } from '@/src/features/settings/SettingsProvider';
import { useSettingsStore } from '@/src/store/settings-store';
import { requestDownloadNotificationPermission } from '@/src/features/settings/download-notifications';

const supportArticles = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        title: 'Information stored on your device',
        body: 'Vidora stores download records, library details, file locations, and app preferences in a local database on your device. Downloaded files are saved in Vidora app storage. If you choose to save or manage media in your device library, Vidora requests the required operating-system permission.',
      },
      {
        title: 'Network requests',
        body: 'When you request backend analysis or a download, Vidora sends the submitted source URL to its configured backend. Download requests also include the selected format. Supported direct-file downloads may instead request the source from your device. Backend and source services may receive network metadata such as your IP address. Their data handling and retention are not defined by this app.',
      },
      {
        title: 'Permissions and notifications',
        body: 'Media-library access is requested when a feature needs to read, save, or manage Vidora media. Download notifications are optional and require your operating system’s permission.',
      },
      {
        title: 'Data removal',
        body: 'Removing local downloads or library items affects data managed by Vidora on your device. It cannot guarantee removal of information already received or retained by the backend or a source service.',
      },
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    sections: [
      {
        title: 'Use of downloaded content',
        body: 'Only access, download, and use content when you have the necessary rights or permission. You are responsible for following applicable laws and the terms that apply to the source website or service.',
      },
      {
        title: 'Third-party services',
        body: 'Vidora relies on third-party websites and a configured backend to process some requests. Their availability, content, and behavior may change, and Vidora does not control those services.',
      },
      {
        title: 'Availability and responsibility',
        body: 'Supported sources and formats may vary. You are responsible for the files you choose to download, where you store them, and how you use them.',
      },
    ],
  },
  copyright: {
    title: 'Copyright Information',
    sections: [
      {
        title: 'Vidora and Shuvix',
        body: '© 2026 Shuvix. All rights reserved. Vidora and Shuvix branding and original app materials are associated with Shuvix.',
      },
      {
        title: 'Third-party content',
        body: 'Third-party names, trademarks, websites, and media belong to their respective owners. Using Vidora does not grant rights to content obtained from another source.',
      },
    ],
  },
} as const;

type SupportArticleKey = keyof typeof supportArticles;

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
    sectionTitle: { ...Typography.lg, color: colors.textPrimary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    settingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    settingText: { flex: 1, paddingRight: Spacing.sm },
    settingTitle: { ...Typography.md, color: colors.textPrimary, fontWeight: '600' },
    settingDescription: { ...Typography.sm, color: colors.textSecondary, marginTop: 4 },
    linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
    pressed: { opacity: 0.7 },
    developerCard: { alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xxl },
    developerEyebrow: { color: Colors.textSecondary, fontSize: 12, letterSpacing: 2, marginBottom: Spacing.xs },
    developerLogo: { width: 100, height: 100, marginBottom: Spacing.md },
    developerName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: 1 },
    developerTagline: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
    developerDivider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: Spacing.lg },
    developerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    developerIcon: { backgroundColor: Colors.background, padding: 10, borderRadius: Radius.full, marginHorizontal: 8 },
    articleModal: { flex: 1, backgroundColor: colors.background },
    articleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    articleTitle: { ...Typography.lg, color: colors.textPrimary, fontWeight: '700' },
    articleCloseButton: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    articleContent: { padding: Spacing.md, paddingBottom: Spacing.xxxl },
    articleNotice: { ...Typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
    articleSection: { marginBottom: Spacing.lg },
    articleSectionTitle: { ...Typography.md, color: colors.textPrimary, fontWeight: '700', marginBottom: Spacing.xs },
    articleText: { ...Typography.sm, color: colors.textSecondary, lineHeight: 22 },
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
  const db = useSQLiteContext();
  const [activeSupportArticle, setActiveSupportArticle] = useState<SupportArticleKey | null>(null);

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

        <Text style={styles.sectionTitle}>Support</Text>
        <AppCard>
          <LinkRow title="Privacy Policy" onPress={() => setActiveSupportArticle('privacy')} />
          <LinkRow title="Terms and Conditions" onPress={() => setActiveSupportArticle('terms')} />
          <LinkRow title="Copyright Information" onPress={() => setActiveSupportArticle('copyright')} />
        </AppCard>

        <Text style={styles.sectionTitle}>About the Developer</Text>
        <AppCard style={styles.developerCard} variant="secondary" padding={Spacing.xl}>
          <Text style={styles.developerEyebrow}>CRAFTED BY</Text>
          <Image
            source={require('../../assets/images/shuvix-logo.png')}
            style={styles.developerLogo}
            resizeMode="contain"
            accessibilityLabel="Shuvix logo"
          />
          <Text style={styles.developerName}>SHUVIX</Text>
          <Text style={styles.developerTagline}>Building Better Digital Experiences</Text>
          <View style={styles.developerDivider} />
          <View style={styles.developerActions}>
            <View style={styles.developerIcon}>
              <Ionicons name="globe-outline" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.developerIcon}>
              <Ionicons name="logo-github" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.developerIcon}>
              <Ionicons name="mail-outline" size={20} color={colors.textPrimary} />
            </View>
          </View>
        </AppCard>
      </ScrollView>
      <Modal
        animationType="slide"
        onRequestClose={() => setActiveSupportArticle(null)}
        visible={activeSupportArticle !== null}>
        <SafeAreaView style={styles.articleModal} edges={['top', 'bottom']}>
          <View style={styles.articleHeader}>
            <Text style={styles.articleTitle}>
              {activeSupportArticle ? supportArticles[activeSupportArticle].title : ''}
            </Text>
            <Pressable
              accessibilityLabel="Close support article"
              accessibilityRole="button"
              onPress={() => setActiveSupportArticle(null)}
              style={styles.articleCloseButton}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor={colors.textPrimary}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.articleContent}>
            <Text style={styles.articleNotice}>
              Draft information for Vidora users. Review with a qualified professional before relying on it as legal advice.
            </Text>
            {activeSupportArticle
              ? supportArticles[activeSupportArticle].sections.map((section) => (
                  <View key={section.title} style={styles.articleSection}>
                    <Text style={styles.articleSectionTitle}>{section.title}</Text>
                    <Text style={styles.articleText}>{section.body}</Text>
                  </View>
                ))
              : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
