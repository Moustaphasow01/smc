#!/usr/bin/env node
// =====================================================
// ENTRYPOINT: app.js
// Orchestre tous les modules
// =====================================================

import { getTFForLevel } from './smc/config.js';
import { 
  stepLibrary, 
  stateFlow, 
  choiceGroups, 
  stageRank, 
  groupConfig
} from './smc/definitions.js';
import { buildAIPrompt } from './smc/prompts.js';
import {
  normalizeSession,
  applyState,
  rollbackTo as engineRollbackTo,
  applyChoice,
  computeCheckedStepsFromUI,
  computeProgress,
  getNextAction,
  isChoiceOptionEnabled
} from './smc/engine.js';
import { SessionStore, appState } from './store/localStore.js';
import { dom, getGroupedCheckboxes } from './ui/dom.js';

// =====================================================
// GLOBAL STATE (in-memory during session)
// =====================================================

let currentState = "START";
let currentBias = "UNKNOWN";
let currentValueZone = "UNKNOWN";
let currentOrderType = null;
let trainingMode = false;
let isHydrating = false;
let seenSteps = new Set();

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", { hour12: false });
}

// =====================================================
// VIEW MANAGEMENT
// =====================================================

function setView(view) {
  dom.dashboardView.classList.toggle("active", view === "dashboard");
  dom.sessionView.classList.toggle("active", view === "session");
}

function navigateToDashboard() {
  location.hash = "#/dashboard";
}

function navigateToSession(sessionId) {
  location.hash = `#/session/${sessionId}`;
}

function handleRoute() {
  const hash = location.hash || "#/dashboard";
  if (hash.startsWith("#/session/")) {
    const sessionId = hash.replace("#/session/", "");
    if (!appState.sessions.some((s) => s.id === sessionId)) {
      navigateToDashboard();
      return;
    }
    SessionStore.setActiveSession(sessionId);
    renderSessionView();
    return;
  }
  setView("dashboard");
  renderDashboard();
}

// =====================================================
// DASHBOARD RENDERING
// =====================================================

function renderDashboard() {
  const query = dom.dashboardSearch.value.trim().toLowerCase();
  const bias = dom.biasFilter.value;
  const sortBy = document.getElementById('sortFilter')?.value || 'updated';
  
  let sessions = appState.sessions.filter((session) => {
    const matchesQuery = !query || session.symbol.toLowerCase().includes(query);
    const matchesBias = bias === "ALL" || session.bias === bias;
    return matchesQuery && matchesBias;
  });

  // Tri
  sessions.sort((a, b) => {
    switch(sortBy) {
      case 'symbol':
        return a.symbol.localeCompare(b.symbol);
      case 'progress':
        const progA = computeProgress(a, { stateFlow }) || 0;
        const progB = computeProgress(b, { stateFlow }) || 0;
        return progB - progA;
      case 'mode':
        return (a.mode || 'SWING').localeCompare(b.mode || 'SWING');
      case 'updated':
      default:
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    }
  });

  // Statistiques
  updateDashboardStats(appState.sessions);

  dom.dashboardGrid.innerHTML = "";
  dom.dashboardEmpty.style.display = sessions.length ? "none" : "block";

  sessions.forEach((session) => {
    const card = document.createElement("div");
    card.className = "dashboard-card";
    const mode = session.mode || "SWING";
    const progress = computeProgress(session, { stateFlow }) || 0;
    const nextAction = getNextAction(session.currentState);
    
    // Classe spéciale selon bias
    const biasClass = session.bias === 'BULLISH' ? 'bias-bullish' : 
                      session.bias === 'BEARISH' ? 'bias-bearish' : 'bias-unknown';
    card.classList.add(biasClass);
    
    card.innerHTML = `
      <div class="dashboard-card-header">
        <h4>${session.symbol}</h4>
        <span class="badge badge-${mode === 'SWING' ? 'success' : 'warn'}">${mode}</span>
      </div>
      <div class="dashboard-progress">
        <div class="dashboard-progress-bar">
          <div class="dashboard-progress-fill" style="width: ${progress}%"></div>
        </div>
        <span class="dashboard-progress-text">${Math.round(progress)}%</span>
      </div>
      <div class="dashboard-meta">
        <div class="meta-row">
          <span class="meta-label">Bias:</span>
          <span class="meta-value meta-bias-${session.bias.toLowerCase()}">${session.bias}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Value:</span>
          <span class="meta-value">${session.valueZone}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Prochaine:</span>
          <span class="meta-value meta-next">${nextAction}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Modifié:</span>
          <span class="meta-value">${formatDate(session.updatedAt)}</span>
        </div>
      </div>
      <div class="dashboard-actions">
        <button class="btn-primary" type="button" data-action="open">
          <span>📂</span> Ouvrir
        </button>
        <button class="btn-ghost" type="button" data-action="duplicate" title="Dupliquer">
          <span>📋</span>
        </button>
        <button class="btn-ghost btn-danger" type="button" data-action="delete" title="Supprimer">
          <span>🗑️</span>
        </button>
      </div>
    `;

    card.querySelector("[data-action='open']").addEventListener("click", () => {
      SessionStore.setActiveSession(session.id);
      navigateToSession(session.id);
    });
    
    card.querySelector("[data-action='duplicate']").addEventListener("click", () => {
      const newSession = SessionStore.duplicateSession(session.id);
      if (newSession) {
        showToast(`✓ Session ${session.symbol} dupliquée`, 'success');
        renderDashboard();
      }
    });

    card.querySelector("[data-action='delete']").addEventListener("click", () => {
      if (confirm(`Supprimer la session ${session.symbol} ?`)) {
        SessionStore.deleteSession(session.id);
        showToast(`🗑️ Session ${session.symbol} supprimée`, 'warning');
        renderDashboard();
      }
    });

    dom.dashboardGrid.appendChild(card);
  });
}

