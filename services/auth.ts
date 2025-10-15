import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateEmail,
  updatePassword,
  updateProfile,
  User
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

WebBrowser.maybeCompleteAuthSession();

// TYPES

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

// USER PROFILE HELPERS

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
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

// EMAIL + ANONYMOUS AUTH

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await createUserDocument(user, { name });
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

// GOOGLE SIGN-IN (Expo Auth Session)

// export const signInWithGoogle = async (): Promise<User> => {
//   try {
//     const clientId =
//       Platform.select({
//         ios: Constants.expoConfig?.extra?.iosClientId,
//         android: Constants.expoConfig?.extra?.androidClientId,
//         default: Constants.expoConfig?.extra?.webClientId,
//       }) || '';

//     const redirectUri = AuthSession.makeRedirectUri({
//       useProxy: Platform.OS !== 'web',
//     });

//     const discovery = {
//       authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
//       tokenEndpoint: 'https://oauth2.googleapis.com/token',
//     };

//     const { promptAsync, response } = Google.useAuthRequest(
//       {
//         clientId,
//         redirectUri,
//         scopes: ['openid', 'profile', 'email'],
//       },
//       discovery
//     );

//     const result = await promptAsync();

//     if (result.type !== 'success' || !result.params?.id_token)
//       throw new Error('Google sign-in cancelled or failed');

//     const credential = GoogleAuthProvider.credential(result.params.id_token);
//     const { user } = await signInWithCredential(auth, credential);
//     await createUserDocument(user);
//     return user;
//   } catch (error: any) {
//     console.error('Google sign in error:', error);
//     throw new Error('Google sign-in failed');
//   }
// };

// APPLE SIGN-IN

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

// ACCOUNT MANAGEMENT

export const signOut = async () => firebaseSignOut(auth);

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export const changeEmail = async (newEmail: string, currentPassword: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updateEmail(user, newEmail);
  await createUserDocument(user, { email: newEmail });
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

// AUTH STATE

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) await createUserDocument(user);
    callback(user);
  });
};
