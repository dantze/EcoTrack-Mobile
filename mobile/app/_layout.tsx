import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { setOnSessionExpired } from '../services/http';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const router = useRouter();

  // A refresh token that the backend rejects cannot be recovered from in the
  // app — the only way back is a real login. Without this the user would sit on
  // a screen where every request quietly 401s and nothing ever loads.
  useEffect(() => {
    setOnSessionExpired(() => {
      Alert.alert('Sesiune expirată', 'Te rugăm să te autentifici din nou.');
      router.replace('/login');
    });
    return () => setOnSessionExpired(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="Driver" />
      <Stack.Screen name="Sales" />
      <Stack.Screen name="Technical" />
    </Stack>
  );
}