function updateDashboardStats(sessions) {
  const total = sessions.length;
  const bullish = sessions.filter(s => s.bias === 'BULLISH').length;
  const bearish = sessions.filter(s => s.bias === 'BEARISH').length;
  const avgProgress = total > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + (computeProgress(s, { stateFlow }) || 0), 0) / total)
    : 0;
  
  const statTotal = document.getElementById('statTotal');
  const statBullish = document.getElementById('statBullish');
  const statBearish = document.getElementById('statBearish');
  const statAvgProgress = document.getElementById('statAvgProgress');
  
  if (statTotal) statTotal.textContent = total;
  if (statBullish) statBullish.textContent = bullish;
  if (statBearish) statBearish.textContent = bearish;
  if (statAvgProgress) statAvgProgress.textContent = `${avgProgress}%`;
}

// =====================================================
// SESSION RENDERING
// =====================================================

function collectCheckedSteps() {
  const checkedStates = dom.allCheckboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.state);
  return computeCheckedStepsFromUI(checkedStates, stateFlow);
}

function persistSessionState() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  const checkedSteps = collectCheckedSteps();
  SessionStore.updateSession(session.id, {
    currentState,
    bias: currentBias,
    valueZone: currentValueZone,
    orderType: currentOrderType,
    checkedSteps,
    seenSteps: Array.from(seenSteps),
    notes: dom.notesInput.value || ""
  });
  renderDashboard();
}

function renderTransitions() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  dom.logList.innerHTML = "";
  const entries = [...session.transitions].reverse();
  entries.forEach((item) => {
    const li = document.createElement("li");
    li.className = `log-entry ${item.type === "warn" ? "status-warn" : "status-ok"}`;
    const time = new Date(item.ts).toLocaleTimeString("fr-FR", { hour12: false });
    const label = item.type === "warn" ? "Rollback" : "Transition";
    li.innerHTML = `<span>${label}: ${item.from} → ${item.to}</span><span>${time}</span>`;
    dom.logList.appendChild(li);
  });
}

function renderMessages() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  dom.messageList.innerHTML = "";
  session.messages.slice().reverse().forEach((message) => {
    const item = document.createElement("div");
    item.className = "message-item";
    item.innerHTML = `
      <div class="message-meta">${formatDate(message.ts)}</div>
      <div>${message.text}</div>
    `;
    dom.messageList.appendChild(item);
  });
}

function bindUIToSession(session) {
  if (!session) return;
  const normalized = normalizeSession(session);
  isHydrating = true;
  currentState = normalized.currentState;
  currentBias = normalized.bias;
  currentValueZone = normalized.valueZone;
  currentOrderType = normalized.orderType;
  const currentMode = session.mode || "SWING";
  seenSteps = new Set(normalized.seenSteps || []);
  trainingMode = Boolean(appState.preferences?.trainingMode);
  dom.trainingModeToggle.checked = trainingMode;
  dom.sessionSymbol.textContent = session.symbol;
  dom.symbolInput.value = session.symbol;
  dom.notesInput.value = session.notes || "";

  const checkedSet = new Set(normalized.checkedSteps || []);
  dom.allCheckboxes.forEach((cb) => {
    cb.checked = checkedSet.has(cb.dataset.state);
  });
  isHydrating = false;
  updateUI();
  updateModeBadge(currentMode);
  updateCardLabelsForMode(currentMode);
  renderTransitions();
  renderMessages();
}

function renderSessionView() {
  const session = SessionStore.getActiveSession();
  if (!session) {
    navigateToDashboard();
    return;
  }
  setView("session");
  bindUIToSession(session);
  renderChoiceGroups();
}

// =====================================================
// CHOICE GROUPS RENDERING
// =====================================================

function renderChoiceGroups() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  
  const d1Card = dom.getCard("card-d1");
  if (d1Card && !d1Card.querySelector("[data-choice-group-id='BIAS']")) {
    const biasGroup = choiceGroups.find(g => g.id === "BIAS");
    const checksDiv = d1Card.querySelector(".checks");
    if (biasGroup && checksDiv) {
      const biasEl = renderChoiceGroup(biasGroup);
      checksDiv.insertBefore(biasEl, checksDiv.firstChild);
      
      const biasCheckboxes = checksDiv.querySelectorAll(
        'input[data-state="D1_BIAS_BULLISH"], input[data-state="D1_BIAS_BEARISH"]'
      );
      biasCheckboxes.forEach(cb => {
        const label = cb.closest("label");
        if (label) label.style.display = "none";
      });
    }
  }
  
  const d1Card2 = dom.getCard("card-d1");
  if (d1Card2 && !d1Card2.querySelector("[data-choice-group-id='VALUE_ZONE']")) {
    const valueZoneGroup = choiceGroups.find(g => g.id === "VALUE_ZONE");
    const checksDiv = d1Card2.querySelector(".checks");
    if (valueZoneGroup && checksDiv) {
      const valueZoneEl = renderChoiceGroup(valueZoneGroup);
      checksDiv.appendChild(valueZoneEl);
      
      const valueCheckboxes = checksDiv.querySelectorAll(
        'input[data-state="D1_DISCOUNT_OK"], input[data-state="D1_PREMIUM_OK"]'
      );
      valueCheckboxes.forEach(cb => {
        const label = cb.closest("label");
        if (label) label.style.display = "none";
      });
    }
  }
  
  const orderCard = dom.getCard("card-order");
  if (orderCard && !orderCard.querySelector("[data-choice-group-id='ORDER_TYPE']")) {
    const orderTypeGroup = choiceGroups.find(g => g.id === "ORDER_TYPE");
    const checksDiv = orderCard.querySelector(".checks");
    if (orderTypeGroup && checksDiv) {
      const orderTypeEl = renderChoiceGroup(orderTypeGroup);
      checksDiv.insertBefore(orderTypeEl, checksDiv.firstChild);
      
      const orderCheckboxes = checksDiv.querySelectorAll(
        'input[data-state="ORDER_LIMIT_READY"], input[data-state="WAIT_MARKET_CONFIRMATION"]'
      );
      orderCheckboxes.forEach(cb => {
        const label = cb.closest("label");
        if (label) label.style.display = "none";
      });
    }
  }
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// CHOICE GROUP SELECTION
// =====================================================

