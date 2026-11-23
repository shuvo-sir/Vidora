import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { AudioMiniPlayer } from '@/src/components/audio/AudioMiniPlayer';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export default function TabLayout() {
  const { colors } = useSettings();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            height: 72,
            paddingTop: 8,
            paddingBottom: 8,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: 'Downloads',
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={{ ios: 'arrow.down.circle.fill', android: 'download', web: 'download' }} tintColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={{ ios: 'play.square.stack.fill', android: 'video_library', web: 'video_library' }} tintColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen name="two" options={{ href: null }} />
      </Tabs>
      <AudioMiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
