import { useCallback, useState, type SetStateAction } from 'react';
import { Button, Busy, Card, Copy, Field, Heading, Notice, Screen } from '../../components/ui';
import type { Routine, Scan } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRemote, useTask } from '../../lib/hooks';

export default function RoutineScreen() {
  const { api } = useSession();
  const saved = useRemote(useCallback(() => api.request<Routine | null>('/routine/saved'), [api]));
  const [draft, setDraft] = useState<Routine | null>(null);
  const routine = draft ?? saved.value ?? { morning: [], evening: [] };
  const dirty = draft !== null;
  function setRoutine(value: SetStateAction<Routine>) {
    setDraft(previous => typeof value === 'function' ? value(previous ?? saved.value ?? { morning: [], evening: [] }) : value);
  }
  const [notice, setNotice] = useState('');
  const task = useTask();
  function edit(period: keyof Routine, index: number, key: 'name' | 'frequency', value: string) {
    setNotice('');
    setRoutine(previous => ({ ...previous, [period]: previous[period].map((step, i) => i === index ? { ...step, [key]: value } : step) }));
  }
  return <Screen title="A little care, daily" subtitle="Build a routine you can keep. Save changes to sync them with your account.">
    <Notice error>{task.error || saved.error}</Notice><Notice>{notice}</Notice>
    {saved.loading || task.busy ? <Busy /> : null}
    <Button secondary title="Build from latest analyzed scan" disabled={task.busy || saved.loading || dirty} onPress={() => void task.run(async () => {
      const scans = await api.request<Scan[]>('/scans');
      const latest = scans.find(scan => scan.result);
      if (!latest) throw new Error('Analyze a scan in History first.');
      const draft = await api.request<Routine>(`/routine?scan_id=${encodeURIComponent(latest.scan_id)}`);
      if (task.mounted.current) { setRoutine(draft); setNotice('Draft created from measured indicators only. Review, then save.'); }
    })} />
    {(['morning', 'evening'] as const).map(period => <Card key={period}>
      <Heading>{period === 'morning' ? 'Morning' : 'Evening'}</Heading>
      {!routine[period].length ? <Copy>No steps yet.</Copy> : null}
      {routine[period].map((step, index) => <Card key={index}>
        <Field label={`Step ${index + 1}`} value={step.name} maxLength={200} editable={!task.busy} onChangeText={value => edit(period, index, 'name', value)} />
        <Field label="Frequency" value={step.frequency ?? ''} maxLength={100} editable={!task.busy} onChangeText={value => edit(period, index, 'frequency', value)} />
        {step.reason ? <Copy>{step.reason}</Copy> : null}
        <Button secondary title="Remove step" disabled={task.busy} onPress={() => {
          setRoutine(previous => ({ ...previous, [period]: previous[period].filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i + 1 })) }));
        }} />
      </Card>)}
      <Button secondary title="Add step" disabled={task.busy || routine[period].length >= 20} onPress={() => {
        setRoutine(previous => ({ ...previous, [period]: [...previous[period], { order: previous[period].length + 1, name: '', frequency: 'Daily' }] }));
      }} />
    </Card>)}
    <Button title={task.busy ? 'Saving…' : 'Save routine'} disabled={task.busy || saved.loading || !dirty || [...routine.morning, ...routine.evening].some(step => !step.name.trim())} onPress={() => void task.run(async () => {
      const result = await api.put<Routine>('/routine', routine);
      if (task.mounted.current) { saved.setValue(result); setDraft(null); setNotice('Routine saved.'); }
    })} />
    <Button secondary title="Reload saved routine (discard edits)" disabled={task.busy || saved.loading} onPress={() => { setDraft(null); setNotice(''); saved.reload(); }} />
  </Screen>;
}
