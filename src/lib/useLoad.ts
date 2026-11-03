import { useCallback, useEffect, useState, type DependencyList } from 'react';

// Loads data when the page opens (and when deps change). `reload()` fetches again.
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    run()
      .then((value) => current && (setData(value), setError(null)))
      .catch((e) => current && setError(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [run]);

  return { data, error, loading, reload, setData };
}

// Runs an action (save, delete...) and keeps track of busy/error state for a form.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
