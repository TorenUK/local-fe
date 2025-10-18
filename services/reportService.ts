import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  GeoPoint,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { geohashForLocation, geohashQueryBounds } from 'geofire-common';
import { db } from '../firebase/config';
import { CreateCommentData } from './commentService';
import { createNotification } from './notificationService';

// ============================================
// TYPES
// ============================================

export type ReportType = 'crime' | 'lost_item' | 'missing_pet' | 'hazard';
export type ReportStatus = 'open' | 'resolved';

export interface ReportLocation {
  latitude: number;
  longitude: number;
  geohash: string;
  geopoint: GeoPoint;
}

export interface ReportMetadata {
  lost_item?: {
    itemType: string;
    color?: string;
    brand?: string;
  };
  missing_pet?: {
    species: string;
    breed?: string;
    color?: string;
  };
  crime?: {
    category: string;
    severity?: 'low' | 'medium' | 'high';
  };
  hazard?: {
    type: string;
    level?: 'warning' | 'danger' | 'critical';
  };
}

export interface Report {
  id: string;
  type: ReportType;
  userId: string | null;
  description: string;
  location: ReportLocation;
  radius: number;
  photos: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: ReportStatus;
  upvotes: number;
  commentCount: number;
  metadata?: ReportMetadata;
  isAnonymous?: boolean;
}

export interface CreateReportData {
  type: ReportType;
  description: string;
  latitude: number;
  longitude: number;
  radius?: number;
  photos?: string[];
  metadata?: ReportMetadata;
  isAnonymous?: boolean;
}

export interface UpdateReportData {
  description?: string;
  status?: ReportStatus;
  photos?: string[];
  metadata?: ReportMetadata;
}

// ============================================
// CREATE REPORT
// ============================================

export const createReport = async (
  userId: string | null,
  data: CreateReportData
): Promise<string> => {
  try {
    const geohash = geohashForLocation([data.latitude, data.longitude]);

    const reportData = {
      type: data.type,
      userId: data.isAnonymous ? null : userId,
      description: data.description,
      location: {
        geohash,
        geopoint: new GeoPoint(data.latitude, data.longitude),
        latitude: data.latitude,
        longitude: data.longitude,
      },
      radius: data.radius || 1000,
      photos: data.photos || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'open' as ReportStatus,
      upvotes: 0,
      commentCount: 0,
      metadata: data.metadata || {},
      isAnonymous: data.isAnonymous || false,
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);

    // Update user's createdReports array if not anonymous
    if (userId && !data.isAnonymous) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        createdReports: arrayUnion(docRef.id),
      });

      // Create notification for the user who created the report
      await createNotification(
        userId,
        'new_report',
        '✅ Report Created',
        `Your ${getTypeLabel(data.type)} has been published`,
        docRef.id
      );
    }

    // Notify nearby users
    await notifyNearbyUsers(docRef.id, data.type, data.latitude, data.longitude, data.description);

    console.log('Report created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

/**
 * Notify users near a new report
 */
async function notifyNearbyUsers(
  reportId: string,
  reportType: ReportType,
  latitude: number,
  longitude: number,
  description: string
): Promise<void> {
  try {
    // Get all users with notifications enabled
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('settings.notificationsEnabled', '==', true)
      )
    );

    const notificationPromises: Promise<void>[] = [];

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const alertRadius = userData.settings?.alertRadius || 5; // km

      // In a real app, you'd check user's actual location
      // For now, we'll notify all users (you can add distance check later)
      
      const typeLabel = getTypeLabel(reportType);
      const emoji = getTypeEmoji(reportType);

      notificationPromises.push(
        createNotification(
          userId,
          'nearby_alert',
          `${emoji} ${typeLabel} Nearby`,
          description.substring(0, 100),
          reportId
        )
      );
    });

    await Promise.all(notificationPromises);
    console.log(`Notified ${notificationPromises.length} nearby users`);
  } catch (error) {
    console.error('Error notifying nearby users:', error);
  }
}

function getTypeLabel(type: ReportType): string {
  const labels = {
    crime: 'Crime Report',
    lost_item: 'Lost Item',
    missing_pet: 'Missing Pet',
    hazard: 'Hazard Alert',
  };
  return labels[type] || 'Report';
}

function getTypeEmoji(type: ReportType): string {
  const emojis = {
    crime: '🚨',
    lost_item: '🔍',
    missing_pet: '🐕',
    hazard: '⚠️',
  };
  return emojis[type] || '📢';
}

// ============================================
// services/commentsService.ts - UPDATE createComment
// ============================================

/**
 * Enhanced createComment with automatic notifications
 */
