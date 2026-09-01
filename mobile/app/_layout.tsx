import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { setOnSessionExpired } from '../services/http';
import { AuthService } from '../services/AuthService';

export const unstable_settings = {
  // `index` is the boot gate: it restores a stored session, or sends the device
  // to enrollment. Starting at `enrollment` instead would make every restart a
  // new access request needing an admin.
  initialRouteName: 'index',
};

export default function RootLayout() {
  const router = useRouter();

  // A refresh token that the backend rejects cannot be recovered from in the
  // app — the only way back is a new access request. Without this the user
  // would sit on a screen where every request quietly 401s and nothing loads.
  useEffect(() => {
    setOnSessionExpired(() => {
      // http.ts has already cleared the tokens; this also drops the stored user
      // and any half-finished enrollment, so the gate cannot bounce straight
      // back into an app the device can no longer talk to.
      void AuthService.forgetSession();
      Alert.alert('Sesiune expirată', 'Trimite o nouă cerere de acces.');
      router.replace('/enrollment');
    });
    return () => setOnSessionExpired(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="enrollment" />
      <Stack.Screen name="Driver" />
      <Stack.Screen name="Sales" />
      <Stack.Screen name="Technical" />
    </Stack>
  );
}
