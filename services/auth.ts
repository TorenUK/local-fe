// services/auth.ts - Complete with all profile functions
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateEmail,
  updatePassword,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

WebBrowser.maybeCompleteAuthSession();

// ============================================
// TYPES
// ============================================

export interface UserProfile {
  uid: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  isAnonymous: boolean;
  trackedReports: string[];
  createdReports: string[];
  createdAt: Timestamp;
  lastActive: Timestamp;
  settings?: {
    notificationsEnabled: boolean;
    alertRadius: number;
    emailNotifications: boolean;
  };
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface UpdateProfileData {
  name?: string;
  photoUrl?: string;
}

export interface UpdateEmailData {
  newEmail: string;
  currentPassword: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

// ============================================
// USER PROFILE HELPERS
// ============================================

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Update user profile in Firestore
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<UserProfile>
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      lastActive: serverTimestamp(),
    });
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

const createUserDocument = async (user: User, additionalData?: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  const baseData: UserProfile = {
    uid: user.uid,
    name: additionalData?.name || user.displayName || (user.isAnonymous ? 'Anonymous' : 'User'),
    email: user.email,
    photoUrl: user.photoURL,
    isAnonymous: user.isAnonymous,
    trackedReports: [],
    createdReports: [],
    createdAt: serverTimestamp() as any,
    lastActive: serverTimestamp() as any,
    settings: {
      notificationsEnabled: true,
      alertRadius: 5,
      emailNotifications: !user.isAnonymous,
    },
  };

  if (!snapshot.exists()) {
    await setDoc(userRef, { ...baseData, ...additionalData });
  } else {
    await updateDoc(userRef, { lastActive: serverTimestamp() });
  }
};

// ============================================
// EMAIL + ANONYMOUS AUTH
// ============================================

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await createUserDocument(user, { name });
  
  // Send verification email
  await sendEmailVerification(user);
  
  return user;
};

export const signInWithEmail = async (email: string, password: string) => {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await createUserDocument(user);
  return user;
};

export const signInAnonymous = async () => {
  const { user } = await signInAnonymously(auth);
  await createUserDocument(user);
  return user;
};

// ============================================
// APPLE SIGN-IN
// ============================================

export const signInWithApple = async (): Promise<User> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const provider = new GoogleAuthProvider();
    const appleCredential = GoogleAuthProvider.credential(credential.identityToken);
    const { user } = await signInWithCredential(auth, appleCredential);
    await createUserDocument(user);
    return user;
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      throw new Error('Apple sign-in cancelled');
    }
    console.error('Apple sign in error:', error);
    throw new Error('Apple sign-in failed');
  }
};

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Update user display name and photo
 */
export const updateUserDisplayProfile = async ({
  name,
  photoUrl,
}: UpdateProfileData): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Update Firebase Auth profile
    const updates: { displayName?: string; photoURL?: string } = {};
    if (name !== undefined) updates.displayName = name;
    if (photoUrl !== undefined) updates.photoURL = photoUrl;

    await updateProfile(user, updates);

    // Update Firestore profile
    const firestoreUpdates: Partial<UserProfile> = {};
    if (name !== undefined) firestoreUpdates.name = name;
    if (photoUrl !== undefined) firestoreUpdates.photoUrl = photoUrl;

    await updateUserProfile(user.uid, firestoreUpdates);
    console.log('Profile updated successfully');
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
};

/**
 * Send email verification
 */
export const sendVerificationEmail = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    await sendEmailVerification(user);
    console.log('Verification email sent');
  } catch (error: any) {
    console.error('Send verification error:', error);
    throw new Error(error.message || 'Failed to send verification email');
  }
};

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    console.log('Signed out successfully');
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent');
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

/**
 * Change user email
 */
export const changeEmail = async ({
  newEmail,
  currentPassword,
}: UpdateEmailData): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }

    // Re-authenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update email
    await updateEmail(user, newEmail);

    // Update Firestore
    await updateUserProfile(user.uid, { email: newEmail });

    // Send verification email
    await sendEmailVerification(user);
    
    console.log('Email updated successfully');
  } catch (error: any) {
    console.error('Change email error:', error);
    throw new Error(error.message || 'Failed to change email');
  }
};

/**
 * Change user password
 */
export const changePassword = async ({
  currentPassword,
  newPassword,
}: UpdatePasswordData): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }

    // Re-authenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);
    console.log('Password updated successfully');
  } catch (error: any) {
    console.error('Change password error:', error);
    throw new Error(error.message || 'Failed to change password');
  }
};

/**
 * Delete user account
 */
export const deleteAccount = async (password?: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Re-authenticate if password provided
    if (password && user.email) {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }

    // Delete Firestore document
    const userRef = doc(db, 'users', user.uid);
    await deleteDoc(userRef);

    // Delete Firebase Auth account
    await deleteUser(user);
    console.log('Account deleted successfully');
  } catch (error: any) {
    console.error('Delete account error:', error);
    throw new Error(error.message || 'Failed to delete account');
  }
};

// ============================================
// ANONYMOUS ACCOUNT CONVERSION
// ============================================

/**
 * Link anonymous account with email/password
 */
export const linkAnonymousWithEmail = async ({
  email,
  password,
  name,
}: SignUpData): Promise<User> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.isAnonymous) {
      throw new Error('No anonymous user to link');
    }

    // Create credential
    const credential = EmailAuthProvider.credential(email, password);

    // Link credential to anonymous account
    const userCredential = await linkWithCredential(user, credential);

    // Update display name
    await updateProfile(userCredential.user, { displayName: name });

    // Update Firestore document
    await updateUserProfile(user.uid, {
      name,
      email,
      isAnonymous: false,
    });

    // Send verification email
    await sendEmailVerification(userCredential.user);
    console.log('Anonymous account linked successfully');

    return userCredential.user;
  } catch (error: any) {
    console.error('Link anonymous account error:', error);
    throw new Error(error.message || 'Failed to link account');
  }
};

// ============================================
// AUTH STATE
// ============================================

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback({
      uid: "mock-user-123",
      email: "mockuser@example.com",
    } as User);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) await createUserDocument(user);
    callback(user);
  });
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Check if user's email is verified
 */
export const isEmailVerified = (): boolean => {
  return auth.currentUser?.emailVerified ?? false;
};