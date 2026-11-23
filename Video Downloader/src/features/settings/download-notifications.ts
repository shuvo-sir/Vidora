import { Platform } from 'react-native';
import { AndroidImportance } from 'expo-notifications';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestDownloadNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Downloads',
      importance: AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function notifyDownloadCompleted(
  downloadId: string,
  title: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Download complete',
      body: title,
      data: { downloadId },
      ...(Platform.OS === 'android' ? { channelId: 'downloads' } : {}),
    },
    trigger: null,
  });
}
