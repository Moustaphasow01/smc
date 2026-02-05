// =====================================================
// MODE CONFIGURATION (TRADING MODES)
// Table de mapping centralisée des timeframes
// =====================================================

export const MODE_CONFIG = {
  SWING: {
    levels: {
      CONTEXT: "D1",
      ZONE: "H4",
      REACTION: "H1",
      SETUP: "M15",
      EXECUTION: "M5"
    },
    labels: {
      CONTEXT: "D1 — Contexte",
      ZONE: "H4 — Zone",
      REACTION: "H1 — Réaction",
      SETUP: "M15 — Setup",
      EXECUTION: "M5 — Exécution"
    }
  },
  INTRADAY: {
    levels: {
      CONTEXT: "H4",
      ZONE: "H1",
      REACTION: "M15",
      SETUP: "M5",
      EXECUTION: "M1"
    },
    labels: {
      CONTEXT: "H4 — Contexte",
      ZONE: "H1 — Zone",
      REACTION: "M15 — Réaction",
      SETUP: "M5 — Setup",
      EXECUTION: "M1 — Exécution"
    }
  }
};

/**
 * Récupère le TF pour une étape donnée selon le mode de trading
 * @param {string} mode - "SWING" ou "INTRADAY"
 * @param {string} level - "CONTEXT", "ZONE", "REACTION", "SETUP", "EXECUTION"
 * @returns {string} Timeframe (ex: "D1", "H4", etc.)
 */
export function getTFForLevel(mode, level) {
  if (!MODE_CONFIG[mode]) return "UNKNOWN";
  return MODE_CONFIG[mode].levels[level] || "UNKNOWN";
}

/**
 * Récupère le label pour une étape donnée selon le mode de trading
 * @param {string} mode - "SWING" ou "INTRADAY"
 * @param {string} level - "CONTEXT", "ZONE", "REACTION", "SETUP", "EXECUTION"
 * @returns {string} Label lisible (ex: "D1 — Contexte")
 */
export function getLabelForLevel(mode, level) {
  if (!MODE_CONFIG[mode]) return "UNKNOWN";
  return MODE_CONFIG[mode].labels[level] || "UNKNOWN";
}
