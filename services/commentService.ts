import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ============================================
// TYPES
// ============================================

export interface Comment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: Timestamp;
  flagged: boolean;
}

export interface CreateCommentData {
  reportId: string;
  userId: string;
  content: string;
}

// ============================================
// CREATE COMMENT
// ============================================

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

    console.log('Comment created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

// ============================================
// GET COMMENTS
// ============================================

export const getReportComments = async (reportId: string): Promise<Comment[]> => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('reportId', '==', reportId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const comments: Comment[] = [];

    snapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data(),
      } as Comment);
    });

    return comments;
  } catch (error) {
    console.error('Error getting comments:', error);
    throw error;
  }
};

export const getCommentById = async (commentId: string): Promise<Comment | null> => {
  try {
    const docRef = doc(db, 'comments', commentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Comment;
    }

    return null;
  } catch (error) {
    console.error('Error getting comment:', error);
    throw error;
  }
};

// ============================================
// UPDATE COMMENT
// ============================================

export const updateComment = async (
  commentId: string,
  content: string
): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, { content });
    console.log('Comment updated successfully');
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

// ============================================
// DELETE COMMENT
// ============================================

export const deleteComment = async (
  commentId: string,
  reportId: string
): Promise<void> => {
  try {
    // Delete the comment
    const commentRef = doc(db, 'comments', commentId);
    await deleteDoc(commentRef);

    // Decrement comment count on report
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      commentCount: increment(-1),
    });

    console.log('Comment deleted successfully');
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ============================================
// FLAG COMMENT
// ============================================

export const flagComment = async (commentId: string): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, { flagged: true });
    console.log('Comment flagged successfully');
  } catch (error) {
    console.error('Error flagging comment:', error);
    throw error;
  }
};