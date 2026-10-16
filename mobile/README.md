# Smart Skin Care — React Native

Expo SDK 57 / React Native 0.86, TypeScript and Expo Router. This is a separate native client of the existing FastAPI backend; the React web client and SwiftUI project remain available. Account data syncs across clients through the same backend. There is no database migration for the mobile client.

## Run on Windows

Use Node **22.13 or newer** (Node 22 LTS recommended). Install dependencies in this directory:

```powershell
cd mobile
npm ci
npx expo start --go
```

If your installed Node is older, this temporary Node 22 command can launch Metro after `npm ci`:

```powershell
npx --yes --package=node@22 node node_modules/expo/bin/cli start --go
```

Start the existing API in another terminal, from the repository root:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001
```

This assumes the backend environment is already installed; see `../backend/README.md` for setup and model dependencies. Binding to `0.0.0.0` makes the API reachable on your local network. Keep this development server on a trusted network.

On an Android emulator, press `a` after it is booted and choose `http://10.0.2.2:8001` on the sign-in screen. The emulator must have a compatible Expo Go installed. On an Android phone, install Expo Go, scan Metro's QR code and enter the computer's LAN address on the sign-in screen. Both devices must share a network; Windows Firewall must allow the API and Metro. On an iPhone, use a compatible Expo Go and scan with Camera. iOS Simulator runs on macOS, not Windows.

An emulator is **not included or installed** by this repository. On this laptop, virtualization was reported disabled during setup and Android SDK/ADB were absent. Enable CPU virtualization in BIOS/UEFI before configuring Android Studio's Android Virtual Device. A physical phone is an alternative. Camera support varies by emulator; the app's **Choose photo** buttons allow testing uploads without a camera. Real camera testing requires a supported device.

The sign-in screen accepts a server origin (no `/api` suffix). Defaults: Android `http://10.0.2.2:8001`; iOS/web `http://localhost:8001`. Optionally copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`; restart Metro after changes. Public Expo environment variables are bundled into the app: never put secrets in them.

## Implemented native flows

- Registration/sign-in, account-scoped profile editing and sign-out.
- Access token in memory; rotating refresh token in SecureStore on Android/iOS. Server origin and token are stored together. Tokens are never put in AsyncStorage or web localStorage. Web preview uses memory-only sessions.
- History with pending scans, acne analysis/retry, independent binary wrinkle detection, permanent scan/photo deletion confirmation and two-capture comparisons of measured indicators only.
- Three front/left/right views with native camera permission handling, photo selection, JPEG conversion and maximum 1280-pixel dimensions. Upload requires explicit consent. Selected temporary app-cache photos are deleted on replacement, discard, successful upload and screen unmount. The OS may retain cache after an abrupt process termination.
- Editable morning/evening routine, save/reload and draft generation from the latest analyzed scan. Unsaved edits survive tab changes.
- Saved conversation, external-AI opt-in, local guidance without a configured provider, deletion confirmation and refresh.

Analysis is run explicitly from History after upload, so a failed model request does not require another photo upload. First model loading can take time; install the backend model dependencies and allow its initial download. If upload times out, refresh History before retrying: the server may already have saved it.

## Builds

All included runtime modules are Expo modules or SDK-compatible dependencies. Expo Go is useful for development; it does not validate a standalone application binary. `expo-dev-client` is included for development builds. Use EAS for cloud builds from Windows:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

The preview profile produces an installable Android APK. Download the completed build from the URL EAS returns, then install it on the emulator or phone. EAS requires your Expo account and may have queue/plan limits. The project is linked to [@sallam_lebriji/smart-skin-care](https://expo.dev/accounts/sallam_lebriji/projects/smart-skin-care); signing credentials are not committed. All build profiles use Node 22.23.3.

### Verified Android preview

The first native Android release build succeeded on 2026-10-16 from app commit `c39cad9`: [EAS build details](https://expo.dev/accounts/sallam_lebriji/projects/smart-skin-care/builds/e44ff1dc-317c-4e7d-a8ba-73b58ae07322), [download APK](https://expo.dev/artifacts/eas/VsX2zhpz24xzeOsKtn4mXzzzO0z37U9hlLc9KBQ07u0.apk). The installer is 123,296,455 bytes and contains ARM64, ARMv7, x86 and x86_64 native libraries, supporting Android phones and compatible emulators. Archive integrity and the presence of its APK signing block were checked after download. It has **not** been launched on a native device/emulator here.

SHA-256: `122a84f92d50816b7d6c8e7bdab4f6fe39ee370cd4a324f2c07fda3d2953c879`.

Install the APK on Android, start the backend as above, then enter `http://10.0.2.2:8001` for a Windows Android emulator or your computer's LAN address for a phone. Confirm camera permission, three-view capture, upload consent, analysis, profile/routine/chat persistence, sign-out and session restoration on a real device. iOS native compilation and device testing remain separate.

For a custom development client:

```powershell
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

`eas build --platform ios --profile preview` produces a simulator build to run on a **Mac**. Device iOS distribution needs the appropriate Apple signing setup. Never edit generated `mobile/android` or `mobile/ios`; use app config and config plugins. The separate repository-level `ios/` directory is the earlier SwiftUI client, not generated Expo output.

Local HTTP is permitted in development/preview builds for emulator/LAN testing. The production profile requires `EXPO_PUBLIC_API_URL` with an HTTPS origin, disables Android cleartext, uses default iOS ATS and rejects HTTP server entries in the client. Set the real production URL in your EAS environment before building; there is no invented deployment URL.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npx expo-doctor
npm run export -- --max-workers 2
```

CI runs lint, typecheck, transport tests and Android/iOS JavaScript exports. An export verifies bundle generation, **not** native compilation, permissions, camera, SecureStore persistence or device interaction. Backend tests cover bearer login, ownership, invalid headers, token rotation/reuse, revocation and existing cookie-client compatibility. The separate EAS Android build above establishes native compilation; native iOS compilation and device acceptance tests remain necessary.

Local validation on 2026-10-16: 74 backend tests, 8 mobile transport tests, lint/typecheck, both platform exports and all 21 Expo Doctor checks passed. A headless Chromium web preview also exercised registration, protected navigation, saved routine, local chat, profile persistence, sign-out/sign-in, three-photo selection, the consent gate and upload/history against an isolated API/database. This browser pass does not substitute for native device tests. The SDK 57 dependency tree's npm audit currently reports 28 advisories (18 high, 10 moderate), including tooling dependencies; review upstream compatible fixes before production distribution. Do not apply `npm audit fix --force`, which proposes incompatible SDK changes.

## Current migration boundaries

The capture flow uses manual instructions; MediaPipe/Vision pose, lighting and blur checks and TrueDepth are not implemented in this Expo client. It does not claim automatic face validation. Guest mode, interactive 3D face regions and product recommendation browsing remain in the web client.

Only measured indicators are displayed and compared. The seven simulated metrics and aggregate placeholder score are hidden. Wrinkle presence uses the existing experimental binary model, not a validated three-level severity classifier. The provisional severity research pilot remains separate and is not activated here. Model results are appearance estimates, not medical diagnoses.
