const STORAGE_KEY = "smc_sessions_v1";

export const appState = {
  sessions: [],
  activeSessionId: null,
  preferences: {
    trainingMode: false
  }
};

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const SessionStore = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      appState.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      appState.activeSessionId = parsed.activeSessionId ?? null;
      appState.preferences = parsed.preferences || { trainingMode: false };
    } catch (err) {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  },
  createSession(symbol, mode = "SWING") {
    const clean = symbol.trim().toUpperCase();
    if (!clean) return null;
    const validMode = mode ? mode : "SWING";
    const now = Date.now();
    const session = {
      id: generateId(),
      symbol: clean,
      mode: validMode,
      createdAt: now,
      updatedAt: now,
      currentState: "START",
      checkedSteps: [],
      bias: "UNKNOWN",
      valueZone: "UNKNOWN",
      notes: "",
      orderType: null,
      seenSteps: [],
      messages: [],
      transitions: []
    };
    appState.sessions.unshift(session);
    appState.activeSessionId = session.id;
    this.save();
    return session;
  },
  deleteSession(id) {
    appState.sessions = appState.sessions.filter((s) => s.id !== id);
    if (appState.activeSessionId === id) {
      appState.activeSessionId = appState.sessions[0]?.id || null;
    }
    this.save();
  },
  setActiveSession(id) {
    appState.activeSessionId = id;
    this.save();
  },
  getActiveSession() {
    return appState.sessions.find((s) => s.id === appState.activeSessionId) || null;
  },
  updateSession(id, patch) {
    const session = appState.sessions.find((s) => s.id === id);
    if (!session) return null;
    Object.assign(session, patch);
    session.updatedAt = Date.now();
    this.save();
    return session;
  },
  addMessage(sessionId, text) {
    const session = appState.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const clean = text.trim();
    if (!clean) return;
    session.messages.push({ id: generateId(), ts: Date.now(), text: clean });
    session.updatedAt = Date.now();
    this.save();
  },
  addTransition(sessionId, from, to, type = "ok") {
    const session = appState.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    session.transitions.push({ ts: Date.now(), from, to, type });
    session.updatedAt = Date.now();
    this.save();
  },
  resetSession(sessionId) {
    const session = appState.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    Object.assign(session, {
      currentState: "START",
      checkedSteps: [],
      bias: "UNKNOWN",
      valueZone: "UNKNOWN",
      notes: "",
      orderType: null,
      seenSteps: [],
      messages: [],
      transitions: []
    });
    session.updatedAt = Date.now();
    this.save();
  },
  duplicateSession(sessionId) {
    const original = appState.sessions.find((s) => s.id === sessionId);
    if (!original) return null;
    const now = Date.now();
    const duplicate = {
      ...original,
      id: generateId(),
      symbol: `${original.symbol} (Copie)`,
      createdAt: now,
      updatedAt: now,
      messages: [...original.messages],
      transitions: [...original.transitions],
      checkedSteps: [...original.checkedSteps],
      seenSteps: [...original.seenSteps]
    };
    appState.sessions.unshift(duplicate);
    this.save();
    return duplicate;
  },
  exportSession(sessionId) {
    const session = appState.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smc-session-${session.symbol || session.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};
