import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { setOnSessionExpired, setOnSessionRenewed } from '../services/http';
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

  // A role change on the web reaches the phone here (TODO-35). The menus are
  // drawn from a cached `user.roles` written at claim time, so a promotion or a
  // demotion left this device rendering buttons the backend would refuse — a
  // tap that "does nothing", or a 403. Every silent refresh now re-reads the
  // employee, and a device whose roles actually moved is sent back through the
  // boot gate, which routes it by the new ones.
  //
  // Not a privilege leak either way: authorization reads the Employee the token
  // points at, never this copy. What it fixes is the confusion.
  useEffect(() => {
    setOnSessionRenewed(() => {
      void (async () => {
        const synced = await AuthService.syncCurrentUser();
        // Only on a real change: re-routing on every refresh would throw away
        // whatever screen the user was on, twice an hour, for nothing.
        if (!synced?.rolesChanged) return;
        Alert.alert('Rolurile au fost actualizate', 'Aplicația se va deschide din nou cu noile drepturi.');
        router.replace('/');
      })();
    });
    return () => setOnSessionRenewed(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="enrollment" />
      <Stack.Screen name="Driver" />
      {/* Sales and Technical were deleted (TODO-33); `office` is the signpost
          an employee holding only those roles lands on. */}
      <Stack.Screen name="office" />
    </Stack>
  );
}