function handleChoiceGroupSelection(groupId, selectedState) {
  if (isHydrating) return;

  const session = getSessionSnapshotFromUI();
  if (!session) return;
  
  // Animation pulse sur le choix sélectionné
  const selectedLabel = document.querySelector(
    `label[for="${groupId}-${selectedState}"]`
  );
  if (selectedLabel) {
    selectedLabel.classList.add('pulse');
    setTimeout(() => selectedLabel.classList.remove('pulse'), 600);
  }
  
  // Toast notification
  const choiceGroup = choiceGroups.find(g => g.id === groupId);
  const option = choiceGroup?.options.find(o => o.state === selectedState);
  if (option) {
    showToast(`✓ ${option.label} sélectionné`, 'success');
  }
  
  const result = applyChoice(session, groupId, selectedState, {
    stateFlow,
    stageRank,
    groupConfig,
    choiceGroups
  });
  applyEngineResult(result);
}

function renderChoiceGroup(choiceGroup) {
  const container = document.createElement("div");
  container.className = "choice-group-container";
  container.dataset.choiceGroupId = choiceGroup.id;
  const session = normalizeSession(SessionStore.getActiveSession() || {});
  const currentBias = session.bias || "UNKNOWN";
  
  const header = document.createElement("div");
  header.className = "choice-group-header";
  
  const title = document.createElement("h3");
  title.className = "choice-group-title";
  title.textContent = choiceGroup.title;
  
  const desc = document.createElement("p");
  desc.className = "choice-group-description";
  desc.textContent = choiceGroup.description;
  
  header.appendChild(title);
  header.appendChild(desc);
  container.appendChild(header);
  
  const control = document.createElement("div");
  control.className = "segmented-control";
  
  choiceGroup.options.forEach((option) => {
    // Utiliser session.checkedSteps au lieu de collectCheckedSteps()
    // pour éviter les faux positifs sur les choix exclusifs
    const sessionCheckedSteps = session.checkedSteps || [];
    const isChecked = sessionCheckedSteps.includes(option.state);
    
    // Logique de désactivation basée sur requiresBias
    let isDisabled = false;
    if (option.requiresBias) {
      // Si l'option nécessite un bias spécifique
      if (currentBias === "UNKNOWN") {
        // Pas de bias défini => désactiver Discount et Premium
        isDisabled = true;
      } else if (option.requiresBias !== currentBias) {
        // Bias défini mais ne correspond pas => désactiver
        isDisabled = true;
      }
    }
    
    const optionWrapper = document.createElement("div");
    optionWrapper.className = "segmented-option-wrapper";
    optionWrapper.style.flexDirection = "column";
    optionWrapper.style.alignItems = "flex-start";
    optionWrapper.style.gap = "8px";
    
    // Créer un ID unique pour le radio
    const radioId = `${choiceGroup.id}-${option.state}`;
    
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.id = radioId;
    radio.name = choiceGroup.id;
    radio.value = option.state;
    radio.checked = isChecked;
    radio.disabled = isDisabled;
    radio.dataset.choiceGroupId = choiceGroup.id;
    radio.dataset.state = option.state;
    radio.className = "segmented-radio";
    
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.width = "100%";
    buttonRow.style.gap = "6px";
    
    const label = document.createElement("label");
    label.className = "segmented-button";
    label.style.flex = "1";
    label.setAttribute("for", radioId);
    if (isChecked) label.classList.add("active");
    if (isDisabled) {
      label.classList.add("disabled");
      // Message explicatif pour le tooltip
      if (option.requiresBias) {
        if (currentBias === "UNKNOWN") {
          label.setAttribute("data-disabled-reason", `Sélectionnez d'abord ${option.requiresBias === "BULLISH" ? "Bullish" : "Bearish"}`);
        } else {
          label.setAttribute("data-disabled-reason", `Disponible uniquement en ${option.requiresBias === "BULLISH" ? "BULLISH" : "BEARISH"}`);
        }
      }
    }
    
    const content = document.createElement("span");
    content.className = "segmented-content";
    
    const icon = document.createElement("span");
    icon.className = "segmented-icon";
    icon.textContent = option.icon;
    
    const text = document.createElement("span");
    text.className = "segmented-text";
    text.innerHTML = `
      <strong>${option.label}</strong>
      <small>${option.hint}</small>
    `;
    
    content.appendChild(icon);
    content.appendChild(text);
    label.appendChild(content);
    
    // Handler click sur label pour forcer le check
    label.addEventListener("click", (e) => {
      if (radio.disabled) return;
      e.preventDefault();
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    
    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "choice-info-btn";
    infoBtn.textContent = "ℹ️";
    infoBtn.dataset.stepId = option.state;
    infoBtn.disabled = isDisabled;
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel(infoBtn.dataset.stepId);
    });
    
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "choice-ai-btn";
    aiBtn.textContent = "?";
    aiBtn.dataset.stepId = option.state;
    aiBtn.disabled = isDisabled;
    aiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAIPromptModal(option.state);
    });
    
    buttonRow.appendChild(radio);
    buttonRow.appendChild(label);
    buttonRow.appendChild(infoBtn);
    buttonRow.appendChild(aiBtn);
    
    optionWrapper.appendChild(buttonRow);
    control.appendChild(optionWrapper);
    
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        handleChoiceGroupSelection(choiceGroup.id, option.state);
      }
    });
  });
  
  container.appendChild(control);
  
  // Ajouter un message helper si des options sont disabled à cause du bias
  if (choiceGroup.id === "VALUE_ZONE" && currentBias === "UNKNOWN") {
    const helperMsg = document.createElement("div");
    helperMsg.className = "choice-helper-message";
    helperMsg.innerHTML = "🔒 Sélectionnez d'abord <strong>Bullish</strong> ou <strong>Bearish</strong> pour débloquer ces options";
    container.appendChild(helperMsg);
  }
  
  return container;
}

// =====================================================
// ENGINE INTEGRATION (no DOM in engine)
// =====================================================

function getSessionSnapshotFromUI() {
  const session = SessionStore.getActiveSession();
  if (!session) return null;
  const normalized = normalizeSession(session);
  const checkedStates = dom.allCheckboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.state);
  return {
    ...normalized,
    checkedSteps: computeCheckedStepsFromUI(checkedStates, stateFlow)
  };
}

