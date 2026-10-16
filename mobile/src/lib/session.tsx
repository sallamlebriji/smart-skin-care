import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MobileApi, normalizeEndpoint, type SavedSession, type User } from './api';

const KEY = 'smartskin.native.session.v1';
const DEFAULT = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8001' : 'http://localhost:8001');
const store = {
  async save(value: SavedSession) {
    // Web preview keeps sessions in memory; never write bearer tokens to localStorage.
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(KEY, JSON.stringify(value), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
type Session = {
  api: MobileApi; user: User | null; loading: boolean; startupError: string;
  authenticate: (endpoint: string, action: 'login' | 'register', email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [api, setApi] = useState(() => new MobileApi(normalizeEndpoint(DEFAULT), store, () => setUser(null)));
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const encoded = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(KEY);
        if (!encoded) return;
        const saved = JSON.parse(encoded) as SavedSession;
        const client = new MobileApi(normalizeEndpoint(saved.endpoint), store, () => setUser(null));
        if (mounted) setApi(client);
        if (saved.refreshToken) {
          const restored = await client.restore(saved.refreshToken);
          if (mounted) setUser(restored);
        }
      } catch (error) {
        if (mounted) setStartupError(error instanceof Error ? error.message : 'Could not restore session');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  async function authenticate(endpoint: string, action: 'login' | 'register', email: string, password: string) {
    const client = new MobileApi(normalizeEndpoint(endpoint), store, () => setUser(null));
    const signedIn = await client.authenticate(action, email.trim(), password);
    setApi(client); setUser(signedIn); setStartupError('');
  }
  async function logout() { await api.logout(); setUser(null); }
  return <Context.Provider value={{ api, user, loading, startupError, authenticate, logout }}>{children}</Context.Provider>;
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error('SessionProvider is required');
  return session;
}
