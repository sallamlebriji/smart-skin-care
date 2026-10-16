import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.APP_ENV === 'production';
  if (production && !process.env.EXPO_PUBLIC_API_URL?.startsWith('https://')) {
    throw new Error('Set EXPO_PUBLIC_API_URL to your HTTPS API origin before a production build.');
  }
  return {
    ...config,
    name: 'Smart Skin Care',
    slug: 'smart-skin-care',
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        // Local emulator/LAN development only. Production uses the default ATS policy.
        ...(!production ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
      },
    },
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: !production } }]],
  };
};