function applyEngineResult(result) {
  const session = SessionStore.getActiveSession();
  if (!session || !result?.patch) return;

  SessionStore.updateSession(session.id, result.patch);
  if (result.transition) {
    SessionStore.addTransition(session.id, result.transition.from, result.transition.to, result.transition.type);
  }

  const refreshed = SessionStore.getActiveSession();
  if (refreshed) {
    bindUIToSession(refreshed);
  }
  renderDashboard();
}

// Compute current step in a group based on checked states in session
function getGroupStep(group, checkedStates) {
  const statesForGroup = {
    D1: ["D1_STRUCTURE_OK", "D1_BOS_OK", ["D1_BIAS_BULLISH", "D1_BIAS_BEARISH"], ["D1_DISCOUNT_OK", "D1_PREMIUM_OK"]],
    H4: ["H4_STRUCTURE_OK", "H4_LIQUIDITY_OK", "H4_DISPLACEMENT_OK", "H4_FVG_OK", "H4_OB_OK"],
    H1: ["H1_PRICE_IN_ZONE", "H1_SWEEP_OK", "H1_CHOCH_OK"],
    M15: ["M15_STRUCTURE_OK", "M15_CHOCH_OK", "M15_OB_OK"],
    ORDER: [["ORDER_LIMIT_READY", "WAIT_MARKET_CONFIRMATION"], "LIMIT_PLACED"],
    M5: ["M5_TAP_OK", "M5_REJECTION_OK", "M5_MOMENTUM_OK", "MARKET_EXECUTION", "TRADE_EXECUTED"],
    CANCEL: ["CANCEL_TRADE"]
  };

  const steps = statesForGroup[group] || [];
  let currentStep = 0;
  
  for (let i = 0; i < steps.length; i++) {
    const stepStates = Array.isArray(steps[i]) ? steps[i] : [steps[i]];
    const isCompleted = stepStates.some((st) => checkedStates.includes(st));
    if (isCompleted) {
      currentStep = i + 1;
    } else {
      break;
    }
  }
  
  return currentStep;
}

function isGroupUnlocked(group) {
  const unlockState = groupConfig[group].unlockState;
  const unlockRank = Array.isArray(unlockState)
    ? Math.max(...unlockState.map((state) => stageRank[state] ?? 0))
    : (stageRank[unlockState] ?? 0);
  return (stageRank[currentState] ?? 0) >= unlockRank;
}

// =====================================================
// UI UPDATE
// =====================================================

function updateUI() {
  const groupedCheckboxes = getGroupedCheckboxes();
  const session = SessionStore.getActiveSession();
  const progress = computeProgress(session, { stateFlow });
  dom.progressFill.style.width = `${progress}%`;
  const currentRank = stageRank[currentState] ?? 0;

  const cards = {
    D1: dom.getCard("card-d1"),
    H4: dom.getCard("card-h4"),
    H1: dom.getCard("card-h1"),
    M15: dom.getCard("card-m15"),
    ORDER: dom.getCard("card-order"),
    M5: dom.getCard("card-m5"),
    CANCEL: dom.getCard("card-cancel")
  };

  cards.D1.classList.add("active");
  cards.H4.classList.toggle("active", currentRank >= (stageRank.D1_DISCOUNT_OK ?? 0));
  cards.H1.classList.toggle("active", currentRank >= (stageRank.H4_OB_OK ?? 0));
  cards.M15.classList.toggle("active", currentRank >= (stageRank.H1_CHOCH_OK ?? 0));
  cards.ORDER.classList.toggle("active", currentRank >= (stageRank.M15_OB_OK ?? 0));
  cards.M5.classList.toggle(
    "active",
    currentRank >= (stageRank.ORDER_LIMIT_READY ?? 0) || currentRank >= (stageRank.WAIT_MARKET_CONFIRMATION ?? 0)
  );
  cards.CANCEL.classList.toggle("active", currentRank >= (stageRank.M15_OB_OK ?? 0) && currentState !== "TRADE_EXECUTED");

  Object.entries(groupedCheckboxes).forEach(([group, checkboxes]) => {
    const progressCount = getGroupStep(group, collectCheckedSteps());
    const unlocked = isGroupUnlocked(group);

    checkboxes.forEach((cb) => {
      const step = Number(cb.dataset.step);
      let canToggle = unlocked && step <= progressCount + 1;

      if (group === "M5" && step === 5 && currentOrderType === "LIMIT") {
        const limitPlaced = groupedCheckboxes.ORDER?.some(
          (item) => item.dataset.state === "LIMIT_PLACED" && item.checked
        );
        if (limitPlaced) {
          canToggle = true;
        }
      }
      cb.disabled = !canToggle && !cb.checked;

      const label = cb.closest("label");
      const infoIcon = label?.querySelector(".info-icon");
      const aiButton = label?.querySelector(".ai-button");
      
      if (infoIcon) {
        infoIcon.style.opacity = cb.disabled && !cb.checked ? "0.3" : "0.7";
        infoIcon.style.pointerEvents = cb.disabled && !cb.checked ? "none" : "auto";
      }
      
      if (aiButton) {
        aiButton.disabled = cb.disabled && !cb.checked;
      }

      if (trainingMode) {
        const stepId = cb.dataset.stepId;
        if (stepId && !seenSteps.has(stepId) && !cb.checked) {
          cb.disabled = true;
          if (aiButton) aiButton.disabled = true;
          if (infoIcon) {
            infoIcon.style.opacity = "0.3";
            infoIcon.style.pointerEvents = "none";
          }
        }
      }

      if (group === "D1" && step === 4) {
        const label = cb.closest("label");
        const showIf = label?.dataset.showIf;
        if (showIf) {
          const isBull = currentBias === "BULLISH";
          const isBear = currentBias === "BEARISH";
          const shouldShow =
            currentState === showIf ||
            (showIf === "D1_BIAS_BULLISH" && isBull) ||
            (showIf === "D1_BIAS_BEARISH" && isBear);
          label.style.display = shouldShow ? "flex" : "none";
          if (!shouldShow && cb.checked) {
            cb.checked = false;
          }
        }
      }

      if (group === "ORDER" && step === 2) {
        const label = cb.closest("label");
        const showIf = label?.dataset.showIf;
        if (showIf) {
          const shouldShow = currentState === showIf || currentOrderType === "LIMIT";
          label.style.display = shouldShow ? "flex" : "none";
          if (!shouldShow && cb.checked) {
            cb.checked = false;
          }
        }
      }

      if (group === "M5" && step === 4) {
        const label = cb.closest("label");
        const showIf = label?.dataset.showIf;
        if (showIf && currentOrderType !== "LIMIT") {
          const shouldShow = currentRank >= (stageRank.M5_MOMENTUM_OK ?? 0);
          label.style.display = shouldShow ? "flex" : "none";
        } else if (currentOrderType === "LIMIT") {
          label.style.display = "none";
        }
      }
    });
  });

  updateBadges();
  syncChoiceGroupsUI();
  updateNextAction();
  updateCardProgress();
}

