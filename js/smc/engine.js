// =====================================================
// SMC Engine (pure domain logic, no DOM)
// =====================================================

export function normalizeSession(session = {}) {
  return {
    ...session,
    currentState: session.currentState || "START",
    checkedSteps: Array.isArray(session.checkedSteps) ? session.checkedSteps : [],
    bias: session.bias || "UNKNOWN",
    valueZone: session.valueZone || "UNKNOWN",
    orderType: session.orderType ?? null,
    seenSteps: Array.isArray(session.seenSteps) ? session.seenSteps : []
  };
}

export function applyDerivedFields(session, newState) {
  let bias = session.bias || "UNKNOWN";
  let valueZone = session.valueZone || "UNKNOWN";
  let orderType = session.orderType ?? null;

  if (newState === "D1_BIAS_BULLISH") bias = "BULLISH";
  if (newState === "D1_BIAS_BEARISH") bias = "BEARISH";
  if (["START", "D1_STRUCTURE_OK", "D1_BOS_OK"].includes(newState)) {
    bias = "UNKNOWN";
  }

  if (newState === "D1_DISCOUNT_OK") valueZone = "DISCOUNT";
  if (newState === "D1_PREMIUM_OK") valueZone = "PREMIUM";
  if ([
    "START",
    "D1_STRUCTURE_OK",
    "D1_BOS_OK",
    "D1_BIAS_BULLISH",
    "D1_BIAS_BEARISH"
  ].includes(newState)) {
    valueZone = "UNKNOWN";
  }

  if (newState === "ORDER_LIMIT_READY") orderType = "LIMIT";
  if (newState === "WAIT_MARKET_CONFIRMATION") orderType = "MARKET";
  if (newState === "START" || newState === "M15_OB_OK") {
    orderType = null;
  }

  return { bias, valueZone, orderType };
}

export function computeCheckedStepsFromUI(checkedStates, stateFlow) {
  const set = new Set(checkedStates || []);
  return (stateFlow || []).filter((state) => set.has(state));
}

export function computeRollback(session, targetState, { stateFlow, stageRank }) {
  const normalized = normalizeSession(session);
  const targetRank = stageRank?.[targetState] ?? 0;
  const targetIndex = stateFlow?.indexOf(targetState) ?? -1;

  return normalized.checkedSteps.filter((state) => {
    const rank = stageRank?.[state] ?? 0;
    const index = stateFlow?.indexOf(state) ?? -1;
    const removeByRank = rank > targetRank;
    const removeByIndex = rank === targetRank && targetIndex !== -1 && index > targetIndex;
    return removeByRank || removeByIndex;
  });
}

export function applyState(session, newState, defs) {
  const normalized = normalizeSession(session);
  const checkedSet = new Set(normalized.checkedSteps);
  checkedSet.add(newState);

  const checkedSteps = computeCheckedStepsFromUI([...checkedSet], defs.stateFlow);
  const derived = applyDerivedFields(normalized, newState);

  return {
    patch: {
      currentState: newState,
      checkedSteps,
      bias: derived.bias,
      valueZone: derived.valueZone,
      orderType: derived.orderType,
      seenSteps: normalized.seenSteps
    },
    transition: { from: normalized.currentState, to: newState, type: "ok" }
  };
}

export function rollbackTo(session, targetState, defs) {
  const normalized = normalizeSession(session);
  const toRemove = computeRollback(normalized, targetState, defs);
  const checkedSet = new Set(normalized.checkedSteps);
  toRemove.forEach((state) => checkedSet.delete(state));

  if (targetState !== "START") {
    checkedSet.add(targetState);
  }

  const checkedSteps = computeCheckedStepsFromUI([...checkedSet], defs.stateFlow);
  const derived = applyDerivedFields(normalized, targetState);

  return {
    patch: {
      currentState: targetState,
      checkedSteps,
      bias: derived.bias,
      valueZone: derived.valueZone,
      orderType: derived.orderType,
      seenSteps: normalized.seenSteps
    },
    transition: { from: normalized.currentState, to: targetState, type: "warn" }
  };
}

