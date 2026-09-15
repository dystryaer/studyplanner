import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlannerSession } from '../data/plannerSession.js';
import { createInitialPlannerState } from '../domain/plannerState.js';
import { createRemotePlannerApi } from '../api/remotePlannerApi.js';
import { supabase } from '../api/supabaseClient.js';
import { acquirePlannerLock } from '../data/plannerLock.js';

const remote = createRemotePlannerApi(supabase);

export function usePlannerStore(userId) {
  const activeSession = useRef(null);
  const [snapshot, setSnapshot] = useState(() => ({
    data: createInitialPlannerState(), status: 'loading', canEdit: false, error: null,
  }));
  const [weekOffset, setWeekOffset] = useState(0);
  const [sidebarMode, setSidebarMode] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [today, setToday] = useState(() => new Date());
  const [systemTheme, setSystemTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  useEffect(() => {
    let mounted = true;
    const session = createPlannerSession({ userId, storage: localStorage, remote, clock: () => new Date(), acquireLock: acquirePlannerLock });
    activeSession.current = session;
    const update = () => { if (mounted) setSnapshot(session.getSnapshot()); };
    const unsubscribe = session.subscribe(update);
    update();
    session.start().catch(error => {
      if (mounted) setSnapshot(current => ({ ...current, status: 'error', error, canEdit: false }));
    });
    const advance = () => {
      const now = new Date();
      setToday(current => current.toDateString() === now.toDateString() ? current : now);
      session.dispatch({ type: 'APPLY_TIME_RULES' });
    };
    const online = () => { session.retry(); };
    const visible = () => { if (document.visibilityState === 'visible') advance(); };
    const timer = setInterval(advance, 30000);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    return () => {
      mounted = false;
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
      session.dispose();
      if (activeSession.current === session) activeSession.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  const theme = snapshot.data.userSettings.theme ?? systemTheme;
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const dispatch = useCallback(action => activeSession.current?.dispatch(action) ?? false, []);
  const retrySync = useCallback(() => activeSession.current?.retry(), []);
  const resolveConflict = useCallback(choice => activeSession.current?.resolveConflict(choice), []);
  const exportLocal = useCallback(() => activeSession.current?.exportLocal(), []);
  const exportLegacy = useCallback(() => activeSession.current?.exportLegacy(), []);
  return {
    ...snapshot, dispatch, retrySync, resolveConflict, exportLocal, exportLegacy,
    theme, today, weekOffset, setWeekOffset, sidebarMode, setSidebarMode,
    calendarDate, setCalendarDate, selectedDate, setSelectedDate,
  };
}
