import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';

/**
 * Hook to get unread notification count for tab badge
 */
export const useNotificationBadge = (): number => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Listen to notifications in real-time
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      (error) => {
        console.error('Error listening to notifications:', error);
        setUnreadCount(0);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return unreadCount;
};