function updateNextAction() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  
  const nextActionText = getNextAction(session.currentState || "START");
  const nextActionEl = document.getElementById('nextActionText');
  if (nextActionEl) {
    nextActionEl.textContent = nextActionText || "—";
  }
}

function updateCardProgress() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  
  const checkedSteps = session.checkedSteps || [];
  const cards = {
    D1: { el: dom.getCard("card-d1"), group: "D1", total: 5 },
    H4: { el: dom.getCard("card-h4"), group: "H4", total: 5 },
    H1: { el: dom.getCard("card-h1"), group: "H1", total: 3 },
    M15: { el: dom.getCard("card-m15"), group: "M15", total: 3 },
    ORDER: { el: dom.getCard("card-order"), group: "ORDER", total: 3 },
    M5: { el: dom.getCard("card-m5"), group: "M5", total: 5 }
  };
  
  Object.entries(cards).forEach(([key, { el, group, total }]) => {
    if (!el) return;
    
    const progress = getGroupStep(group, checkedSteps);
    const h2 = el.querySelector('h2');
    if (!h2) return;
    
    // Ajouter collapse icon si pas déjà présent
    if (!h2.querySelector('.collapse-icon')) {
      const collapseIcon = document.createElement('span');
      collapseIcon.className = 'collapse-icon';
      collapseIcon.textContent = '▼';
      h2.appendChild(collapseIcon);
      
      // Handler pour collapse/expand
      h2.addEventListener('click', () => {
        el.classList.toggle('collapsed');
      });
    }
    
    // Ajouter/mettre à jour progression
    let progressEl = h2.querySelector('.card-progress');
    if (!progressEl) {
      progressEl = document.createElement('span');
      progressEl.className = 'card-progress';
      h2.insertBefore(progressEl, h2.querySelector('.collapse-icon'));
    }
    progressEl.textContent = `${progress}/${total}`;
    
    // Marquer la next card
    el.classList.remove('next-card');
    if (el.classList.contains('active') && progress < total) {
      el.classList.add('next-card');
    }
  });
}

function handleCheck(e) {
  const groupedCheckboxes = getGroupedCheckboxes();
  if (isHydrating) return;
  const cb = e.target;
  const group = cb.dataset.group;
  const step = Number(cb.dataset.step);
  const config = groupConfig[group];

  if (!config) return;

  const session = getSessionSnapshotFromUI();
  if (!session) return;
  const defs = { stateFlow, stageRank, groupConfig, choiceGroups };

  if (trainingMode && cb.checked) {
    const stepId = cb.dataset.stepId;
    if (stepId && !seenSteps.has(stepId)) {
      cb.checked = false;
      showPanel(stepId);
      updateUI();
      return;
    }
  }

  const progressBefore = getGroupStep(group, collectCheckedSteps());
  const effectiveProgressBefore = cb.checked ? Math.max(progressBefore - 1, 0) : progressBefore;
  const unlocked = isGroupUnlocked(group);

  let result = null;

  if (cb.checked) {
    if (group === "M5" && step === 5 && currentOrderType === "LIMIT") {
      const limitPlaced = groupedCheckboxes.ORDER?.some(
        (item) => item.dataset.state === "LIMIT_PLACED" && item.checked
      );
      if (limitPlaced) {
        result = applyState(session, "TRADE_EXECUTED", defs);
        applyEngineResult(result);
        return;
      }
    }

    if (!unlocked || step !== effectiveProgressBefore + 1) {
      cb.checked = false;
      updateUI();
      return;
    }

    if (group === "D1" && step === 3) {
      result = applyChoice(session, "BIAS", cb.dataset.state, defs);
    } else if (group === "D1" && step === 4) {
      result = applyChoice(session, "VALUE_ZONE", cb.dataset.state, defs);
    } else if (group === "ORDER" && step === 1) {
      result = applyChoice(session, "ORDER_TYPE", cb.dataset.state, defs);
    } else if (config.statesPerStep) {
      const nextState = config.statesPerStep[step - 1];
      result = applyState(session, nextState, defs);
    } else {
      result = applyState(session, cb.dataset.state, defs);
    }
  } else {
    let rollbackState = null;

    if (group === "H4") {
      const biasState = currentBias === "BULLISH"
        ? "D1_BIAS_BULLISH"
        : currentBias === "BEARISH"
          ? "D1_BIAS_BEARISH"
          : "D1_BOS_OK";
      rollbackState = step === 1 ? biasState : config.rollbackTargets[step - 1];
    } else if (group === "D1") {
      rollbackState = config.rollbackTargets[step - 1];
    } else if (group === "ORDER") {
      rollbackState = config.rollbackTargets[step - 1];
    } else if (group === "CANCEL") {
      rollbackState = "M15_OB_OK";
    } else if (config.rollbackTarget) {
      rollbackState = config.rollbackTarget;
    }

    if (rollbackState) {
      result = engineRollbackTo(session, rollbackState, defs);
    }
  }

  if (result) {
    applyEngineResult(result);
    if (result.transition?.type === "warn") {
      flashInvalidation(result.transition.from);
    }
  } else {
    updateUI();
  }
}

