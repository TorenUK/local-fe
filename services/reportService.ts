// services/reportsService.ts
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

    console.log(reportData, "-----reportData-----")

    const docRef = await addDoc(collection(db, 'reports'), reportData);

    // Update user's createdReports array if not anonymous
    if (userId && !data.isAnonymous) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        createdReports: arrayUnion(docRef.id),
      });
    }

    console.log('Report created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

// ============================================
// GET REPORTS
// ============================================

/**
 * Get reports within a geographic radius
 */
export const getReportsInRadius = async (
  latitude: number,
  longitude: number,
  radiusInKm: number = 5
): Promise<Report[]> => {
  try {
    const center: [number, number] = [latitude, longitude];
    const radiusInM = radiusInKm * 1000;

    // Calculate geohash query bounds
    const bounds = geohashQueryBounds(center, radiusInM);
    const promises: Promise<any>[] = [];

    // Query for each geohash range
    for (const bound of bounds) {
      const q = query(
        collection(db, 'reports'),
        orderBy('location.geohash'),
        where('location.geohash', '>=', bound[0]),
        where('location.geohash', '<=', bound[1])
      );
      promises.push(getDocs(q));
    }

    const snapshots = await Promise.all(promises);
    const reports: Report[] = [];

    // Collect all matching documents
    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data();
        reports.push({
          id: doc.id,
          ...data,
        } as Report);
      }
    }

    return reports;
  } catch (error) {
    console.error('Error getting reports:', error);
    throw error;
  }
};

/**
 * Get a single report by ID
 */
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

/**
 * Get reports by user ID
 */
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

/**
 * Get reports by IDs (for tracked reports)
 */
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

// ============================================
// UPDATE REPORT
// ============================================

export const updateReport = async (
  reportId: string,
  data: UpdateReportData
): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);

    await updateDoc(reportRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    console.log('Report updated successfully');
  } catch (error) {
    console.error('Error updating report:', error);
    throw error;
  }
};

/**
 * Update report status
 */
export const updateReportStatus = async (
  reportId: string,
  status: ReportStatus
): Promise<void> => {
  try {
    await updateReport(reportId, { status });
  } catch (error) {
    console.error('Error updating report status:', error);
    throw error;
  }
};

// ============================================
// DELETE REPORT
// ============================================

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

// ============================================
// UPVOTE / TRACK
// ============================================

/**
 * Upvote a report
 */
export const upvoteReport = async (reportId: string): Promise<void> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      upvotes: increment(1),
    });
  } catch (error) {
    console.error('Error upvoting report:', error);
    throw error;
  }
};

/**
 * Track a report (add to user's tracked list)
 */
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

/**
 * Untrack a report
 */
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

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to reports in a radius
 */
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

/**
 * Subscribe to a single report
 */
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
