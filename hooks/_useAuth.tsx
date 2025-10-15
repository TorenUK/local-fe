import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { useEffect } from 'react';
import { auth } from '../firebase/config';

WebBrowser.maybeCompleteAuthSession();

export const useAuth = () => {
  // 🔹 Google Sign-In
  const [request, response, promptAsync] = Google.useAuthRequest({
    // expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch(console.error);
    }
  }, [response]);

  const signInWithGoogle = async () => {
    await promptAsync();
  };

  // 🔹 Apple Sign-In
  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const provider = new GoogleAuthProvider();
      const appleCredential = GoogleAuthProvider.credential(credential.identityToken);
      await signInWithCredential(auth, appleCredential);
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('User cancelled Apple Sign-In');
      } else {
        console.error(error);
      }
    }
  };

  // 🔹 Email + Password
  const signInWithEmail = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  return {
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    request, 
  };
};