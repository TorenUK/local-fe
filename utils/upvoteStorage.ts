// utils/upvoteStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get list of reports user has upvoted
 */
export const getUpvotedReports = async (userId: string): Promise<string[]> => {
  try {
    const key = `upvoted_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting upvoted reports:', error);
    return [];
  }
};

/**
 * Save upvoted report to prevent duplicate upvotes
 */
export const saveUpvotedReport = async (
  userId: string, 
  reportId: string
): Promise<void> => {
  try {
    const key = `upvoted_${userId}`;
    const upvoted = await getUpvotedReports(userId);
    
    if (!upvoted.includes(reportId)) {
      upvoted.push(reportId);
      await AsyncStorage.setItem(key, JSON.stringify(upvoted));
    }
  } catch (error) {
    console.error('Error saving upvoted report:', error);
  }
};

/**
 * Check if user has upvoted a report
 */
export const hasUserUpvoted = async (
  userId: string, 
  reportId: string
): Promise<boolean> => {
  const upvoted = await getUpvotedReports(userId);
  return upvoted.includes(reportId);
};