export const createComment = async (data: CreateCommentData): Promise<string> => {
  try {
    const commentData = {
      reportId: data.reportId,
      userId: data.userId,
      content: data.content,
      createdAt: serverTimestamp(),
      flagged: false,
    };

    const docRef = await addDoc(collection(db, 'comments'), commentData);

    // Increment comment count on report
    const reportRef = doc(db, 'reports', data.reportId);
    await updateDoc(reportRef, {
      commentCount: increment(1),
    });

    // Get the report to find who to notify
    const reportSnap = await getDoc(reportRef);
    if (reportSnap.exists()) {
      const reportData = reportSnap.data();

      // Notify report creator (if not the commenter)
      if (reportData.userId && reportData.userId !== data.userId) {
        await createNotification(
          reportData.userId,
          'comment',
          '💬 New Comment',
          `Someone commented: "${data.content.substring(0, 80)}..."`,
          data.reportId
        );
      }

      // Notify users tracking this report
      await notifyTrackingUsers(data.reportId, data.userId, data.content);
    }

    console.log('Comment created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

/**
 * Notify users tracking a report
 */
async function notifyTrackingUsers(
  reportId: string,
  commenterId: string,
  content: string
): Promise<void> {
  try {
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('trackedReports', 'array-contains', reportId)
      )
    );

    const notificationPromises: Promise<void>[] = [];

    usersSnapshot.forEach((userDoc) => {
      const userId = userDoc.id;
      
      // Don't notify the person who commented
      if (userId !== commenterId) {
        notificationPromises.push(
          createNotification(
            userId,
            'comment',
            '💬 New Comment',
            `Someone commented on a tracked report: "${content.substring(0, 80)}..."`,
            reportId
          )
        );
      }
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notifying tracking users:', error);
  }
}

// ============================================
// Update upvoteReport to notify
// ============================================

export const upvoteReport = async (reportId: string, voterId: string): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    
    if (!reportSnap.exists()) {
      throw new Error('Report not found');
    }

    const reportData = reportSnap.data();

    await updateDoc(reportRef, {
      upvotes: increment(1),
    });

    // Notify report creator (if not the voter)
    if (reportData.userId && reportData.userId !== voterId) {
      await createNotification(
        reportData.userId,
        'upvote',
        '👍 New Upvote',
        'Someone upvoted your report',
        reportId
      );
    }
  } catch (error) {
    console.error('Error upvoting report:', error);
    throw error;
  }
};

export const deleteReport = async (
  reportId: string,
  userId: string
): Promise<void> => {
  try {
    // Delete the report document
    const reportRef = doc(db, 'reports', reportId);
    await deleteDoc(reportRef);

    // Remove from user's createdReports array
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      createdReports: arrayRemove(reportId),
    });

    console.log('Report deleted successfully');
  } catch (error) {
    console.error('Error deleting report:', error);
    throw error;
  }
};

export const getUserReports = async (userId: string): Promise<Report[]> => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const reports: Report[] = [];

    snapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data(),
      } as Report);
    });

    return reports;
  } catch (error) {
    console.error('Error getting user reports:', error);
    throw error;
  }
};

export const getReportById = async (reportId: string): Promise<Report | null> => {
  try {
    const docRef = doc(db, 'reports', reportId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Report;
    }

    return null;
  } catch (error) {
    console.error('Error getting report:', error);
    throw error;
  }
};

export const getReportsByIds = async (reportIds: string[]): Promise<Report[]> => {
  try {
    if (reportIds.length === 0) return [];

    const promises = reportIds.map((id) => getReportById(id));
    const reports = await Promise.all(promises);

    return reports.filter((report) => report !== null) as Report[];
  } catch (error) {
    console.error('Error getting reports by IDs:', error);
    throw error;
  }
};

export const subscribeToReportsInRadius = (
  latitude: number,
  longitude: number,
  radiusInKm: number,
  callback: (reports: Report[]) => void
): (() => void) => {
  const center: [number, number] = [latitude, longitude];
  const radiusInM = radiusInKm * 1000;
  const bounds = geohashQueryBounds(center, radiusInM);

  const unsubscribes: (() => void)[] = [];

  for (const bound of bounds) {
    const q = query(
      collection(db, 'reports'),
      // orderBy('location.geohash'),
      // where('location.geohash', '>=', bound[0]),
      // where('location.geohash', '<=', bound[1])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: Report[] = [];
      snapshot.forEach((doc) => {
        // console.log(doc.data(), "-----doc.data()-----")
        reports.push({
          id: doc.id,
          ...doc.data(),
        } as Report);
      });
      callback(reports);
    });

    unsubscribes.push(unsubscribe);
  }

  // Return cleanup function
  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
};



export const trackReport = async (
  userId: string,
  reportId: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      trackedReports: arrayUnion(reportId),
    });
  } catch (error) {
    console.error('Error tracking report:', error);
    throw error;
  }
};

export const untrackReport = async (
  userId: string,
  reportId: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      trackedReports: arrayRemove(reportId),
    });
  } catch (error) {
    console.error('Error untracking report:', error);
    throw error;
  }
};

export const subscribeToReport = (
  reportId: string,
  callback: (report: Report | null) => void
): (() => void) => {
  const reportRef = doc(db, 'reports', reportId);

  return onSnapshot(reportRef, (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data(),
      } as Report);
    } else {
      callback(null);
    }
  });
};

// ============================================
// Update status change to notify
// ============================================

export const updateReportStatus = async (
  reportId: string,
  status: ReportStatus
): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    
    if (!reportSnap.exists()) {
      throw new Error('Report not found');
    }

    const reportData = reportSnap.data();

    await updateDoc(reportRef, { 
      status,
      updatedAt: serverTimestamp(),
    });

    // Notify report creator
    if (reportData.userId) {
      await createNotification(
        reportData.userId,
        'status_change',
        status === 'resolved' ? '✅ Report Resolved' : '🔄 Report Reopened',
        `Your report has been marked as ${status}`,
        reportId
      );
    }

    // Notify users tracking this report
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('trackedReports', 'array-contains', reportId)
      )
    );

    const notificationPromises: Promise<void>[] = [];

    usersSnapshot.forEach((userDoc) => {
      const userId = userDoc.id;
      
      if (userId !== reportData.userId) {
        notificationPromises.push(
          createNotification(
            userId,
            'status_change',
            status === 'resolved' ? '✅ Report Resolved' : '🔄 Report Updated',
            `A tracked report has been marked as ${status}`,
            reportId
          )
        );
      }
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error updating report status:', error);
    throw error;
  }
};

// ============================================
// Quick Test Function (Add to Profile or Settings)
// ============================================

/**
 * Send yourself a test notification
 */
export const sendTestNotification = async (userId: string): Promise<void> => {
  await createNotification(
    userId,
    'nearby_alert',
    '🚨 Test Alert',
    'This is a test notification from the Local Safety App',
    'test-report-id'
  );
};