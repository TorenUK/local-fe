import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../hooks/useAuth';

function RootLayoutNav() {
  const { user, loading, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme(); // detects dark or light mode

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!user && !inAuthGroup && !isLoggedIn) {
      router.replace('/(auth)/signIn');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';

  if (loading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor,
        }}
      >
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#fff' : '#000'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
