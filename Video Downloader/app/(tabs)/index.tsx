import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import * as Linking from 'expo-linking';

import { VideoPreview } from '@/src/components/downloader/VideoPreview';
import { AppButton } from '@/src/components/ui/AppButton';
import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { AppInput } from '@/src/components/ui/AppInput';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import { useVideoAnalysis } from '@/src/hooks/useVideoAnalysis';
import { useDownloadManager } from '@/src/hooks/useDownloadManager';
import type { DownloadFormat } from '@/src/features/downloader/downloader-types';
export default function HomeScreen() {
  const analysis = useVideoAnalysis();
  const downloads = useDownloadManager();
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('mp4');

  const pasteUrl = async () => {
    const value = await Clipboard.getStringAsync();
    analysis.setInputUrl(value);
    setDownloadFormat('mp4');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader
          title="Vidora"
          subtitle="Welcome to your offline library"
          rightSlot={
            <View style={styles.logo}>
              <SymbolView name={{ ios: 'play.rectangle.fill', android: 'play_arrow', web: 'play_arrow' }} size={22} tintColor={Colors.textPrimary} />
            </View>
          }
        />

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>VIDEO DOWNLOADER</Text>
          <Text style={styles.heroTitle}>Download your favorite videos</Text>
          <Text style={styles.heroDescription}>Save authorized content for offline viewing in a clean, private experience.</Text>
        </View>

        <AppCard variant="secondary" padding={Spacing.md}>
          <AppInput
            label="Video URL"
            placeholder="https://example.com/video.mp4"
            value={analysis.inputUrl}
            onChangeText={(value) => {
              analysis.setInputUrl(value);
            }}
            keyboardType="url"
            accessibilityLabel="Video URL"
            errorMessage={
              analysis.result?.status === 'failed' &&
              ['empty', 'malformed', 'unsafe_scheme', 'credentials', 'localhost', 'private_host', 'ip_literal', 'unsupported_port'].includes(
                analysis.result.errorCode ?? ''
              )
                ? analysis.result.message
                : undefined
            }
            helperText={
              analysis.result?.status === 'supported'
                ? 'Valid direct-file or social-media source detected.'
                : 'Only download content you own or have permission to save.'
            }
          />
          <View style={styles.inputActions}>
            <AppButton title="Paste" onPress={pasteUrl} variant="outline" size="sm" style={styles.actionButton} />
            <AppButton title="Clear" onPress={() => { setDownloadFormat('mp4'); analysis.reset(); }} variant="ghost" size="sm" style={styles.actionButton} />
            {analysis.loading ? (
              <AppButton title="Cancel" onPress={analysis.cancel} variant="outline" size="sm" style={styles.analyzeButton} />
            ) : (
              <AppButton title="Analyze" onPress={() => void analysis.analyze()} variant="primary" size="sm" style={styles.analyzeButton} />
            )}
          </View>
        </AppCard>

        {analysis.loading ? (
          <View style={styles.analysisState}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.analysisText}>Analyzing authorized video URL...</Text>
          </View>
        ) : analysis.result ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analysis result</Text>
            {analysis.result.status === 'unsupported' ||
             (analysis.result.status === 'failed' &&
              ['youtube', 'facebook'].includes(
                analysis.result.sourceCategory ?? ''
              )) ? (
              <AppCard>
                <Text style={styles.sourceTitle}>Source not supported</Text>
                <Text style={styles.sourceMessage}>
                  {analysis.result.message}
                </Text>
                {analysis.result.sourceCategory &&
                  ['youtube', 'facebook', 'instagram', 'tiktok'].includes(
                    analysis.result.sourceCategory
                  ) ? (
                  <AppButton
                    title={`Open in ${
                      analysis.result.sourceCategory === 'youtube'
                        ? 'YouTube'
                        : analysis.result.sourceCategory === 'facebook'
                          ? 'Facebook'
                          : analysis.result.sourceCategory === 'instagram'
                            ? 'Instagram'
                            : 'TikTok'
                    }`}
                    onPress={() => void Linking.openURL(analysis.inputUrl)}
                    variant="outline"
                    size="sm"
                    style={styles.openSocialButton}
                  />
                ) : null}
              </AppCard>
            ) : (
              <VideoPreview
                result={analysis.result}
                selectedFormat={downloadFormat}
                onFormatChange={setDownloadFormat}
                onDownload={async () => {
                  const currentResult = analysis.result;
                  if (!currentResult) return;
                  if (
                    currentResult.socialFormats &&
                    (
                      currentResult.sourceCategory === 'youtube' ||
                      currentResult.sourceCategory === 'facebook'
                    )
                  ) {
                    const operation = downloads.startSocial(
                      currentResult,
                      analysis.inputUrl,
                      'best',
                      downloadFormat === 'mp3' ? 'mp3' : 'mp4'
                    );
                    if (operation) await operation.then((result) => {
                      if (result?.ok) void downloads.refresh();
                      else if (result) {
                        Alert.alert('Download could not start', result.message);
                      }
                    });
                    return;
                  }
                  const operation = downloads.start(
                    currentResult,
                    analysis.inputUrl,
                    downloadFormat
                  );
                  if (operation) await operation.then((result) => {
                    if (result?.ok) void downloads.refresh();
                    else if (result) {
                      Alert.alert('Download could not start', result.message);
                    }
                  });
                }}
              />
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supported formats</Text>
          <AppCard>
            <View style={styles.formatRow}>
              {['MP4', 'M4V', 'MOV', 'WEBM'].map((format) => (
                <View key={format} style={styles.formatChip}>
                  <Text style={styles.formatText}>{format}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.sourceNote}>
              Direct-file downloads depend on source authorization. This app does not claim unrestricted support for every website or service.
            </Text>
          </AppCard>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  logo: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: Spacing.lg, marginBottom: Spacing.md, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  eyebrow: { ...Typography.xs, color: Colors.secondary, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { ...Typography.display, color: Colors.textPrimary, marginTop: Spacing.sm, maxWidth: 340 },
  heroDescription: { ...Typography.md, color: Colors.textSecondary, marginTop: Spacing.sm },
  inputActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionButton: { flex: 1 },
  analyzeButton: { flex: 1.4 },
  analysisState: {
    minHeight: 72,
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  analysisText: {
    ...Typography.sm,
    color: Colors.textSecondary,
  },
  section: { marginTop: Spacing.lg },
  sectionTitle: { ...Typography.lg, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  formatChip: { height: 34, borderRadius: Radius.full, backgroundColor: Colors.surfaceSecondary, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  formatText: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '700' },
  sourceNote: { ...Typography.sm, color: Colors.textSecondary, marginTop: Spacing.md, lineHeight: 20 },
  recentCard: { marginBottom: Spacing.sm, minHeight: 52, justifyContent: 'center' },
  recentTitle: { ...Typography.sm, color: Colors.textPrimary, fontWeight: '600' },
  sourceTitle: { ...Typography.lg, color: Colors.textPrimary, fontWeight: '700' },
  sourceMessage: { ...Typography.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
  openSocialButton: { marginTop: Spacing.md },
});
