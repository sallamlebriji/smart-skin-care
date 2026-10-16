import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Busy, Card, Copy, Heading, Notice, Screen, colors } from '../../components/ui';
import { measuredMetrics, type Scan } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useRemote, useTask } from '../../lib/hooks';

export default function History() {
  const { api } = useSession();
  const load = useCallback(() => api.request<Scan[]>('/scans'), [api]);
  const scans = useRemote(load);
  const task = useTask();
  const [selected, setSelected] = useState<string[]>([]);
  const comparison = selected.map(id => scans.value?.find(scan => scan.scan_id === id)).filter((scan): scan is Scan => !!scan);
  function compare(scan: Scan) {
    setSelected(previous => previous.includes(scan.scan_id) ? previous.filter(id => id !== scan.scan_id) : [...previous.slice(-1), scan.scan_id]);
  }
  function remove(scan: Scan) {
    Alert.alert('Delete this scan?', 'This permanently removes its photos and results from your account.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void task.run(async () => {
        await api.request(`/scans/${scan.scan_id}`, { method: 'DELETE' });
        if (task.mounted.current) { setSelected(ids => ids.filter(id => id !== scan.scan_id)); scans.reload(); }
      }) },
    ]);
  }
  return <Screen title="Your skin journal" subtitle="Follow real measurements across your captures.">
    <Button title="New capture" onPress={() => router.navigate('/(tabs)/scan')} />
    <Notice error>{scans.error || task.error}</Notice>
    <Button secondary title="Refresh history" disabled={scans.loading || task.busy} onPress={scans.reload} />
    {scans.loading || task.busy ? <Busy /> : null}
    <Notice>Acne scores are experimental model outputs; higher means clearer appearance. Simulated indicators are excluded. Wrinkle detection estimates presence, not mild / moderate / marked severity. These are not medical diagnoses.</Notice>
    {comparison.length === 2 ? <Card><Heading>Compare captures</Heading>
      <Copy>{new Date(comparison[0].created_at).toLocaleDateString()} → {new Date(comparison[1].created_at).toLocaleDateString()}</Copy>
      {Object.entries(measuredMetrics(comparison[0])).filter(([key]) => key in measuredMetrics(comparison[1])).map(([key, value]) => {
        const next = measuredMetrics(comparison[1])[key];
        return <Copy key={key}>{key}: {value.toFixed(0)} → {next.toFixed(0)} ({next - value > 0 ? '+' : ''}{(next - value).toFixed(0)})</Copy>;
      })}
      <Copy>Only indicators measured in both captures appear. Changes in lighting and pose can affect the result.</Copy>
    </Card> : null}
    {scans.value?.length === 0 ? <Card><Heading>Your journal starts here</Heading><Copy>Capture three views to save your first scan.</Copy></Card> : null}
    {scans.value?.map(scan => <Card key={scan.scan_id}>
      <Heading>{new Date(scan.created_at).toLocaleString()}</Heading>
      {scan.result ? <View style={{ gap: 10 }}>{Object.entries(measuredMetrics(scan)).map(([key, value]) =>
        <Text key={key} style={{ color: colors.ink, fontSize: 18 }}>{key}: {value.toFixed(0)} / 100</Text>)}
        {scan.result.mock_metrics.length ? <Copy>{scan.result.mock_metrics.length} simulated indicators hidden.</Copy> : null}
      </View> : <Copy>Photos saved. Analysis is pending.</Copy>}
      {scan.wrinkle_assessment ? <Copy>Wrinkle presence: {scan.wrinkle_assessment.label === 'wrinkle' ? 'detected' : 'not detected'} · model probability {(scan.wrinkle_assessment.wrinkle_probability * 100).toFixed(0)}% · experimental</Copy> : null}
      <Button title={scan.result ? 'Run acne analysis again' : 'Analyze acne'} disabled={task.busy} onPress={() => void task.run(async () => {
        await api.post(`/scans/${scan.scan_id}/analyze`); if (task.mounted.current) scans.reload();
      })} />
      <Button secondary title="Detect wrinkle presence" disabled={task.busy} onPress={() => void task.run(async () => {
        await api.post(`/scans/${scan.scan_id}/analyze-wrinkles`); if (task.mounted.current) scans.reload();
      })} />
      {scan.result ? <Button secondary title={selected.includes(scan.scan_id) ? 'Remove from comparison' : 'Select for comparison'} onPress={() => compare(scan)} /> : null}
      <Button secondary title="Delete scan" disabled={task.busy} onPress={() => remove(scan)} />
    </Card>)}
  </Screen>;
}
