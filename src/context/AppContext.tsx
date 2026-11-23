import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Session } from '../types/models';
export type Screen = 'home' | 'login' | 'signup' | 'new' | 'requests' | 'detail' | 'ai' | 'solutions' | 'quotes' | 'candidates' | 'experts' | 'expert' | 'bookings' | 'booking' | 'records' | 'report' | 'consultations' | 'consultation' | 'profile' | 'tech' | 'tech-profile' | 'tech-schedule' | 'tech-routes' | 'tech-cases' | 'privacy';
export interface Route {
    screen: Screen;
    id?: string;
    from?: Screen;
}
export interface ToastState {
    id: number;
    message: string;
    kind: 'error' | 'success';
    leaving: boolean;
}
interface Context {
    session: Session | null;
    initializing: boolean;
    route: Route;
    history: Route[];
    setSession(s: Session | null): void;
    refreshSession(): Promise<void>;
    navigate(screen: Screen, id?: string): void;
    back(): void;
    notice(message: string, kind?: 'error' | 'success'): void;
    toast: ToastState | null;
    clearToast(): void;
    mutate<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined>;
    busy: boolean;
}
const AppCtx = createContext<Context | null>(null);
function currentRoute(): Route { const raw = location.hash.replace(/^#\/?/, ''); const [screen, ...rest] = raw.split('/'); const valid: Screen[] = ['home', 'login', 'signup', 'new', 'requests', 'detail', 'ai', 'solutions', 'quotes', 'candidates', 'experts', 'expert', 'bookings', 'booking', 'records', 'report', 'consultations', 'consultation', 'profile', 'tech', 'tech-profile', 'tech-schedule', 'tech-routes', 'tech-cases', 'privacy']; return { screen: valid.includes(screen as Screen) ? screen as Screen : 'home', id: rest.length ? decodeURIComponent(rest.join('/')) : undefined }; }
export function AppProvider({ children }: {
    children: ReactNode;
}) {
    const [session, setSession] = useState<Session | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [route, setRoute] = useState<Route>(currentRoute);
    const [history, setHistory] = useState<Route[]>([]);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [busy, setBusy] = useState(false);
    const toastSeqRef = useRef(0);
    const fadeTimerRef = useRef<number | null>(null);
    const clearTimerRef = useRef<number | null>(null);

    const resetToastTimers = useCallback(() => {
        if (fadeTimerRef.current !== null) {
            window.clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = null;
        }
        if (clearTimerRef.current !== null) {
            window.clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
        }
    }, []);

    const clearToast = useCallback(() => {
        resetToastTimers();
        setToast(null);
    }, [resetToastTimers]);

    const notice = useCallback((message: string, kind: 'error' | 'success' = 'success') => {
        resetToastTimers();
        const nextId = ++toastSeqRef.current;
        const holdMs = kind === 'error' ? 4000 : 2600;
        const fadeMs = 350;
        setToast({ id: nextId, message, kind, leaving: false });
        fadeTimerRef.current = window.setTimeout(() => {
            setToast(prev => (prev && prev.id === nextId ? { ...prev, leaving: true } : prev));
        }, holdMs);
        clearTimerRef.current = window.setTimeout(() => {
            setToast(prev => (prev && prev.id === nextId ? null : prev));
        }, holdMs + fadeMs);
    }, [resetToastTimers]);

    useEffect(() => resetToastTimers, [resetToastTimers]);
    const refreshSession = useCallback(async () => { try {
        setSession(await api.me() as Session);
    }
    catch (e: any) {
        if (e.status === 401 || e.status === 403)
            setSession(null);
        else
            notice('계정 상태를 확인하지 못했어요.', 'error');
    } }, [notice]);
    useEffect(() => { void refreshSession().finally(() => setInitializing(false)); }, [refreshSession]);
    useEffect(() => { const handler = () => setRoute(currentRoute()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
    const navigate = useCallback((screen: Screen, id?: string) => { setHistory(h => [...h.slice(-20), currentRoute()]); const next = `#/${screen}${id ? `/${encodeURIComponent(id)}` : ''}`; if (location.hash === next)
        setRoute({ screen, id });
    else
        location.hash = next; document.querySelector('.page-content')?.scrollTo({ top: 0 }); }, []);
    const back = useCallback(() => { const prev = history.at(-1) || { screen: 'home' as Screen }; setHistory(h => h.slice(0, -1)); const next = `#/${prev.screen}${prev.id ? `/${encodeURIComponent(prev.id)}` : ''}`; if (location.hash === next)
        setRoute(prev);
    else
        location.hash = next; document.querySelector('.page-content')?.scrollTo({ top: 0 }); }, [history]);
    const mutate = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => { setBusy(true); try {
        const output = await fn();
        if (success)
            notice(success);
        return output;
    }
    catch (e: any) {
        notice(e?.message || '요청 중 문제가 발생했어요.', 'error');
        return undefined;
    }
    finally {
        setBusy(false);
    } }, [notice]);
    const value = useMemo(() => ({ session, initializing, route, history, setSession, refreshSession, navigate, back, notice, toast, clearToast, mutate, busy }), [session, initializing, route, history, refreshSession, navigate, back, notice, toast, clearToast, mutate, busy]);
    return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export function useApp() { const ctx = useContext(AppCtx); if (!ctx)
    throw Error('AppProvider가 필요해요.'); return ctx; }
