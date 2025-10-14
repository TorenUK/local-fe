// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);