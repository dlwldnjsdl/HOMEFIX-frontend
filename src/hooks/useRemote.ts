import { useCallback, useEffect, useState } from 'react';
export function useRemote<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown> = []) {
    const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
    // The consumer provides stable values (IDs and role), not a new callback identity.
    const refresh = useCallback(async () => { setLoading(true); try {
        setData(await load());
        setError(null);
    }
    catch (e: any) {
        setError(e.message || '조회 실패');
    }
    finally {
        setLoading(false);
    } }, deps);
    useEffect(() => { void refresh(); }, [refresh]);
    return { data, setData, loading, error, refresh };
}
