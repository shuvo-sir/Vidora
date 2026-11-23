import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DownloadItem } from '@/src/components/downloads/DownloadItem';
import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useDownloadManager } from '@/src/hooks/useDownloadManager';
import { Radius, Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';
import type { AppColors } from '@/src/theme/colors';
import type { DownloadFilter } from '@/src/types';

const filters: DownloadFilter[] = [
  'All',
  'Active',
  'Completed',
  'Failed',
];

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
    filters: { flexDirection: 'row', marginVertical: Spacing.lg, gap: Spacing.xs },
    filter: {
      flex: 1,
      height: 40,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      textAlign: 'center',
      textAlignVertical: 'center',
      ...Typography.sm,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.textPrimary, fontWeight: '700' },
    stateContainer: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
    secondaryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
    secondaryAction: { ...Typography.xs, color: colors.textSecondary, minHeight: 32, paddingHorizontal: Spacing.sm, textAlignVertical: 'center' },
  });
}

export default function DownloadsScreen() {
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<DownloadFilter>('All');
  const manager = useDownloadManager();
  const { pause, resume, retry, cancel, remove } = manager;
  const handlePause = useCallback((id: string) => void pause(id), [pause]);
  const handleResume = useCallback((id: string) => void resume(id), [resume]);
  const handleRetry = useCallback((id: string) => void retry(id), [retry]);
  const handleCancel = useCallback((id: string) => void cancel(id), [cancel]);
  const handleRemove = useCallback((id: string) => void remove(id), [remove]);
  const handleOpen = useCallback(
    (id: string) => router.push({ pathname: '/video/[id]', params: { id } }),
    []
  );
  const records = useMemo(() => manager.downloads.filter((item) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return item.status === 'downloading';
    if (filter === 'Completed') return item.status === 'completed';
    if (filter === 'Failed') return item.status === 'failed';
    return false;
  }), [manager.downloads, filter]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader title="Downloads" subtitle="Manage your video downloads" />
        <View style={styles.filters}>
          {filters.map((item) => (
            <Text
              key={item}
              onPress={() => setFilter(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item }}
              style={[styles.filter, filter === item && styles.filterActive]}>
              {item}
            </Text>
          ))}
        </View>
        {manager.loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : manager.error ? (
          <AppCard>
            <EmptyState title="Database unavailable" description={manager.error} />
          </AppCard>
        ) : records.length ? (
          records.map((item) => (
            <View key={item.id}>
              <DownloadItem
                item={item}
                progressPercent={manager.progressById[item.id]?.progressPercent}
                bytesPerSecond={manager.progressById[item.id]?.bytesPerSecond}
                statusMessage={manager.statusMessageById[item.id]}
                onPause={handlePause}
                onResume={handleResume}
                onRetry={handleRetry}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onDelete={handleRemove}
                onOpen={handleOpen}
              />
              {(item.status === 'queued' || item.status === 'paused' || item.status === 'failed' || item.status === 'cancelled') ? (
                <View style={styles.secondaryActions}>
                  {item.status === 'failed' ? (
                    <Text accessibilityRole="button" onPress={() => handleRetry(item.id)} style={styles.secondaryAction}>Retry</Text>
                  ) : null}
                  {item.status !== 'cancelled' ? (
                    <Text accessibilityRole="button" onPress={() => handleCancel(item.id)} style={styles.secondaryAction}>Cancel</Text>
                  ) : null}
                  <Text accessibilityRole="button" onPress={() => handleRemove(item.id)} style={styles.secondaryAction}>Remove history</Text>
                </View>
              ) : item.status === 'downloading' ? (
                <View style={styles.secondaryActions}>
                  <Text accessibilityRole="button" onPress={() => handleCancel(item.id)} style={styles.secondaryAction}>Cancel</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <AppCard>
            <EmptyState
              title="No matching downloads"
              description="There are no demonstration records in this category."
            />
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
