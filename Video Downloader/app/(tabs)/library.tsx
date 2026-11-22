import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { VideoCard } from '@/src/components/library/VideoCard';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { AppInput } from '@/src/components/ui/AppInput';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useLibraryVideos } from '@/src/hooks/useLibraryVideos';
import { useSQLiteContext } from 'expo-sqlite';
import { syncDeviceLibrary } from '@/src/features/library/sync-service';
import { Colors, Radius, Spacing, Typography } from '@/src/theme';
import type { LibrarySort } from '@/src/types';

const sorts: LibrarySort[] = ['Newest', 'Oldest', 'Title A-Z'];

export default function LibraryScreen() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('Newest');
  const [grid, setGrid] = useState(true);
  const { videos, loading, error, refresh, search, sort: applySort } = useLibraryVideos();
  const db = useSQLiteContext();

  useFocusEffect(useCallback(() => {
    void (async () => {
      await syncDeviceLibrary(db);
      await refresh();
    })();
  }, [db, refresh]));

  const cycleSort = () => {
    const index = sorts.indexOf(sort);
    const nextSort = sorts[(index + 1) % sorts.length];
    setSort(nextSort);
    void applySort(nextSort);
  };

  const changeSearch = (value: string) => {
    setQuery(value);
    void search(value);
  };

  const visibleVideos = videos.filter(
    (video) => !video.isDemo && Boolean(video.localUri)
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        key={grid ? 'grid' : 'list'}
        data={visibleVideos}
        numColumns={grid ? 2 : 1}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={grid ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.content,
          visibleVideos.length === 0 && styles.emptyContent,
        ]}
        ListHeaderComponent={
          <View>
            <AppHeader title="My Library" subtitle="Your saved videos in one place" />
            <AppInput
              label="Search"
              placeholder="Search downloaded videos"
              value={query}
              onChangeText={changeSearch}
              style={styles.search}
            />
            <View style={styles.toolbar}>
              <Text
                accessibilityRole="button"
                onPress={cycleSort}
                style={styles.toolbarButton}>
                Sort: {sort}
              </Text>
              <View style={styles.layoutToggle}>
                <Text
                  accessibilityRole="button"
                  accessibilityState={{ selected: grid }}
                  onPress={() => setGrid(true)}
                  style={[styles.layoutButton, grid && styles.layoutActive]}>
                  Grid
                </Text>
                <Text
                  accessibilityRole="button"
                  accessibilityState={{ selected: !grid }}
                  onPress={() => setGrid(false)}
                  style={[styles.layoutButton, !grid && styles.layoutActive]}>
                  List
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => <VideoCard video={item} compact={!grid} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.empty}>
              <EmptyState title="Database unavailable" description={error} />
            </View>
          ) : (
            <View style={styles.empty}>
              <EmptyState
                title="No videos found"
                description="Add a saved video or use the development database controls."
              />
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl },
  emptyContent: { flexGrow: 1 },
  search: { marginTop: Spacing.lg },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: Spacing.md },
  toolbarButton: { ...Typography.sm, color: Colors.textPrimary, minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, textAlignVertical: 'center' },
  layoutToggle: { flexDirection: 'row', borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 3 },
  layoutButton: { ...Typography.xs, color: Colors.textSecondary, minWidth: 48, height: 36, textAlign: 'center', textAlignVertical: 'center', borderRadius: Radius.full },
  layoutActive: { backgroundColor: Colors.primary, color: Colors.textPrimary, fontWeight: '700' },
  columnWrapper: { justifyContent: 'space-between' },
  empty: { width: '100%', minHeight: 300 },
});
