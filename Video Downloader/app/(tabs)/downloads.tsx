import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { DownloadItem } from '@/src/components/downloads/DownloadItem';
import { AppCard } from '@/src/components/ui/AppCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useDownloadManager } from '@/src/hooks/useDownloadManager';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { DownloadFilter } from '@/src/types';

const filters: DownloadFilter[] = [
  'All',
  'Active',
  'Completed',
  'Failed',
];

export default function DownloadsScreen() {
  const [filter, setFilter] = useState<DownloadFilter>('All');
  const manager = useDownloadManager();

  useFocusEffect(useCallback(() => {
    void manager.refresh();
  }, [manager.refresh]));

  const records = manager.downloads.filter((item) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return item.status === 'downloading';
    if (filter === 'Completed') return item.status === 'completed';
    if (filter === 'Failed') return item.status === 'failed';
    return false;
  });

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
            <ActivityIndicator size="large" color={Colors.primary} />
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
                onPause={() => void manager.pause(item.id)}
                onResume={() => void manager.resume(item.id)}
                onRetry={() => void manager.retry(item.id)}
                onCancel={() => void manager.cancel(item.id)}
                onRemove={() => void manager.remove(item.id)}
                onDelete={() => void manager.remove(item.id)}
                onOpen={() => router.push({ pathname: '/video/[id]', params: { id: item.id } })}
              />
              {(item.status === 'queued' || item.status === 'paused' || item.status === 'failed' || item.status === 'cancelled') ? (
                <View style={styles.secondaryActions}>
                  {item.status === 'failed' ? (
                    <Text accessibilityRole="button" onPress={() => void manager.retry(item.id)} style={styles.secondaryAction}>Retry</Text>
                  ) : null}
                  {item.status !== 'cancelled' ? (
                    <Text accessibilityRole="button" onPress={() => void manager.cancel(item.id)} style={styles.secondaryAction}>Cancel</Text>
                  ) : null}
                  <Text accessibilityRole="button" onPress={() => void manager.remove(item.id)} style={styles.secondaryAction}>Remove history</Text>
                </View>
              ) : item.status === 'downloading' ? (
                <View style={styles.secondaryActions}>
                  <Text accessibilityRole="button" onPress={() => void manager.cancel(item.id)} style={styles.secondaryAction}>Cancel</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  filters: { flexDirection: 'row', marginVertical: Spacing.lg, gap: Spacing.xs },
  filter: {
    flex: 1,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...Typography.sm,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary, color: Colors.textPrimary, fontWeight: '700' },
  stateContainer: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  secondaryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  secondaryAction: { ...Typography.xs, color: Colors.textSecondary, minHeight: 32, paddingHorizontal: Spacing.sm, textAlignVertical: 'center' },
});
