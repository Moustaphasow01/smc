// =====================================================
// DOM REFERENCES (Centralisé) - Lazy Loading
// =====================================================

/**
 * Lazy getter for DOM elements to avoid null references
 * when module loads before DOM is ready.
 * Avoids caching for dynamic content (lists, selectors).
 */
function createDomProxy() {
  const cache = {};
  
  const elementIds = [
    'dashboardView', 'sessionView', 'dashboardGrid', 'dashboardEmpty', 'dashboardSearch',
    'biasFilter', 'newSessionBtn', 'backToDashboard', 'sessionSymbol', 'symbolInput',
    'notesInput', 'biasBadge', 'modeBadge', 'valueZoneBadge', 'currentStateBadge',
    'progressFill', 'logList', 'resetSessionBtn', 'exportSessionBtn', 'trainingModeToggle',
    'messageList', 'messageInput', 'sendMessageBtn', 'tooltip', 'explanationPanel',
    'panelOverlay', 'closePanel', 'panelTitle', 'panelSearch', 'panelSmc', 'panelWhy',
    'panelAction', 'aiPromptModal', 'aiPromptText', 'closeAIModal', 'copyPromptBtn',
    'copyAndCloseBtn', 'aiModalOverlay', 'modeSelectionModal', 'modeSymbolInput',
    'modeModalOverlay', 'closeModeModal', 'confirmModeBtn', 'cancelModeBtn'
  ];
  
  const handler = {
    get(target, prop) {
      if (prop === 'getCard') {
        return (cardId) => document.getElementById(cardId);
      }
      
      // Dynamic lists - always fetch fresh, never cache
      if (prop === 'tabButtons') {
        return Array.from(document.querySelectorAll(".tab-btn"));
      } else if (prop === 'tabContents') {
        return Array.from(document.querySelectorAll(".tab-content"));
      } else if (prop === 'allCheckboxes') {
        return Array.from(document.querySelectorAll("input[type=checkbox][data-group]"));
      } else if (prop === 'allInfoIcons') {
        return document.querySelectorAll(".info-icon");
      } else if (prop === 'allAIButtons') {
        return document.querySelectorAll(".ai-button");
      }
      
      // Static elements - cache them
      if (!cache.hasOwnProperty(prop) && elementIds.includes(prop)) {
        cache[prop] = document.getElementById(prop);
      }
      
      return cache[prop];
    }
  };
  
  return new Proxy({}, handler);
}

export const dom = createDomProxy();




/**
 * Group checkboxes by data-group attribute
 */
export function getGroupedCheckboxes() {
  const grouped = dom.allCheckboxes.reduce((acc, checkbox) => {
    const group = checkbox.dataset.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(checkbox);
    return acc;
  }, {});
  
  // Sort by step number
  Object.values(grouped).forEach((items) =>
    items.sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step))
  );
  
  return grouped;
}