export function applyChoice(session, groupId, selectedState, defs) {
  const normalized = normalizeSession(session);
  const checkedSet = new Set(normalized.checkedSteps);
  const group = defs.choiceGroups?.find((g) => g.id === groupId);

  if (group) {
    group.options.forEach((opt) => {
      if (opt.state !== selectedState) checkedSet.delete(opt.state);
    });
  }

  if (groupId === "BIAS") {
    const nextBias = selectedState === "D1_BIAS_BULLISH" ? "BULLISH" : "BEARISH";
    const biasChanged = normalized.bias && normalized.bias !== "UNKNOWN" && normalized.bias !== nextBias;

    if (biasChanged) {
      const cutoffRank = defs.stageRank?.D1_BOS_OK ?? 0;
      normalized.checkedSteps.forEach((state) => {
        const rank = defs.stageRank?.[state] ?? 0;
        if (rank > cutoffRank) checkedSet.delete(state);
      });
    }

    checkedSet.delete("D1_DISCOUNT_OK");
    checkedSet.delete("D1_PREMIUM_OK");
  }

  if (groupId === "VALUE_ZONE") {
    const cutoffRank = defs.stageRank?.[selectedState] ?? 0;
    normalized.checkedSteps.forEach((state) => {
      const rank = defs.stageRank?.[state] ?? 0;
      if (rank > cutoffRank) checkedSet.delete(state);
    });
  }

  if (groupId === "ORDER_TYPE") {
    const cutoffRank = defs.stageRank?.[selectedState] ?? 0;
    normalized.checkedSteps.forEach((state) => {
      const rank = defs.stageRank?.[state] ?? 0;
      if (rank > cutoffRank) checkedSet.delete(state);
    });
  }

  checkedSet.add(selectedState);

  const checkedSteps = computeCheckedStepsFromUI([...checkedSet], defs.stateFlow);
  const derived = applyDerivedFields(normalized, selectedState);

  return {
    patch: {
      currentState: selectedState,
      checkedSteps,
      bias: derived.bias,
      valueZone: derived.valueZone,
      orderType: derived.orderType,
      seenSteps: normalized.seenSteps
    },
    transition: { from: normalized.currentState, to: selectedState, type: "ok" }
  };
}

export function isChoiceOptionEnabled(session, option) {
  if (!option?.requiresBias) return true;
  return (session?.bias || "UNKNOWN") === option.requiresBias;
}

export function computeProgress(session, defs) {
  const normalized = normalizeSession(session || {});
  const total = defs?.stateFlow?.length || 0;
  if (!total) return 0;
  return Math.round((normalized.checkedSteps.length / total) * 100);
}

export function getNextAction(state) {
  const map = {
    START: "Valider Structure D1",
    D1_STRUCTURE_OK: "Valider BOS D1",
    D1_BOS_OK: "Définir le biais D1",
    D1_BIAS_BULLISH: "Valider DISCOUNT D1",
    D1_BIAS_BEARISH: "Valider PREMIUM D1",
    D1_DISCOUNT_OK: "Valider Structure H4",
    D1_PREMIUM_OK: "Valider Structure H4",
    H4_STRUCTURE_OK: "Identifier la liquidité H4",
    H4_LIQUIDITY_OK: "Valider displacement H4",
    H4_DISPLACEMENT_OK: "Identifier la FVG H4",
    H4_FVG_OK: "Valider OB H4",
    H4_OB_OK: "Prix dans la zone H4",
    H1_PRICE_IN_ZONE: "Valider sweep H1",
    H1_SWEEP_OK: "Valider CHoCH H1",
    H1_CHOCH_OK: "Valider structure M15",
    M15_STRUCTURE_OK: "Valider CHoCH M15",
    M15_CHOCH_OK: "Valider OB M15",
    M15_OB_OK: "Décider LIMIT vs MARKET",
    ORDER_LIMIT_READY: "Poser LIMIT ou attendre MARKET",
    WAIT_MARKET_CONFIRMATION: "Attendre confirmations M5",
    LIMIT_PLACED: "Valider tap M5",
    M5_TAP_OK: "Valider rejet M5",
    M5_REJECTION_OK: "Valider momentum M5",
    M5_MOMENTUM_OK: "Exécuter MARKET / confirmer",
    MARKET_EXECUTION: "Confirmer trade exécuté",
    TRADE_EXECUTED: "Gestion active (hors scope)",
    CANCEL_TRADE: "Revenir à M15"
  };
  return map[state] || "—";
}