function resetAll() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  if (!confirm(`Réinitialiser complètement la session ${session.symbol} ?`)) return;
  SessionStore.resetSession(session.id);
  bindUIToSession(SessionStore.getActiveSession());
  showToast('↺ Session réinitialisée', 'info');
}

// =====================================================
// SYNC CHOICE GROUPS UI
// =====================================================

function syncChoiceGroupsUI() {
  const session = normalizeSession(SessionStore.getActiveSession() || {});
  const checkedStepsSet = new Set(session.checkedSteps || []);
  const currentBias = session.bias || "UNKNOWN";
  
  // Pour chaque choice group container dans le DOM
  document.querySelectorAll('.choice-group-container').forEach(container => {
    const groupId = container.dataset.choiceGroupId;
    const choiceGroup = choiceGroups.find(g => g.id === groupId);
    if (!choiceGroup) return;
    
    choiceGroup.options.forEach(option => {
      const radioId = `${groupId}-${option.state}`;
      const radio = document.getElementById(radioId);
      const label = document.querySelector(`label[for="${radioId}"]`);
      if (!radio || !label) return;
      
      // Vérifier si cette option est checked
      const isChecked = checkedStepsSet.has(option.state);
      
      // Calculer disabled selon requiresBias
      let isDisabled = false;
      if (option.requiresBias) {
        if (currentBias === "UNKNOWN") {
          isDisabled = true;
        } else if (option.requiresBias !== currentBias) {
          isDisabled = true;
        }
      }
      
      // Appliquer l'état
      radio.checked = isChecked;
      radio.disabled = isDisabled;
      
      label.classList.toggle('active', isChecked);
      label.classList.toggle('disabled', isDisabled);
      
      // Tooltip disabled reason
      if (isDisabled && option.requiresBias) {
        if (currentBias === "UNKNOWN") {
          label.setAttribute('data-disabled-reason', `Sélectionnez d'abord ${option.requiresBias === "BULLISH" ? "Bullish" : "Bearish"}`);
        } else {
          label.setAttribute('data-disabled-reason', `Disponible uniquement en ${option.requiresBias === "BULLISH" ? "BULLISH" : "BEARISH"}`);
        }
      } else {
        label.removeAttribute('data-disabled-reason');
      }
      
      // Sync boutons info et AI
      const buttonRow = radio.closest('div[style*="display: flex"]');
      if (buttonRow) {
        const infoBtn = buttonRow.querySelector('.choice-info-btn');
        const aiBtn = buttonRow.querySelector('.choice-ai-btn');
        if (infoBtn) infoBtn.disabled = isDisabled;
        if (aiBtn) aiBtn.disabled = isDisabled;
      }
    });
    
    // Gérer le message helper pour VALUE_ZONE
    if (groupId === "VALUE_ZONE") {
      let helperMsg = container.querySelector('.choice-helper-message');
      
      if (currentBias === "UNKNOWN") {
        // Afficher le message si pas déjà présent
        if (!helperMsg) {
          helperMsg = document.createElement("div");
          helperMsg.className = "choice-helper-message";
          helperMsg.innerHTML = "🔒 Sélectionnez d'abord <strong>Bullish</strong> ou <strong>Bearish</strong> pour débloquer ces options";
          container.appendChild(helperMsg);
        }
      } else {
        // Retirer le message si présent
        if (helperMsg) {
          helperMsg.remove();
        }
      }
    }
  });
}

// =====================================================
// UPDATE BADGES
// =====================================================

function updateBadges() {
  const biasText = currentBias || "UNKNOWN";
  const valueText = currentValueZone || "UNKNOWN";
  const stateText = currentState || "START";

  dom.biasBadge.textContent = `BIAS: ${biasText}`;
  dom.valueZoneBadge.textContent = `VALUE: ${valueText}`;
  dom.currentStateBadge.textContent = `STATE: ${stateText}`;

  dom.biasBadge.classList.toggle("badge-success", biasText === "BULLISH");
  dom.biasBadge.classList.toggle("badge-warn", biasText === "BEARISH");
  dom.biasBadge.classList.toggle("badge-neutral", biasText === "UNKNOWN");

  dom.valueZoneBadge.classList.toggle("badge-success", valueText === "DISCOUNT");
  dom.valueZoneBadge.classList.toggle("badge-warn", valueText === "PREMIUM");
  dom.valueZoneBadge.classList.toggle("badge-neutral", valueText === "UNKNOWN");

  dom.currentStateBadge.classList.toggle("badge-neutral", !stateText || stateText === "START");
}

function updateModeBadge(mode) {
  const modeText = mode || "SWING";
  dom.modeBadge.textContent = `MODE: ${modeText}`;
  dom.modeBadge.classList.toggle("badge-success", modeText === "SWING");
  dom.modeBadge.classList.toggle("badge-warn", modeText === "INTRADAY");
}

function updateCardLabelsForMode(mode) {
  const currentMode = mode || "SWING";
  
  const cardConfig = {
    "card-d1": { level: "CONTEXT", step: "D1" },
    "card-h4": { level: "ZONE", step: "H4" },
    "card-h1": { level: "REACTION", step: "H1" },
    "card-m15": { level: "SETUP", step: "M15" },
    "card-m5": { level: "EXECUTION", step: "M5" }
  };
  
  Object.entries(cardConfig).forEach(([cardId, config]) => {
    const card = dom.getCard(cardId);
    if (!card) return;
    
    const h2 = card.querySelector("h2");
    if (!h2) return;
    
    const tf = getTFForLevel(currentMode, config.level);
    h2.textContent = `${tf} - ${config.level.charAt(0) + config.level.slice(1).toLowerCase()}`;
  });
}

function flashInvalidation(state) {
  const cardId = getCardIdFromState(state);
  if (!cardId) return;
  const card = dom.getCard(cardId);
  if (!card) return;
  card.classList.add("invalidated");
  setTimeout(() => card.classList.remove("invalidated"), 700);
}

