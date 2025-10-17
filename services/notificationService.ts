import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from "expo-notifications";
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { Alert, Linking, Platform } from 'react-native';
import { db } from '../firebase/config';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================
// PUSH NOTIFICATION SETUP
// ============================================

// export interface NotificationData {
//   type: 'new_report' | 'comment' | 'upvote' | 'status_change' | 'nearby_alert';
//   reportId?: string;
//   title: string;
//   body: string;
//   data?: Record<string, any>;
// }

/**
 * Register device for push notifications
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      Alert.alert('Error', 'Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Error', 'Failed to get push notification permissions');
      return null;
    }

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.warn('No project ID found');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push token:', token.data);

    // Configure notification channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        lightColor: '#FF0000',
        sound: 'default',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Save push token to user's Firestore document
 */
export const savePushToken = async (userId: string, token: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pushTokens: arrayUnion(token),
    });
    console.log('Push token saved to Firestore');
  } catch (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
};

/**
 * Send local notification (for testing or immediate alerts)
 */
export const sendLocalNotification = async (
  data: NotificationData
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.body,
        data: data.data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
};

/**
 * Schedule notification for later
 */


type NotificationData = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

export const scheduleNotification = async (
  data: NotificationData,
  triggerDate: Date
): Promise<string> => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: data.title,
        body: data.body,
        data: data.data || {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE, // ✅ required now
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    throw error;
  }
};

/**
 * Cancel scheduled notification
 */
export const cancelNotification = async (
  notificationId: string
): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async () => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
};

/**
 * Set notification badge count
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};

// ============================================
// EMERGENCY SERVICES
// ============================================

export interface EmergencyContact {
  name: string;
  number: string;
  description: string;
}

/**
 * Get emergency numbers by country/region
 */
export const getEmergencyNumbers = (): EmergencyContact[] => {
  // You can make this dynamic based on user location
  return [
    {
      name: 'Emergency Services',
      number: '999', // UK
      description: 'Police, Fire, Ambulance',
    },
    {
      name: 'Police',
      number: '101', // UK Non-Emergency
      description: 'Non-emergency police line',
    },
    {
      name: 'NHS 111',
      number: '111', // UK
      description: 'Medical advice',
    },
  ];
};

/**
 * Call emergency services
 */
export const callEmergency = async (number: string): Promise<void> => {
  try {
    const url = `tel:${number}`;
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      Alert.alert(
        'Call Emergency Services',
        `Are you sure you want to call ${number}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call',
            style: 'destructive',
            onPress: () => Linking.openURL(url),
          },
        ]
      );
    } else {
      Alert.alert('Error', 'Cannot make phone calls on this device');
    }
  } catch (error) {
    console.error('Error making emergency call:', error);
    Alert.alert('Error', 'Failed to initiate call');
  }
};

/**
 * Open navigation to location
 */
export const navigateToLocation = async (
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> => {
  try {
    const destination = `${latitude},${longitude}`;
    const googleMapsUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
      android: `google.navigation:q=${destination}`,
    });
    
    const appleMapsUrl = `http://maps.apple.com/?daddr=${destination}&dirflg=d`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    // Try Google Maps first
    if (googleMapsUrl && await Linking.canOpenURL(googleMapsUrl)) {
      await Linking.openURL(googleMapsUrl);
    }
    // Try Apple Maps on iOS
    else if (Platform.OS === 'ios' && await Linking.canOpenURL(appleMapsUrl)) {
      await Linking.openURL(appleMapsUrl);
    }
    // Fallback to web browser
    else {
      await Linking.openURL(fallbackUrl);
    }
  } catch (error) {
    console.error('Error opening navigation:', error);
    Alert.alert('Error', 'Failed to open navigation app');
  }
};
