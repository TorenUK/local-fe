import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const analytics = getAnalytics(app);