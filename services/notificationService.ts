import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { Alert, Linking, Platform } from 'react-native';
import { db } from '../firebase/config';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

// ============================================
// TYPES
// ============================================

export interface NotificationData {
  type: 'new_report' | 'comment' | 'upvote' | 'status_change' | 'nearby_alert';
  reportId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface EmergencyContact {
  name: string;
  number: string;
  description: string;
}

// ============================================
// PUSH NOTIFICATION SETUP
// ============================================

export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    // For Expo Go, this will work. For standalone, need project ID
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                       Constants.easConfig?.projectId;
      
      const tokenData = projectId 
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
        
      console.log('Push token:', tokenData.data);

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

      return tokenData.data;
    } catch (tokenError) {
      console.log('Error getting push token:', tokenError);
      return null;
    }
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

export const savePushToken = async (userId: string, token: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pushTokens: arrayUnion(token),
      lastTokenUpdate: serverTimestamp(),
    });
    console.log('Push token saved to Firestore');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};

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
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
};

export const clearAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
};

// ============================================
// NOTIFICATION MANAGEMENT IN FIRESTORE
// ============================================

/**
 * Create a notification document in Firestore
 */
export const createNotification = async (
  userId: string,
  type: NotificationData['type'],
  title: string,
  message: string,
  reportId?: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      reportId: reportId || null,
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log('Notification created in Firestore');
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    console.log('All notifications marked as read');
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
};

/**
 * Delete all notifications for a user
 */
export const deleteAllNotifications = async (userId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('All notifications deleted');
  } catch (error) {
    console.error('Error deleting notifications:', error);
  }
};

/**
 * Create test notifications (for development)
 */
export const createTestNotifications = async (userId: string): Promise<void> => {
  try {
    const testNotifications = [
      {
        type: 'nearby_alert' as const,
        title: 'Crime Report Nearby',
        message: 'Suspicious activity reported 0.8km from your location',
        reportId: 'test-report-1',
      },
      {
        type: 'comment' as const,
        title: 'New Comment',
        message: 'Someone commented on your Lost Item report',
        reportId: 'test-report-2',
      },
      {
        type: 'upvote' as const,
        title: 'Report Upvoted',
        message: 'Your report received 5 upvotes',
        reportId: 'test-report-3',
      },
      {
        type: 'status_change' as const,
        title: 'Report Resolved',
        message: 'A report you are tracking has been marked as resolved',
        reportId: 'test-report-4',
      },
      {
        type: 'new_report' as const,
        title: 'Missing Pet Alert',
        message: 'Lost dog reported near High Street - Golden Retriever',
        reportId: 'test-report-5',
      },
    ];

    for (const notif of testNotifications) {
      await createNotification(
        userId,
        notif.type,
        notif.title,
        notif.message,
        notif.reportId
      );
    }

    Alert.alert('Success', 'Test notifications created!');
  } catch (error) {
    console.error('Error creating test notifications:', error);
    Alert.alert('Error', 'Failed to create test notifications');
  }
};

// ============================================
// EMERGENCY SERVICES
// ============================================

export const getEmergencyNumbers = (): EmergencyContact[] => {
  // UK emergency numbers - customize based on user location
  return [
    {
      name: 'Emergency Services',
      number: '999',
      description: 'Police, Fire, Ambulance',
    },
    {
      name: 'Police Non-Emergency',
      number: '101',
      description: 'Report non-urgent crime',
    },
    {
      name: 'NHS 111',
      number: '111',
      description: 'Medical advice and support',
    },
  ];
};

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

    if (googleMapsUrl && await Linking.canOpenURL(googleMapsUrl)) {
      await Linking.openURL(googleMapsUrl);
    } else if (Platform.OS === 'ios' && await Linking.canOpenURL(appleMapsUrl)) {
      await Linking.openURL(appleMapsUrl);
    } else {
      await Linking.openURL(fallbackUrl);
    }
  } catch (error) {
    console.error('Error opening navigation:', error);
    Alert.alert('Error', 'Failed to open navigation app');
  }
};