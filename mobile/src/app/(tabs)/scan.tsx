import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Platform, Switch, View } from 'react-native';
import { router, useIsFocused, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Button, Card, Copy, Heading, Notice, Screen } from '../../components/ui';
import type { Scan } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useTask } from '../../lib/hooks';

const ANGLES = ['front', 'left', 'right'] as const;
type Angle = typeof ANGLES[number];
const instructions = {
  front: 'Look straight at the camera, with your full face in view.',
  left: 'Turn slightly to show the left side of your face.',
  right: 'Turn slightly to show the right side of your face.',
};

/** Only delete app-owned temporary files; never delete library originals. */
function discard(uri: string | undefined) {
  if (!uri || Platform.OS === 'web' || !uri.startsWith(Paths.cache.uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* OS may already have evicted the cache. */ }
}

export default function Capture() {
  const { api } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [angle, setAngle] = useState<Angle>('front');
  const [photos, setPhotos] = useState<Partial<Record<Angle, string>>>({});
  const photosRef = useRef(photos);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const task = useTask();
  const cameraVisible = focused && foreground && cameraEnabled && permission?.granted;

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { setForeground(state === 'active'); setReady(false); });
    return () => { listener.remove(); Object.values(photosRef.current).forEach(discard); };
  }, []);
  useFocusEffect(useCallback(() => { setReady(false); }, []));

  function reset() {
    Object.values(photosRef.current).forEach(discard);
    photosRef.current = {}; setPhotos({}); setAngle('front'); setConsent(false); setCameraEnabled(false);
  }
  async function keep(uri: string, width: number, height: number, target: Angle) {
    const context = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > 1280) context.resize(width >= height ? { width: 1280 } : { height: 1280 });
    const result = await (async () => {
      try {
        const rendered = await context.renderAsync();
        try { return await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 }); }
        finally { rendered.release(); }
      } finally { context.release(); discard(uri); }
    })();
    if (!task.mounted.current) { discard(result.uri); return; }
    if (Platform.OS !== 'web' && new File(result.uri).size > 5_000_000) {
      discard(result.uri); throw new Error('This photo is too large. Take another photo.');
    }
    discard(photosRef.current[target]);
    const updated = { ...photosRef.current, [target]: result.uri };
    photosRef.current = updated; setPhotos(updated);
    const missing = ANGLES.find(item => !updated[item]);
    if (missing) setAngle(missing);
    else setCameraEnabled(false);
    setNotice('Photo ready. Review the image before uploading.');
  }
  async function pick() {
    const target = angle;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false });
    if (!result.canceled) {
      const asset = result.assets[0];
      await keep(asset.uri, asset.width, asset.height, target);
    }
  }
  return <Screen title="A moment for your skin" subtitle="Three views, soft light, no filters. Keep the same lighting each time.">
    <Notice error>{task.error}</Notice><Notice>{notice}</Notice>
    <Card><Heading>{ANGLES.indexOf(angle) + 1} / 3 · {angle} view</Heading><Copy>{instructions[angle]}</Copy>
      <Copy>Remove glasses, keep hair away from your face and use even daylight. Pose, blur and lighting checks are manual in this version.</Copy>
      <View style={{ flexDirection: 'row', gap: 8 }}>{ANGLES.map(item => <View key={item} style={{ flex: 1 }}>
        <Button secondary title={`${photos[item] ? '✓ ' : ''}${item}`} disabled={task.busy} onPress={() => setAngle(item)} />
      </View>)}</View>
      {cameraVisible ? <CameraView ref={camera} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 18 }} facing="front" mode="picture" mirror={false}
        onCameraReady={() => setReady(true)} onMountError={() => { setCameraEnabled(false); setNotice('Camera unavailable. Choose a photo or try a physical device.'); }} /> : null}
      {photos[angle] ? <Image accessibilityLabel={`${angle} capture preview`} source={{ uri: photos[angle] }} style={{ width: '100%', height: 220, borderRadius: 16 }} resizeMode="contain" /> : null}
      {!cameraEnabled ? <Button title="Enable camera" disabled={task.busy} onPress={() => void task.run(async () => {
        const result = permission?.granted ? permission : await requestPermission();
        if (!result.granted) throw new Error('Camera permission is required. You can allow it in Settings or choose a photo.');
        if (task.mounted.current) { setReady(false); setCameraEnabled(true); }
      })} /> : <Button title={photos[angle] ? `Retake ${angle}` : `Take ${angle} photo`} disabled={task.busy || !ready || !cameraVisible} onPress={() => void task.run(async () => {
        const target = angle;
        const photo = await camera.current?.takePictureAsync({ quality: 0.9, exif: false });
        if (!photo) throw new Error('Camera is not ready. Try again.');
        await keep(photo.uri, photo.width, photo.height, target);
      })} />}
      {cameraEnabled ? <Button secondary title="Close camera" disabled={task.busy} onPress={() => setCameraEnabled(false)} /> : null}
      {permission && !permission.granted && !permission.canAskAgain ? <Button secondary title="Open device settings" onPress={() => void Linking.openSettings()} /> : null}
      <Button secondary title={`Choose ${angle} photo`} disabled={task.busy} onPress={() => void task.run(pick)} />
      <Copy>Photo selection also lets you test without an emulator camera. Only the selected views will be uploaded.</Copy>
    </Card>
    <Card><Heading>Review and upload</Heading>
      <Copy>{ANGLES.filter(item => photos[item]).length} of 3 views ready. Your photos will be stored and processed by {api.endpoint}. You can delete saved scans in History.</Copy>
      <Copy>I consent to upload these face photos for skin analysis.</Copy>
      <Switch accessibilityLabel="Consent to upload face photos" value={consent} onValueChange={setConsent} disabled={task.busy} />
      <Button title={task.busy ? 'Please wait…' : 'Upload to my journal'} disabled={task.busy || !consent || ANGLES.some(item => !photos[item])} onPress={() => void task.run(async () => {
        const form = new FormData();
        for (const item of ANGLES) {
          const uri = photosRef.current[item]!;
          if (Platform.OS === 'web') form.append(item, await (await fetch(uri)).blob(), `${item}.jpg`);
          else form.append(item, { uri, type: 'image/jpeg', name: `${item}.jpg` } as unknown as Blob);
        }
        form.append('consent', 'true'); form.append('capture_mode', 'camera');
        await api.request<Scan>('/scans', { method: 'POST', body: form });
        if (task.mounted.current) { reset(); setNotice('Photos saved. Open History to run the analysis.'); router.navigate('/(tabs)'); }
      })} />
      <Button secondary title="Discard local photos" disabled={task.busy} onPress={() => { reset(); setNotice('Local photos discarded.'); }} />
    </Card>
  </Screen>;
}
