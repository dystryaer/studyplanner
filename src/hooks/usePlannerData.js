import { usePlannerStore } from './usePlannerStore.js';
import { usePlannerSelectors } from './usePlannerSelectors.js';
import { usePlannerActions } from './usePlannerActions.js';

export function usePlannerData(userId) {
  const store = usePlannerStore(userId);
  const selectors = usePlannerSelectors({
    data: store.data, weekOffset: store.weekOffset, calendarDate: store.calendarDate,
    selectedDate: store.selectedDate, today: store.today,
  });
  const actions = usePlannerActions({
    dispatch: store.dispatch, activeWeekKey: selectors.activeWeekKey, setWeekOffset: store.setWeekOffset,
  });
  return { ...store, ...selectors, ...actions };
}
