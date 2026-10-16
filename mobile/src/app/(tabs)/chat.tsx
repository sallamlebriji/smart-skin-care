import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Button, Busy, Card, Copy, Field, Heading, Notice, Screen, colors } from '../../components/ui';
import type { Conversation } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRemote, useTask } from '../../lib/hooks';

export default function Chat() {
  const { api } = useSession();
  const history = useRemote(useCallback(() => api.request<Conversation>('/chat/history'), [api]));
  const [message, setMessage] = useState('');
  const [allowExternal, setAllowExternal] = useState(false);
  const [provider, setProvider] = useState('');
  const task = useTask();
  function clear() {
    Alert.alert('Clear conversation?', 'Your saved messages will be permanently deleted.', [{ text: 'Cancel', style: 'cancel' }, {
      text: 'Delete', style: 'destructive', onPress: () => void task.run(async () => {
        await api.request('/chat/history', { method: 'DELETE' });
        if (task.mounted.current) { history.reload(); setProvider(''); }
      }),
    }]);
  }
  return <Screen title="Let’s talk skin" subtitle="Ask about your saved measurements or daily routine.">
    <Notice error>{task.error || history.error}</Notice>
    <Notice>General guidance only. For a diagnosis or treatment, consult a qualified clinician.</Notice>
    {history.value?.messages.map(item => <Card key={item.id}><Heading>{item.role === 'user' ? 'You' : 'Skin guide'}</Heading><Copy>{item.content}</Copy></Card>)}
    {history.value?.messages.length === 0 ? <Card><Copy>Your conversation will appear here.</Copy></Card> : null}
    {history.loading || task.busy ? <Busy /> : null}
    <Card>
      <Field label="Your message" value={message} onChangeText={setMessage} maxLength={2000} multiline editable={!task.busy} />
      {history.value?.ai_available ? <View style={{ gap: 8 }}>
        <Copy>Allow this message, recent conversation, measured scan scores and routine to be sent to the external AI provider. Photos are not included.</Copy>
        <Switch accessibilityLabel="Allow external AI" value={allowExternal} onValueChange={setAllowExternal} disabled={task.busy} trackColor={{ true: colors.primary }} />
      </View> : <Copy>Local guidance is available. External AI is not configured.</Copy>}
      <Button title={task.busy ? 'Sending…' : 'Send message'} disabled={task.busy || !message.trim() || history.loading} onPress={() => void task.run(async () => {
        const response = await api.post<{ answer: string; provider: string }>('/chat', { message, allow_external_ai: allowExternal && !!history.value?.ai_available });
        if (task.mounted.current) { setMessage(''); setProvider(response.provider); history.reload(); }
      })} />
      {provider ? <Copy>Last response: {provider === 'local' ? 'local guidance' : 'external AI'}.</Copy> : null}
      <Button secondary title="Refresh conversation" onPress={history.reload} disabled={task.busy || history.loading} />
      <Button secondary title="Clear conversation" onPress={clear} disabled={task.busy || history.loading} />
    </Card>
  </Screen>;
}
