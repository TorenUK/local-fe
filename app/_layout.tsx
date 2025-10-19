import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';

function RootLayoutNav() {
  const { user, loading, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme(); 

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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor,
        }}
      >
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#fff' : '#000'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
  );
}
