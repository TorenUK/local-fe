// services/feedService.ts
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { createNotification } from './notificationService';


export interface Post {
  id: string;
  userId: string;
  content: string;
  photos?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  likes: number;
  likedBy: string[];
  commentCount: number;
}

export interface CreatePostData {
  content: string;
  photos?: string[];
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Timestamp;
}

export interface CreatePostCommentData {
  postId: string;
  userId: string;
  content: string;
}

/**
 * Create a new post
 */
export const createPost = async (
  userId: string,
  data: CreatePostData
): Promise<string> => {
  try {
    const postData = {
      userId,
      content: data.content,
      photos: data.photos || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: 0,
      likedBy: [],
      commentCount: 0,
    };

    const docRef = await addDoc(collection(db, 'posts'), postData);
    console.log('Post created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

/**
 * Get post by ID
 */
export const getPostById = async (postId: string): Promise<Post | null> => {
  try {
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Post;
    }

    return null;
  } catch (error) {
    console.error('Error getting post:', error);
    throw error;
  }
};

/**
 * Subscribe to feed (real-time updates)
 */
export const subscribeToFeed = (
  callback: (posts: Post[]) => void,
  limitCount: number = 50
): (() => void) => {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const posts: Post[] = [];
    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      } as Post);
    });
    callback(posts);
  });
};

/**
 * Subscribe to single post
 */
export const subscribeToPost = (
  postId: string,
  callback: (post: Post | null) => void
): (() => void) => {
  const postRef = doc(db, 'posts', postId);

  return onSnapshot(postRef, (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data(),
      } as Post);
    } else {
      callback(null);
    }
  });
};

/**
 * Like a post
 * FIX
 */
export const likePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }

    const postData = postSnap.data();

    // Check if already liked
    if (postData.likedBy?.includes(userId)) {
      return;
    }

    await updateDoc(postRef, {
      likes: increment(1),
      likedBy: arrayUnion(userId),
    });

    // Notify post creator (if not the liker)
    if (postData.userId && postData.userId !== userId) {
      await createNotification(
        postData.userId,
        'upvote',
        '❤️ New Like',
        'Someone liked your post',
        postId
      );
    }

    console.log('Post liked successfully');
  } catch (error) {
    console.error('Error liking post:', error);
    throw error;
  }
};

/**
 * Unlike a post
 * FIX
 */
export const unlikePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }

    const postData = postSnap.data();

    // Check if not liked
    if (!postData.likedBy?.includes(userId)) {
      return;
    }

    await updateDoc(postRef, {
      likes: increment(-1),
      likedBy: arrayRemove(userId),
    });

    console.log('Post unliked successfully');
  } catch (error) {
    console.error('Error unliking post:', error);
    throw error;
  }
};

/**
 * Delete a post
 */
export const deletePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }

    const postData = postSnap.data();

    // Check if user owns the post
    if (postData.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own posts');
    }

    // Delete all comments for this post
    const commentsQuery = query(
      collection(db, 'postComments'),
      where('postId', '==', postId)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    const deletePromises = commentsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the post
    await deleteDoc(postRef);
    console.log('Post deleted successfully');
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

/**
 * Create a comment on a post
 */
export const createPostComment = async (
  data: CreatePostCommentData
): Promise<string> => {
  try {
    const commentData = {
      postId: data.postId,
      userId: data.userId,
      content: data.content,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'postComments'), commentData);

    // Increment comment count on post
    const postRef = doc(db, 'posts', data.postId);
    await updateDoc(postRef, {
      commentCount: increment(1),
    });

    // Get the post to find who to notify
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.data();

      // Notify post creator (if not the commenter)
      if (postData.userId && postData.userId !== data.userId) {
        await createNotification(
          postData.userId,
          'comment',
          '💬 New Comment',
          `Someone commented: "${data.content.substring(0, 80)}..."`,
          data.postId
        );
      }
    }

    console.log('Comment created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

/**
 * Get comments for a post
 */
export const getPostComments = async (postId: string): Promise<PostComment[]> => {
  try {
    const q = query(
      collection(db, 'postComments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const comments: PostComment[] = [];

    snapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data(),
      } as PostComment);
    });

    return comments;
  } catch (error) {
    console.error('Error getting comments:', error);
    throw error;
  }
};

/**
 * Subscribe to post comments (real-time)
 */
export const subscribeToPostComments = (
  postId: string,
  callback: (comments: PostComment[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'postComments'),
    where('postId', '==', postId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const comments: PostComment[] = [];
    snapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data(),
      } as PostComment);
    });
    callback(comments);
  });
};

/**
 * Delete a comment
 */
export const deletePostComment = async (
  commentId: string,
  postId: string,
  userId: string
): Promise<void> => {
  try {
    const commentRef = doc(db, 'postComments', commentId);
    const commentSnap = await getDoc(commentRef);

    if (!commentSnap.exists()) {
      throw new Error('Comment not found');
    }

    const commentData = commentSnap.data();

    // Check if user owns the comment
    if (commentData.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own comments');
    }

    // Delete the comment
    await deleteDoc(commentRef);

    // Decrement comment count
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      commentCount: increment(-1),
    });

    console.log('Comment deleted successfully');
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

export const getUserPosts = async (userId: string): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error getting user posts:', error);
    throw error;
  }
};