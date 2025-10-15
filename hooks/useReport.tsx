import { useEffect, useState } from 'react';
import { Region } from 'react-native-maps';
import { Report, subscribeToReportsInRadius } from '../services/reportService';

export const useReports = (region: Region | null) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!region) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use real-time listener
    const unsubscribe = subscribeToReportsInRadius(
      region.latitude,
      region.longitude,
      10, // 10km radius
      (newReports) => {
        setReports(newReports);
        setLoading(false);
        setError(null);
      }
    );

    // Cleanup listener on unmount or region change
    return () => unsubscribe();
  }, [region?.latitude, region?.longitude]);

  return { reports, loading, error };
};

/**
 * Hook to get user's created reports
 */
export const useUserReports = (userId: string | null) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        const { getUserReports } = await import('../services/reportService');
        const userReports = await getUserReports(userId);
        setReports(userReports);
      } catch (error) {
        console.error('Error fetching user reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [userId]);

  return { reports, loading };
};

/**
 * Hook to get tracked reports
 */
export const useTrackedReports = (reportIds: string[]) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reportIds.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        const { getReportsByIds } = await import('../services/reportService');
        const trackedReports = await getReportsByIds(reportIds);
        setReports(trackedReports);
      } catch (error) {
        console.error('Error fetching tracked reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [reportIds.join(',')]);

  return { reports, loading };
};

/**
 * Hook for a single report with real-time updates
 */
export const useReport = (reportId: string | null) => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { subscribeToReport } = require('../services/reportService');
    const unsubscribe: () => void = subscribeToReport(
      reportId,
      (updatedReport: Report) => {
        setReport(updatedReport);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reportId]);

  return { report, loading };
};