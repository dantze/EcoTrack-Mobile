import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="Driver" />
      <Stack.Screen name="Sales" />
      <Stack.Screen name="Technical" />
    </Stack>
  );
}