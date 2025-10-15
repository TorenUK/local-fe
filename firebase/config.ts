// firebase/config.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDwxrBtc9xKA_zWu_zZtbzcqPj0A67RbLc",
  authDomain: "local-app-a5298.firebaseapp.com",
  projectId: "local-app-a5298",
  storageBucket: "local-app-a5298.firebasestorage.app",
  messagingSenderId: "899691721647",
  appId: "1:899691721647:web:f74467582735ea177df55a",
  measurementId: "G-ETYTCW0T12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// export const auth = getAuth(app);
// export const db = getFirestore(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const storage = getStorage(app);

// export { app, auth, db, storage };