function getCardIdFromState(state) {
  if (state.startsWith("D1_")) return "card-d1";
  if (state.startsWith("H4_")) return "card-h4";
  if (state.startsWith("H1_")) return "card-h1";
  if (state.startsWith("M15_")) return "card-m15";
  if (state.startsWith("ORDER_") || state === "LIMIT_PLACED" || state === "WAIT_MARKET_CONFIRMATION") return "card-order";
  if (state.startsWith("M5_") || state === "MARKET_EXECUTION" || state === "TRADE_EXECUTED") return "card-m5";
  if (state === "CANCEL_TRADE") return "card-cancel";
  return null;
}

// =====================================================
// AI & PANEL
// =====================================================

function getAIContext() {
  const session = SessionStore.getActiveSession();
  if (!session) {
    return { checkedSteps: [], bias: "UNKNOWN", valueZone: "UNKNOWN", symbol: "UNKNOWN", notes: "", mode: "SWING" };
  }
  return {
    checkedSteps: session.checkedSteps || [],
    bias: session.bias || "UNKNOWN",
    valueZone: session.valueZone || "UNKNOWN",
    symbol: session.symbol || "UNKNOWN",
    notes: session.notes || "",
    mode: session.mode || "SWING"
  };
}

function openAIPromptModal(stateName) {
  const step = stepLibrary[stateName];
  if (!step) return;
  
  const ctx = getAIContext();
  const prompt = buildAIPrompt(ctx, stateName);
  
  const modal = dom.aiPromptModal;
  const promptText = dom.aiPromptText;
  
  promptText.textContent = prompt;
  
  modal.classList.add("visible");
  dom.aiModalOverlay.classList.add("visible");
  
  dom.copyPromptBtn.onclick = () => copyToClipboard(prompt);
  
  dom.copyAndCloseBtn.onclick = () => {
    copyToClipboard(prompt);
    modal.classList.remove("visible");
    dom.aiModalOverlay.classList.remove("visible");
  };
  
  dom.closeAIModal.onclick = () => {
    modal.classList.remove("visible");
    dom.aiModalOverlay.classList.remove("visible");
  };
  
  dom.aiModalOverlay.onclick = () => {
    modal.classList.remove("visible");
    dom.aiModalOverlay.classList.remove("visible");
  };
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Prompt copié au presse-papiers!");
    }).catch(() => fallbackCopyToClipboard(text));
  } else {
    fallbackCopyToClipboard(text);
  }
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    alert("✅ Prompt copié au presse-papiers (fallback)!");
  } catch {
    alert("❌ Erreur lors de la copie. Veuillez copier manuellement.");
  }
  document.body.removeChild(textarea);
}

function showTooltip(stepId, x, y) {
  const stepName = mapStepIdToState(stepId);
  const step = stepLibrary[stepName];
  if (!step) return;
  
  dom.tooltip.textContent = step.title;
  dom.tooltip.classList.add("visible");
  
  const tooltipRect = dom.tooltip.getBoundingClientRect();
  const offsetX = 10;
  const offsetY = 10;
  
  let left = x + offsetX;
  let top = y + offsetY;
  
  if (left + tooltipRect.width > window.innerWidth) {
    left = x - tooltipRect.width - offsetX;
  }
  
  if (top + tooltipRect.height > window.innerHeight) {
    top = y - tooltipRect.height - offsetY;
  }
  
  dom.tooltip.style.left = `${left}px`;
  dom.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  dom.tooltip.classList.remove("visible");
}

function mapStepIdToState(stepId) {
  const mapping = {
    "d1-structure": "D1_STRUCTURE_OK",
    "d1-bos": "D1_BOS_OK",
    "d1-bias-bull": "D1_BIAS_BULLISH",
    "d1-bias-bear": "D1_BIAS_BEARISH",
    "d1-discount": "D1_DISCOUNT_OK",
    "d1-premium": "D1_PREMIUM_OK",
    "h4-structure": "H4_STRUCTURE_OK",
    "h4-liquidity": "H4_LIQUIDITY_OK",
    "h4-displacement": "H4_DISPLACEMENT_OK",
    "h4-fvg": "H4_FVG_OK",
    "h4-ob": "H4_OB_OK",
    "h1-price": "H1_PRICE_IN_ZONE",
    "h1-sweep": "H1_SWEEP_OK",
    "h1-choch": "H1_CHOCH_OK",
    "m15-structure": "M15_STRUCTURE_OK",
    "m15-choch": "M15_CHOCH_OK",
    "m15-ob": "M15_OB_OK",
    "order-limit": "ORDER_LIMIT_READY",
    "order-market": "WAIT_MARKET_CONFIRMATION",
    "limit-placed": "LIMIT_PLACED",
    "m5-tap": "M5_TAP_OK",
    "m5-rejection": "M5_REJECTION_OK",
    "m5-momentum": "M5_MOMENTUM_OK",
    "market-exec": "MARKET_EXECUTION",
    "trade-executed": "TRADE_EXECUTED",
    "cancel": "CANCEL_TRADE"
  };
  // If stepId is already a state name (like D1_STRUCTURE_OK), return it directly
  if (stepLibrary[stepId]) {
    return stepId;
  }
  // Otherwise, try to map from slug
  return mapping[stepId] || stepId;
}

function showPanel(stepId) {
  const stateName = mapStepIdToState(stepId);
  const step = stepLibrary[stateName];
  if (!step) return;

  if (stepId) {
    seenSteps.add(stepId);
    persistSessionState();
  }
  
  dom.panelTitle.textContent = step.title;
  dom.panelSearch.textContent = step.description.search;
  dom.panelSmc.textContent = step.description.smc;
  dom.panelWhy.textContent = step.description.why;
  dom.panelAction.textContent = step.description.action;
  
  dom.panelOverlay.classList.add("visible");
  dom.explanationPanel.classList.add("visible");
}

function hidePanel() {
  dom.panelOverlay.classList.remove("visible");
  dom.explanationPanel.classList.remove("visible");
}

// =====================================================
// MODAL MANAGEMENT
// =====================================================

