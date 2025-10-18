import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import {
  createTestNotifications,
  deleteAllNotifications,
  markAllAsRead,
  registerForPushNotifications,
  savePushToken,
} from '../../services/notificationService';

interface NotificationItem {
  id: string;
  type: 'new_report' | 'comment' | 'upvote' | 'nearby_alert' | 'status_change';
  title: string;
  message: string;
  reportId?: string;
  read: boolean;
  createdAt: Timestamp;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setupPushNotifications();

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: NotificationItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          notifs.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt || Timestamp.now(),
          } as NotificationItem);
        });
        setNotifications(notifs);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error loading notifications:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const setupPushNotifications = async () => {
    if (!user) return;

    try {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(user.uid, token);
      }
    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (user) {
              await deleteAllNotifications(user.uid);
              Alert.alert('Success', 'All notifications cleared');
            }
          },
        },
      ]
    );
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllAsRead(user.uid);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleCreateTestNotifications = async () => {
    if (!user) return;
    await createTestNotifications(user.uid);
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    if (notification.reportId) {
      router.push(`/report/${notification.reportId}`);
    }
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'new_report':
        return 'alert-circle';
      case 'comment':
        return 'chatbubble';
      case 'upvote':
        return 'arrow-up-circle';
      case 'nearby_alert':
        return 'location';
      case 'status_change':
        return 'checkmark-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: NotificationItem['type']) => {
    switch (type) {
      case 'new_report':
        return '#FF3B30';
      case 'comment':
        return '#007AFF';
      case 'upvote':
        return '#34C759';
      case 'nearby_alert':
        return '#FF9500';
      case 'status_change':
        return '#5856D6';
      default:
        return '#007AFF';
    }
  };

  const getRelativeTime = (timestamp: Timestamp): string => {
    const now = new Date();
    const date = timestamp.toDate();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Emergency Services Section */}
      {/* <View style={styles.emergencySection}>
        <Text style={styles.emergencySectionTitle}>🚨 Emergency Services</Text>
        <Text style={styles.emergencySectionSubtitle}>
          Quick access to emergency contacts
        </Text>

        {emergencyNumbers.map((contact, index) => (
          <TouchableOpacity
            key={index}
            style={styles.emergencyCard}
            onPress={() => handleEmergencyCall(contact)}
          >
            <View
              style={[
                styles.emergencyIcon,
                index === 0 && styles.emergencyIconPrimary,
              ]}
            >
              <Ionicons
                name={index === 0 ? 'call' : 'call-outline'}
                size={24}
                color={index === 0 ? '#fff' : '#FF3B30'}
              />
            </View>
            <View style={styles.emergencyContent}>
              <Text style={styles.emergencyName}>{contact.name}</Text>
              <Text style={styles.emergencyDescription}>
                {contact.description}
              </Text>
            </View>
            <View style={styles.emergencyNumber}>
              <Text style={styles.emergencyNumberText}>{contact.number}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View> */}

      {/* Notifications Section */}
      <View style={styles.notificationsSection}>
        <View style={styles.notificationsSectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Notifications ({notifications.length})
            </Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadCount}>
                {unreadCount} unread
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markReadButton}
                onPress={handleMarkAllRead}
              >
                <Ionicons name="checkmark-done" size={18} color="#007AFF" />
              </TouchableOpacity>
            )}
            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearAll}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Test Notifications Button (Dev Only) */}
        {__DEV__ && notifications.length === 0 && !loading && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleCreateTestNotifications}
          >
            <Ionicons name="flask" size={20} color="#007AFF" />
            <Text style={styles.testButtonText}>Create Test Notifications</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No notifications</Text>
            <Text style={styles.emptyStateSubtext}>
              You'll see alerts about nearby incidents here
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View
                  style={[
                    styles.notificationIcon,
                    {
                      backgroundColor: getNotificationColor(notification.type),
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(notification.type) as any}
                    size={20}
                    color="#fff"
                  />
                </View>

                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {getRelativeTime(notification.createdAt)}
                  </Text>
                </View>

                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Settings Quick Access */}
      <TouchableOpacity
        style={styles.settingsCard}
        onPress={() => router.push('/(tabs)/profile')}
      >
        <View style={styles.settingsLeft}>
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
          <View>
            <Text style={styles.settingsTitle}>Notification Settings</Text>
            <Text style={styles.settingsSubtitle}>
              Manage your alert preferences
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 40,
  },
  emergencySection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  emergencySectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  emergencySectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyIconPrimary: {
    backgroundColor: '#FF3B30',
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  emergencyDescription: {
    fontSize: 12,
    color: '#666',
  },
  emergencyNumber: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emergencyNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  notificationsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  notificationsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  unreadCount: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  markReadButton: {
    padding: 8,
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
  },
  clearButton: {
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E8F4FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  notificationCardUnread: {
    backgroundColor: '#E8F4FF',
    borderColor: '#007AFF',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  settingsSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});