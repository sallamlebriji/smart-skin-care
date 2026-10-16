import { useState } from 'react';
import { Button, Card, Copy, Field, Heading, Notice, Screen } from '../components/ui';
import { useSession } from '../lib/session';
import { messageOf } from '../lib/api';

export default function SignIn() {
  const { api, authenticate, startupError } = useSession();
  const [endpoint, setEndpoint] = useState(api.endpoint);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try { await authenticate(endpoint, register ? 'register' : 'login', email, password); }
    catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <Screen title="Your skin, over time." subtitle="A private space for your captures, routine and progress.">
    <Card><Heading>{register ? 'Create your account' : 'Welcome back'}</Heading>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!busy} />
      <Field label="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} />
      <Notice error>{error || startupError}</Notice>
      <Button title={busy ? 'Connecting…' : register ? 'Create account' : 'Sign in'} disabled={busy || !email.trim() || password.length < 8} onPress={() => void submit()} />
      <Button secondary title={register ? 'I already have an account' : 'Create an account'} disabled={busy} onPress={() => { setRegister(!register); setError(''); }} />
    </Card>
    <Card><Heading>Connect your server</Heading>
      <Field label="API server" value={endpoint} onChangeText={setEndpoint} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} />
      <Copy>Android emulator: http://10.0.2.2:8001. On a phone, enter your computer’s local network address. Both devices must share Wi-Fi. Use HTTPS outside local development.</Copy>
    </Card>
  </Screen>;
}
