import '../styles/planner-status.css';

function download(text, name) {
  if (!text) return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PlannerStatus({ planner }) {
  const messages = {
    loading: 'Loading your planner…',
    ready: 'Saved',
    saving: 'Saving…',
    offline: 'Offline. Your changes are saved on this device.',
    conflict: 'Your planner changed on another device. Choose which version to keep. A recovery copy will be saved.',
    locked: 'Your planner is open in another tab. Close that tab, then try again.',
    error: 'Changes could not be saved. Keep this page open and copy any unsaved text before trying again.',
  };
  return <section className="planner-status" aria-label="Save status" aria-live="polite">
    {import.meta.env.VITE_DEV_DEMO === 'true' && <span>Local demo · </span>}
    <span>{messages[planner.status]}</span>
    {planner.status === 'conflict' && <>
      <button onClick={() => planner.resolveConflict('local')}>Keep this device</button>
      <button onClick={() => planner.resolveConflict('remote')}>Use server version</button>
    </>}
    {['offline', 'error', 'locked'].includes(planner.status) && <button onClick={planner.retrySync}>Try again</button>}
    {['ready', 'saving', 'offline', 'error', 'conflict'].includes(planner.status) && <button onClick={() => download(planner.exportLocal(), 'planner-backup.json')}>{planner.status === 'error' ? 'Export saved data' : 'Export backup'}</button>}
    {planner.legacyAvailable && <button onClick={() => download(planner.exportLegacy(), 'planner-legacy-backup.json')}>Export older local data</button>}
  </section>;
}