function showModeSelectionModal() {
  const modal = dom.modeSelectionModal;
  if (!modal) {
    const symbol = prompt("Symbol (ex: EURUSD)");
    if (!symbol) return;
    const session = SessionStore.createSession(symbol, "SWING");
    if (session) {
      navigateToSession(session.id);
    }
    return;
  }
  
  const symbolInput = modal.querySelector("#modeSymbolInput");
  const swingRadio = modal.querySelector("input[value='SWING']");
  const intradayRadio = modal.querySelector("input[value='INTRADAY']");
  const confirmBtn = dom.confirmModeBtn;
  const cancelBtn = dom.cancelModeBtn;
  
  if (symbolInput) symbolInput.selectedIndex = 0;
  if (swingRadio) swingRadio.checked = true;
  
  modal.classList.add("visible");
  dom.modeModalOverlay.classList.add("visible");
  
  if (symbolInput) {
    symbolInput.focus();
  }
  
  const handleConfirm = () => {
    const symbol = (symbolInput?.value || "").trim();
    if (!symbol) {
      alert("Veuillez entrer un symbol (ex: EURUSD)");
      return;
    }
    const mode = swingRadio?.checked ? "SWING" : "INTRADAY";
    
    modal.classList.remove("visible");
    dom.modeModalOverlay.classList.remove("visible");
    
    const session = SessionStore.createSession(symbol, mode);
    if (session) {
      showToast(`✓ Session ${symbol} créée (${mode})`, 'success');
      navigateToSession(session.id);
    }
  };
  
  const handleCancel = () => {
    modal.classList.remove("visible");
    dom.modeModalOverlay.classList.remove("visible");
  };
  
  if (confirmBtn) confirmBtn.onclick = handleConfirm;
  if (cancelBtn) cancelBtn.onclick = handleCancel;
  dom.modeModalOverlay.onclick = handleCancel;
  
  if (symbolInput) {
    symbolInput.onchange = () => {
      // Permet de valider avec Enter sur le select
    };
  }
}

// =====================================================
// EVENT LISTENERS & INITIALIZATION
// =====================================================

function init() {
  // Load state
  SessionStore.load();
  trainingMode = Boolean(appState.preferences?.trainingMode);
  dom.trainingModeToggle.checked = trainingMode;

  // Event listeners - Dashboard
  dom.dashboardSearch.addEventListener("input", renderDashboard);
  dom.biasFilter.addEventListener("change", renderDashboard);
  dom.newSessionBtn.addEventListener("click", showModeSelectionModal);
  
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) sortFilter.addEventListener("change", renderDashboard);
  
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  if (gridViewBtn && listViewBtn) {
    gridViewBtn.addEventListener("click", () => {
      dom.dashboardGrid.classList.remove('list-view');
      dom.dashboardGrid.classList.add('grid-view');
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
    });
    listViewBtn.addEventListener("click", () => {
      dom.dashboardGrid.classList.remove('grid-view');
      dom.dashboardGrid.classList.add('list-view');
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
    });
  }

  // Event listeners - Session
  dom.backToDashboard.addEventListener("click", navigateToDashboard);
  dom.resetSessionBtn.addEventListener("click", resetAll);
  dom.exportSessionBtn.addEventListener("click", () => {
    const session = SessionStore.getActiveSession();
    if (session) {
      SessionStore.exportSession(session.id);
      showToast(`✓ Session ${session.symbol} exportée`, 'success');
    }
  });

  dom.trainingModeToggle.addEventListener("change", () => {
    trainingMode = dom.trainingModeToggle.checked;
    appState.preferences.trainingMode = trainingMode;
    SessionStore.save();
    updateUI();
    showToast(
      trainingMode ? '🎯 Mode entraînement activé' : 'Mode entraînement désactivé',
      'info'
    );
  });

  dom.notesInput.addEventListener("input", () => {
    persistSessionState();
  });

  dom.sendMessageBtn.addEventListener("click", () => {
    const session = SessionStore.getActiveSession();
    if (!session) return;
    SessionStore.addMessage(session.id, dom.messageInput.value);
    dom.messageInput.value = "";
    renderMessages();
    renderDashboard();
  });

  // Tabs
  dom.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      dom.tabButtons.forEach((b) => b.classList.remove("active"));
      dom.tabContents.forEach((content) => content.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(target)?.classList.add("active");
    });
  });

  // Checkboxes
  dom.allCheckboxes.forEach((cb) => cb.addEventListener("change", handleCheck));

  // Info icons (ℹ️)
  dom.allInfoIcons.forEach((icon) => {
    const stepId = icon.dataset.stepId;
    const checkbox = icon.closest("label")?.querySelector("input[type=checkbox]");
    
    icon.addEventListener("mouseenter", (e) => {
      if (checkbox && !checkbox.disabled) {
        showTooltip(stepId, e.clientX, e.clientY);
      }
    });
    
    icon.addEventListener("mousemove", (e) => {
      if (checkbox && !checkbox.disabled) {
        showTooltip(stepId, e.clientX, e.clientY);
      }
    });
    
    icon.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (checkbox && !checkbox.disabled) {
        hideTooltip();
        showPanel(stepId);
        updateUI();
      }
    });
  });

  // AI buttons (?)
  dom.allAIButtons.forEach((btn) => {
    const stepId = btn.dataset.stepId;
    const checkbox = btn.closest("label")?.querySelector("input[type=checkbox]");
    
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (checkbox && !checkbox.disabled) {
        const stateName = mapStepIdToState(stepId);
        openAIPromptModal(stateName);
      }
    });
  });

  // Panel
  dom.closePanel.addEventListener("click", hidePanel);
  dom.panelOverlay.addEventListener("click", hidePanel);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hidePanel();
      dom.aiPromptModal?.classList.remove("visible");
      dom.aiModalOverlay?.classList.remove("visible");
    }
  });

  // Mode modal close button
  const closeModeModalBtn = document.getElementById("closeModeModal");
  if (closeModeModalBtn) {
    closeModeModalBtn.addEventListener("click", () => {
      dom.modeSelectionModal?.classList.remove("visible");
      dom.modeModalOverlay?.classList.remove("visible");
    });
  }

  // Router
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

// Init on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
