import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../components/ui';

const icons = { index: 'time-outline', scan: 'scan-outline', routine: 'sunny-outline', chat: 'chatbubble-outline', account: 'person-outline' } as const;
export default function TabLayout() {
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { borderTopColor: colors.line },
    tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name as keyof typeof icons]} color={color} size={size} />,
  })}>
    <Tabs.Screen name="index" options={{ title: 'History' }} />
    <Tabs.Screen name="scan" options={{ title: 'Capture' }} />
    <Tabs.Screen name="routine" options={{ title: 'Routine' }} />
    <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
    <Tabs.Screen name="account" options={{ title: 'Account' }} />
  </Tabs>;
}
