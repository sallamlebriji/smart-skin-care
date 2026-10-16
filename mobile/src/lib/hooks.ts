import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { messageOf } from './api';

export function useTask() {
  const mounted = useRef(true);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (error) { if (mounted.current) setError(messageOf(error)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, []);
  return { busy, error, run, mounted };
}

/** Refresh when a tab becomes visible; discard results after blur/account changes. */
export function useRemote<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    void revision;
    let active = true;
    setLoading(true); setError('');
    load().then(result => { if (active) setValue(result); })
      .catch(error => { if (active) setError(messageOf(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // revision deliberately invalidates a completed request after a mutation.
  }, [load, revision]));
  return { value, setValue, error, loading, reload: () => setRevision(value => value + 1) };
}
