import Constants from 'expo-constants';
import { Platform } from 'react-native';

import apiClient from './apiClient';

export async function registerPushNotifications(app: 'cliente' | 'negocio' | 'repartidor') {
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    console.warn('Push remoto no disponible en Expo Go para Android. Usa development build o APK/AAB.');
    return;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  const permissions = await Notifications.getPermissionsAsync();
  const finalPermissions = permissions.granted
    ? permissions
    : await Notifications.requestPermissionsAsync();

  if (!finalPermissions.granted) {
    console.warn('Permiso de notificaciones no concedido.');
    return;
  }

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.warn('No se encontro EAS projectId para registrar push notifications.');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log('Expo push token registrado', token.data);
  await apiClient.post('/notifications/push-token', {
    token: token.data,
    app,
  });
}
