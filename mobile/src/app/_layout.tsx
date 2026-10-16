import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { Busy, Screen } from '../components/ui';

function Navigation() {
  const { user, loading } = useSession();
  if (loading) return <Screen title="Welcome back"><Busy /></Screen>;
  return <Stack key={user?.id ?? 'signed-out'} screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!user}><Stack.Screen name="index" /></Stack.Protected>
    <Stack.Protected guard={!!user}><Stack.Screen name="(tabs)" /></Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <SafeAreaProvider><SessionProvider><StatusBar style="dark" /><Navigation /></SessionProvider></SafeAreaProvider>;
}
