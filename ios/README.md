# Smart Skin Care for iPhone

`SmartSkinCare.xcodeproj` contains an iOS 17 SwiftUI application with account login/registration, scan history, analysis, comparison, deletion, editable routines and the saved assistant conversation. The API URL is configurable in the sign-in screen. Authentication uses the backend cookie session and refresh flow.

## Open and build on macOS

Open `SmartSkinCare.xcodeproj` in Xcode. Select the SmartSkinCare scheme, choose your signing team and a simulator or iPhone. The bundle identifier defaults to `com.smartskincare.app`; change it for your signing setup.

A simulator build can be checked with:

```sh
xcodebuild -project SmartSkinCare.xcodeproj -scheme SmartSkinCare -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Start the existing FastAPI backend. `http://localhost:8000` works for a simulator on the backend's Mac; a physical phone needs a reachable API address. Use HTTPS for a remote service. Local-network permission and local networking transport configuration are included; arbitrary insecure remote transport is not enabled.

## Capture

The app guides three front-camera photos (front, left and right), checks one visible face, lighting and pose through Vision, and asks consent before uploading. TrueDepth capture uses AVFoundation depth delivery on supported devices and reports a local distance estimate. Depth maps are not embedded in uploaded JPEGs or sent to the API; current server indicators analyze RGB photos. This is not a 3D skin assessment. Ordinary camera capture remains available on devices without TrueDepth.

Camera acquisition requires a real iPhone. Before distribution, compile with the iOS SDK and verify permissions, interruption/background handling, three-angle capture, depth availability and delivery, account refresh, upload/analysis, routines, chat and deletion on devices. Capture thresholds are initial heuristics and need device validation. Estimates and comparisons are not diagnoses; simulated metrics are excluded from displayed measured comparisons.

## Verification

All 11 Swift files pass syntax parsing, and project references, the scheme and property lists pass structural checks. The application also compiled successfully for the iOS simulator with Xcode on a macOS GitHub Actions runner (commit `dff2f65`). This verifies Swift type checking and SDK compilation. Signing, physical camera/TrueDepth behavior and device usability still require testing on an iPhone.

[Successful web, backend and iOS verification](https://github.com/sallamlebriji/smart-skin-care/actions/runs/38726050716). The workflow runs automatically on pushes and pull requests.

## Simulator startup verified

The native app was also installed and launched in an **iPhone SE (3rd generation), iOS 26.2** simulator on a GitHub macOS runner. The rendered sign-in screen was captured and visually inspected. API logs show the initial `/api/auth/me` and refresh calls reaching the isolated backend; the expected 401 responses leave the app on the sign-in screen without a connection error.

[Simulator startup run](https://github.com/sallamlebriji/smart-skin-care/actions/runs/38738788051) — download the `ios-simulator-smoke` artifact for the screenshot, device information, launch output and API log. Artifacts are retained for seven days.

This is a startup smoke test, not an automated UI interaction suite. Registration, login, routines and chat interactions were not exercised by this simulator run. Physical camera/TrueDepth behavior remains unverified.

Windows does not provide Apple's native iOS simulator. The actual simulator runs on the macOS CI host. On a Mac, build from the repository root with the CI build command, start the backend on port 8000, then run:

```sh
python ios/tools/simulator_smoke.py
```

The script selects an available iPhone, boots it, installs the built app, launches it and saves a screenshot under `build/simulator-smoke/`. Reference: [Apple's simulator documentation](https://help.apple.com/xcode/mac/current/en.lproj/devfd9e28378.html).

To regenerate and inspect the project using Python:

```sh
python tools/generate_project.py
python -m pip install -r tools/requirements.txt
python tools/verify_sources.py
```

The privacy manifest declares application functionality data and the UserDefaults access reason. Review declarations against the final distributed app and services before submission. Camera/depth implementation references: [Apple depth capture documentation](https://developer.apple.com/documentation/avfoundation/capturing-photos-with-depth).
