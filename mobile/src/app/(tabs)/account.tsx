import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';
import { Button, Busy, Card, Copy, Field, Heading, Notice, Screen } from '../../components/ui';
import type { Profile } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRemote, useTask } from '../../lib/hooks';

export default function Account() {
  const { api, user, logout } = useSession();
  const profile = useRemote(useCallback(() => api.request<Profile>('/profile'), [api]));
  const [override, setDraft] = useState<Profile | null>(null);
  const draft = override ?? profile.value ?? { display_name: '', skin_type: null, goals: [], consent_data_use: false };
  const [goalText, setGoals] = useState<string | null>(null);
  const goals = goalText ?? draft.goals.join(', ');
  const dirty = override !== null || goalText !== null;
  const [notice, setNotice] = useState('');
  const task = useTask();
  function patch(value: Partial<Profile>) { setNotice(''); setDraft({ ...draft, ...value }); }
  return <Screen title="Make yourself at home" subtitle={user?.email}>
    <Notice error>{task.error || profile.error}</Notice><Notice>{notice}</Notice>
    {profile.loading || task.busy ? <Busy /> : null}
    <Card><Heading>Your profile</Heading>
      <Field label="Display name" value={draft.display_name} maxLength={80} editable={!task.busy && !!profile.value} onChangeText={display_name => patch({ display_name })} />
      <Copy>Skin type (self-reported)</Copy>
      {(['dry', 'oily', 'combination', 'normal', 'sensitive', null] as const).map(skin_type => <Button key={skin_type ?? 'unset'} secondary
        title={`${draft.skin_type === skin_type ? '✓ ' : ''}${skin_type ?? 'Not specified'}`} disabled={task.busy || !profile.value} onPress={() => patch({ skin_type })} />)}
      <Field label="Goals (separate with commas, maximum 10)" value={goals} editable={!task.busy && !!profile.value} onChangeText={setGoals} />
      <View><Copy>Allow use of my profile data for personalization.</Copy><Switch accessibilityLabel="Profile data consent" value={draft.consent_data_use} disabled={task.busy || !profile.value} onValueChange={consent_data_use => patch({ consent_data_use })} /></View>
      <Button title="Save profile" disabled={task.busy || !profile.value || !dirty} onPress={() => void task.run(async () => {
        const items = goals.split(',').map(value => value.trim()).filter(Boolean);
        if (items.length > 10 || items.some(item => item.length > 100)) throw new Error('Use at most 10 goals, each under 100 characters.');
        const updated = await api.put<Profile>('/profile', { ...draft, goals: items });
        if (task.mounted.current) { profile.setValue(updated); setDraft(null); setGoals(null); setNotice('Profile saved.'); }
      })} />
      <Button secondary title="Reload profile (discard edits)" disabled={task.busy || profile.loading} onPress={() => { setDraft(null); setGoals(null); profile.reload(); }} />
    </Card>
    <Card><Heading>Connection</Heading><Copy>{api.endpoint}</Copy><Copy>To change servers, sign out first. Your captures and conversations stay with their original server account.</Copy>
      <Button title="Sign out" disabled={task.busy} onPress={() => void task.run(logout)} />
    </Card>
  </Screen>;
}
