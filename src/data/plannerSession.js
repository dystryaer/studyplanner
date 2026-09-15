import {
  applyTimeRules,
  createInitialPlannerState,
  parsePlannerState,
} from "../domain/plannerState.js";
import { plannerReducer } from "../reducers/plannerReducer.js";

export const LEGACY_STORAGE_KEY = "studyplanner-app-v1";
export const ENVELOPE_VERSION = 2;

const RETRY_DELAYS_MS = [3000, 10000, 30000, 60000];
const RECOVERY_LIMIT = 10;

export function getLocalStorageKey(userId) {
  return `studyplanner:v2:${userId}`;
}

export function getRecoveryStorageKey(userId) {
  return `studyplanner:v2:${userId}:recovery`;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRevision(value) {
  return Number.isInteger(value) && value >= 0;
}

function isOptionalRevision(value) {
  return value === null || isRevision(value);
}

function isOptionalString(value) {
  return value === null || typeof value === "string";
}

function asError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function isOfflineError(error) {
  if (error?.kind === "offline" || error?.offline === true) return true;
  if (globalThis.navigator?.onLine === false) return true;
  return error?.name === "TypeError" && /fetch|network|load failed/i.test(String(error?.message));
}

function createEnvelope(userId, data) {
  return { version: ENVELOPE_VERSION, userId, data, baseRevision: null, localSeq: 0, ackedSeq: 0, pending: null };
}

function parsePending(value) {
  if (
    !isRecord(value) ||
    typeof value.mutationId !== "string" ||
    !isRevision(value.seq) ||
    !isOptionalRevision(value.expectedRevision)
  ) {
    throw new Error("Local planner envelope has an invalid pending mutation");
  }
  return Object.freeze({
    mutationId: value.mutationId,
    seq: value.seq,
    expectedRevision: value.expectedRevision,
    data: parsePlannerState(value.data),
  });
}

export function parseEnvelope(raw, userId) {
  if (!isRecord(raw)) throw new Error("Local planner envelope must be an object");
  if (raw.version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported local planner envelope version ${String(raw.version)}`);
  }
  if (raw.userId !== userId) throw new Error("Local planner envelope belongs to another account");
  if (!isOptionalRevision(raw.baseRevision)) {
    throw new Error("Local planner envelope has an invalid base revision");
  }
  if (!isRevision(raw.localSeq) || !isRevision(raw.ackedSeq) || raw.ackedSeq > raw.localSeq) {
    throw new Error("Local planner envelope has invalid sequence numbers");
  }
  return {
    version: ENVELOPE_VERSION,
    userId,
    data: parsePlannerState(raw.data),
    baseRevision: raw.baseRevision,
    localSeq: raw.localSeq,
    ackedSeq: raw.ackedSeq,
    pending: raw.pending === null || raw.pending === undefined ? null : parsePending(raw.pending),
  };
}

export function parseRemoteRecord(value) {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !isRevision(value.revision) ||
    !isOptionalString(value.mutationId)
  ) {
    throw new Error("Remote planner read returned an invalid envelope");
  }
  return { data: value.data, revision: value.revision, mutationId: value.mutationId };
}

export function parseSaveResult(value) {
  if (isRecord(value)) {
    if (value.outcome === "saved" && isRevision(value.revision) && typeof value.mutationId === "string") {
      return { outcome: "saved", revision: value.revision, mutationId: value.mutationId };
    }
    if (
      value.outcome === "conflict" &&
      isOptionalRevision(value.revision) &&
      isOptionalString(value.mutationId)
    ) {
      return { outcome: "conflict", revision: value.revision, mutationId: value.mutationId };
    }
  }
  throw new Error("Remote planner save returned an invalid envelope");
}

export function createPlannerSession({ userId, storage, remote, clock = () => new Date(), acquireLock }) {
  if (typeof userId !== "string" || userId === "") {
    throw new TypeError("createPlannerSession requires a userId");
  }
  if (typeof storage?.getItem !== "function" || typeof storage?.setItem !== "function") {
    throw new TypeError("createPlannerSession requires storage with getItem and setItem");
  }
  if (typeof remote?.read !== "function" || typeof remote?.save !== "function") {
    throw new TypeError("createPlannerSession requires remote with read and save");
  }
  if (typeof clock !== "function") throw new TypeError("createPlannerSession requires a clock function");
  if (typeof acquireLock !== "function") {
    throw new TypeError("createPlannerSession requires acquireLock; it refuses to run without a writer lock");
  }

  const key = getLocalStorageKey(userId);
  const recoveryKey = getRecoveryStorageKey(userId);
  const listeners = new Set();

  let phase = "idle";
  let fault = null;
  let envelope = createEnvelope(userId, createInitialPlannerState());
  let conflict = null;
  let inFlight = null;
  let reconciliation = null;
  let reconciled = false;
  let hydrated = false;
  let release = null;
  let generation = 0;
  let retryTimer = null;
  let retryAttempt = 0;
  let legacyAvailable = false;
  let snapshot = buildSnapshot();

  function canEdit() {
    return phase === "active" && hydrated && !conflict && !(fault && fault.kind !== "remote");
  }

  function computeStatus() {
    if (phase === "locked") return "locked";
    if (fault && fault.kind !== "remote") return "error";
    if (phase !== "active") return "loading";
    if (conflict) return "conflict";
    if (fault) return fault.offline ? "offline" : "error";
    if (inFlight || !reconciled || envelope.localSeq > envelope.ackedSeq) return "saving";
    return "ready";
  }

  function buildSnapshot() {
    return Object.freeze({
      data: envelope.data,
      status: computeStatus(),
      error: fault?.error ?? null,
      canEdit: canEdit(),
      conflict,
      legacyAvailable,
    });
  }

  function update() {
    const next = buildSnapshot();
    if (Object.keys(next).every((field) => next[field] === snapshot[field])) return;
    snapshot = next;
    for (const listener of [...listeners]) listener(snapshot);
  }

  function setFault(kind, error) {
    const wrapped = asError(error);
    fault = { kind, error: wrapped, offline: kind === "remote" && isOfflineError(wrapped) };
    update();
  }

  function clearRemoteFault() {
    if (fault?.kind === "remote") fault = null;
  }

  function settle() {
    reconciled = true;
    hydrated = true;
    applyCurrentTime();
    retryAttempt = 0;
    clearRemoteFault();
    update();
  }

  function commit(next) {
    if (phase !== "active" || fault?.kind === "corrupt") return false;
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch (error) {
      setFault("storage", error);
      return false;
    }
    envelope = next;
    if (fault?.kind === "storage") fault = null;
    update();
    return true;
  }

  function loadLocal() {
    let raw;
    try {
      raw = storage.getItem(key);
      hydrated = raw !== null;
      legacyAvailable = storage.getItem(LEGACY_STORAGE_KEY) !== null;
    } catch (error) {
      setFault("corrupt", error);
      return false;
    }
    try {
      envelope = raw === null
        ? createEnvelope(userId, createInitialPlannerState())
        : parseEnvelope(JSON.parse(raw), userId);
    } catch (error) {
      setFault("corrupt", error);
      return false;
    }
    return true;
  }

  function applyCurrentTime() {
    const timed = applyTimeRules(envelope.data, clock());
    return timed === envelope.data || commit({ ...envelope, data: timed, localSeq: envelope.localSeq + 1 });
  }

  async function begin() {
    const gen = generation;
    phase = "loading";
    fault = null;
    update();

    let lease;
    try {
      lease = await acquireLock(userId);
    } catch (error) {
      if (gen !== generation) return;
      phase = "idle";
      setFault("setup", error);
      return;
    }
    if (gen !== generation) {
      if (typeof lease === "function") lease();
      return;
    }
    if (typeof lease !== "function") {
      phase = "locked";
      loadLocal();
      update();
      return;
    }

    release = lease;
    phase = "active";
    if (!loadLocal()) return;
    update();
    await reconcile();
  }

  function adopt(record, current) {
    let data;
    try {
      data = parsePlannerState(record.data);
    } catch (error) {
      setFault("remote", error);
      return false;
    }
    return commit({ ...current, data, baseRevision: record.revision, ackedSeq: current.localSeq, pending: null });
  }

  function acknowledge(pending, revision) {
    if (envelope.pending?.mutationId !== pending.mutationId) return;
    if (!commit({ ...envelope, baseRevision: revision, ackedSeq: pending.seq, pending: null })) return;
    settle();
    flush();
  }

  function reconcile() {
    if (!reconciliation) {
      reconciliation = runReconcile().finally(() => { reconciliation = null; });
    }
    return reconciliation;
  }

  async function runReconcile() {
    const gen = generation;
    let record;
    try {
      record = parseRemoteRecord(await remote.read(userId));
    } catch (error) {
      if (gen !== generation) return;
      hydrated = true;
      setFault("remote", error);
      applyCurrentTime();
      scheduleRetry();
      return;
    }
    if (gen !== generation || (fault && fault.kind !== "remote")) return;

    const current = envelope;
    const dirty = current.localSeq > current.ackedSeq;
    if (record === null) {
      if (current.baseRevision !== null && !commit({ ...current, baseRevision: null, pending: null, localSeq: current.localSeq + 1 })) return;
      settle();
      flush();
      return;
    }
    if (current.pending && record.mutationId === current.pending.mutationId) {
      acknowledge(current.pending, record.revision);
      return;
    }
    if (!dirty) {
      if (record.revision !== current.baseRevision && !adopt(record, current)) return;
      settle();
      flush();
      return;
    }
    if (record.revision === current.baseRevision) {
      settle();
      flush();
      return;
    }
    conflict = Object.freeze({ remoteData: record.data, remoteRevision: record.revision });
    settle();
  }

  async function runSend(pending, gen) {
    let result;
    try {
      result = parseSaveResult(
        await remote.save(userId, {
          data: pending.data,
          expectedRevision: pending.expectedRevision,
          mutationId: pending.mutationId,
        })
      );
    } catch (error) {
      if (gen !== generation) return;
      inFlight = null;
      setFault("remote", error);
      scheduleRetry();
      return;
    }
    if (gen !== generation) return;

    if (result.outcome === "saved") {
      inFlight = null;
      if (result.mutationId !== pending.mutationId) {
        setFault("remote", new Error("Remote planner save acknowledged a different mutation"));
        scheduleRetry();
        return;
      }
      acknowledge(pending, result.revision);
      return;
    }

    let record;
    try {
      record = parseRemoteRecord(await remote.read(userId));
    } catch (error) {
      if (gen !== generation) return;
      inFlight = null;
      setFault("remote", error);
      scheduleRetry();
      return;
    }
    if (gen !== generation) return;
    inFlight = null;
    if (record === null) {
      if (commit({ ...envelope, baseRevision: null, pending: null })) flush();
      return;
    }
    if (record.mutationId === pending.mutationId) {
      acknowledge(pending, record.revision);
      return;
    }
    conflict = Object.freeze({ remoteData: record.data, remoteRevision: record.revision });
    settle();
  }

  function flush() {
    if (inFlight) return inFlight;
    if (phase !== "active" || !reconciled || conflict || (fault && fault.kind !== "remote")) return Promise.resolve();
    let pending = envelope.pending;
    if (!pending) {
      if (envelope.localSeq === envelope.ackedSeq) return Promise.resolve();
      pending = Object.freeze({
        mutationId: globalThis.crypto.randomUUID(),
        seq: envelope.localSeq,
        expectedRevision: envelope.baseRevision,
        data: envelope.data,
      });
      if (!commit({ ...envelope, pending })) return Promise.resolve();
    }
    inFlight = runSend(pending, generation);
    update();
    return inFlight;
  }

  function scheduleRetry() {
    if (retryTimer || phase !== "active" || ["schema", "auth", "invalid-data"].includes(fault?.error?.kind)) return;
    const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      retry();
    }, delay);
    retryTimer.unref?.();
  }

  async function retry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (phase === "idle" || phase === "locked") return begin();
    if (phase !== "active") return;
    if (inFlight) return inFlight;
    if (fault?.kind === "corrupt") {
      fault = null;
      reconciled = false;
      if (!loadLocal()) return;
    }
    if (fault?.kind === "storage" && !commit(envelope)) return;
    clearRemoteFault();
    update();
    if (!reconciled) return reconcile();
    return flush();
  }

  function dispatch(action) {
    if (!canEdit()) return false;
    const now = clock();
    const data = plannerReducer(applyTimeRules(envelope.data, now), action, now);
    if (data === envelope.data) return true;
    if (!commit({ ...envelope, data, localSeq: envelope.localSeq + 1 })) return false;
    flush();
    return true;
  }

  function readStored(storageKey) {
    let raw;
    try {
      raw = storage.getItem(storageKey);
    } catch {
      return null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  function archive(displaced) {
    const existing = readStored(recoveryKey);
    const entries = existing === null ? [] : Array.isArray(existing) ? existing : [{ unreadable: existing }];
    const next = [...entries, { archivedAt: clock().toISOString(), userId, ...displaced }].slice(-RECOVERY_LIMIT);
    try {
      storage.setItem(recoveryKey, JSON.stringify(next));
    } catch (error) {
      setFault("storage", error);
      return false;
    }
    return true;
  }

  function resolveConflict(choice) {
    if (choice !== "local" && choice !== "remote") {
      throw new TypeError(`Unknown conflict resolution "${String(choice)}"`);
    }
    if (!conflict || phase !== "active" || (fault && fault.kind !== "remote")) return false;
    const current = conflict;
    const displaced = choice === "local"
      ? { source: "remote", revision: current.remoteRevision, data: current.remoteData }
      : { source: "local", revision: envelope.baseRevision, data: envelope.data };
    if (!archive(displaced)) return false;
    conflict = null;
    const committed = choice === "local"
      ? commit({ ...envelope, baseRevision: current.remoteRevision, pending: null })
      : adopt({ data: current.remoteData, revision: current.remoteRevision }, envelope);
    if (!committed) {
      conflict = current;
      update();
      return false;
    }
    settle();
    flush();
    return true;
  }

  function exportLocal() {
    return JSON.stringify(
      { userId, exportedAt: clock().toISOString(), local: readStored(key), recovery: readStored(recoveryKey) },
      null,
      2
    );
  }

  function exportLegacy() {
    try {
      const raw = storage.getItem(LEGACY_STORAGE_KEY);
      return typeof raw === "string" ? raw : null;
    } catch {
      return null;
    }
  }

  function start() {
    if (phase !== "idle") return Promise.resolve();
    return begin();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose() {
    if (phase === "disposed") return;
    generation += 1;
    phase = "disposed";
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    inFlight = null;
    listeners.clear();
    const lease = release;
    release = null;
    if (lease) {
      try {
        lease();
      } catch {
        return;
      }
    }
  }

  return {
    userId,
    start,
    getSnapshot: () => snapshot,
    subscribe,
    dispatch,
    flush,
    retry,
    resolveConflict,
    exportLocal,
    exportLegacy,
    dispose,
  };
}
