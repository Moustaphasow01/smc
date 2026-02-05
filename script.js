// =====================================================
// MODE CONFIGURATION (TRADING MODES)
// Table de mapping centralisée des timeframes
// =====================================================
const MODE_CONFIG = {
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
function getTFForLevel(mode, level) {
  if (!MODE_CONFIG[mode]) return "UNKNOWN";
  return MODE_CONFIG[mode].levels[level] || "UNKNOWN";
}

/**
 * Récupère le label pour une étape donnée selon le mode de trading
 * @param {string} mode - "SWING" ou "INTRADAY"
 * @param {string} level - "CONTEXT", "ZONE", "REACTION", "SETUP", "EXECUTION"
 * @returns {string} Label lisible (ex: "D1 — Contexte")
 */
function getLabelForLevel(mode, level) {
  if (!MODE_CONFIG[mode]) return "UNKNOWN";
  return MODE_CONFIG[mode].labels[level] || "UNKNOWN";
}

// =====================================================
// CHOICE GROUPS — Embranchements exclusifs (radio behavior)
// =====================================================
const choiceGroups = [
  {
    id: "BIAS",
    title: "Biais D1",
    description: "Choisissez la direction du biais : haussier ou baissier",
    options: [
      { 
        state: "D1_BIAS_BULLISH", 
        label: "Bullish", 
        icon: "📈",
        hint: "Contexte haussier, chercher les achats"
      },
      { 
        state: "D1_BIAS_BEARISH", 
        label: "Bearish", 
        icon: "📉",
        hint: "Contexte baissier, chercher les ventes"
      }
    ]
  },
  {
    id: "VALUE_ZONE",
    title: "Zone de valeur D1",
    description: "Validez la position du prix par rapport à l'équilibre",
    options: [
      { 
        state: "D1_DISCOUNT_OK", 
        label: "Discount", 
        icon: "🔽",
        hint: "Prix sous l'équilibre, favorable aux achats",
        condition: () => currentBias === "BULLISH"
      },
      { 
        state: "D1_PREMIUM_OK", 
        label: "Premium", 
        icon: "🔼",
        hint: "Prix au-dessus de l'équilibre, favorable aux ventes",
        condition: () => currentBias === "BEARISH"
      }
    ]
  },
  {
    id: "ORDER_TYPE",
    title: "Stratégie d'entrée",
    description: "Décidez si le prix n'a pas encore retest la zone ou s'il y est déjà",
    options: [
      { 
        state: "ORDER_LIMIT_READY", 
        label: "Limit", 
        icon: "⏱️",
        hint: "Prix pas encore revenu → placer LIMIT au meilleur prix"
      },
      { 
        state: "WAIT_MARKET_CONFIRMATION", 
        label: "Market", 
        icon: "⚡",
        hint: "Prix déjà dans OB → attendre confirmation M5 puis MARKET"
      }
    ]
  }
];

// =====================================================
// SMC Decision Engine — Step Library (V4.2 + AI)
// Bibliothèque centralisée: source de vérité unique
// =====================================================
const stepLibrary = {
  // ===================== D1 =====================
  D1_STRUCTURE_OK: {
    tf: "D1",
    title: "Structure D1 valide",
    description: {
      search: "Identifier une structure Daily claire et non ambiguë (HH/HL ou LL/LH) avec des swings lisibles.",
      smc: "Architecture HTF du marché (structure = squelette du prix).",
      why: "Sans structure lisible, pas d'avantage statistique: on est en balance/transition → interdiction de descendre en TF.",
      action: "Autorise l'analyse BOS D1. Si ambigu → rester au D1."
    },
    objectiveDetailed: "Vérifier que la structure D1 est clairement haussière (HH/HL) OU clairement baissière (LL/LH), avec swings propres. Refuser si range, structure plate, ou swings illisibles.",
    aiPromptTarget: "Confirme si la structure D1 est claire (haussière ou baissière) et non ambiguë."
  },
  D1_BOS_OK: {
    tf: "D1",
    title: "BOS D1 confirmé",
    description: {
      search: "Repérer un Break Of Structure sur D1: clôture au-delà d'un swing structurel clé (pas juste une mèche).",
      smc: "BOS = confirmation d'intention directionnelle sur le HTF.",
      why: "Sans BOS, la direction n'est pas validée: la suite (biais) serait spéculative.",
      action: "Autorise la sélection du biais (BULLISH/BEARISH)."
    },
    objectiveDetailed: "Vérifier qu'un BOS D1 est confirmé par clôture au-delà d'un swing structurel. Refuser si la cassure est uniquement une mèche ou si le swing cassé n'est pas structurel.",
    aiPromptTarget: "Confirme s'il y a un BOS D1 confirmé par clôture, et quel swing structurel est cassé."
  },
  D1_BIAS_BULLISH: {
    tf: "D1",
    title: "Biais haussier (BULLISH)",
    description: {
      search: "Valider un contexte haussier: structure HH/HL intacte + intention de continuation/expansion.",
      smc: "Biais = contrainte de contexte, pas une exécution (BUY/SELL vient plus tard).",
      why: "Évite de construire des zones H4 contre le flux HTF.",
      action: "Verrouille le système en mode haussier (ACHAT uniquement à l'exécution)."
    },
    objectiveDetailed: "Vérifier que le contexte D1 est réellement haussier: structure HH/HL intacte et pas de cassure baissière récente invalidante. Refuser si transition/range ou signaux contradictoires.",
    aiPromptTarget: "Confirme si le biais D1 est BULLISH (sinon REFUSE)."
  },
  D1_BIAS_BEARISH: {
    tf: "D1",
    title: "Biais baissier (BEARISH)",
    description: {
      search: "Valider un contexte baissier: structure LL/LH intacte + intention de continuation/distribution.",
      smc: "Biais = contrainte de contexte, pas une exécution.",
      why: "Empêche tout scénario acheteur contre le HTF.",
      action: "Verrouille le système en mode baissier (VENTE uniquement à l'exécution)."
    },
    objectiveDetailed: "Vérifier que le contexte D1 est réellement baissier: structure LL/LH intacte et pas de cassure haussière récente invalidante. Refuser si transition/range ou signaux contradictoires.",
    aiPromptTarget: "Confirme si le biais D1 est BEARISH (sinon REFUSE)."
  },
  D1_DISCOUNT_OK: {
    tf: "D1",
    title: "Prix en DISCOUNT (autorisé si BULLISH)",
    description: {
      search: "Confirmer que le prix est situé en zone discount (sous l'équilibre du dernier leg HTF).",
      smc: "Discount = zone d'avantage pour achats en contexte haussier.",
      why: "Acheter en premium dégrade RR et augmente faux stops.",
      action: "Autorise la descente en H4 pour construire une zone."
    },
    objectiveDetailed: "Avec un biais D1 BULLISH, vérifier que le prix est en DISCOUNT (pas en premium). Refuser si le prix est trop haut/au-dessus de l'équilibre du leg de référence.",
    aiPromptTarget: "Confirme si le prix est bien en DISCOUNT sur D1 (dans le cadre d'un biais haussier)."
  },
  D1_PREMIUM_OK: {
    tf: "D1",
    title: "Prix en PREMIUM (autorisé si BEARISH)",
    description: {
      search: "Confirmer que le prix est situé en zone premium (au-dessus de l'équilibre du dernier leg HTF).",
      smc: "Premium = zone d'avantage pour ventes en contexte baissier.",
      why: "Vendre en discount dégrade RR et augmente les invalidations.",
      action: "Autorise la descente en H4 pour construire une zone."
    },
    objectiveDetailed: "Avec un biais D1 BEARISH, vérifier que le prix est en PREMIUM (pas en discount). Refuser si le prix est trop bas/au-dessous de l'équilibre du leg de référence.",
    aiPromptTarget: "Confirme si le prix est bien en PREMIUM sur D1 (dans le cadre d'un biais baissier)."
  },
  // ===================== H4 =====================
  H4_STRUCTURE_OK: {
    tf: "H4",
    title: "Structure H4 alignée D1",
    description: {
      search: "Vérifier que la structure H4 est cohérente avec le biais D1 (pas de contradiction majeure).",
      smc: "Alignement multi-TF: H4 doit respecter la direction du D1.",
      why: "Une zone construite contre le HTF est statistiquement fragile.",
      action: "Autorise l'identification de la liquidité H4."
    },
    objectiveDetailed: "Vérifier que H4 est aligné avec le biais D1 (BULL: HH/HL; BEAR: LL/LH) et qu'il n'y a pas de structure inverse dominante. Refuser si H4 contredit le biais.",
    aiPromptTarget: "Confirme si la structure H4 est alignée avec le biais D1."
  },
  H4_LIQUIDITY_OK: {
    tf: "H4",
    title: "Liquidité H4 identifiée",
    description: {
      search: "Identifier une zone de liquidité visible (EQH/EQL/range) servant de carburant au move.",
      smc: "Liquidity pools = zones de stops.",
      why: "Sans liquidité claire, pas de mouvement institutionnel propre.",
      action: "Autorise la validation du displacement."
    },
    objectiveDetailed: "Vérifier qu'une zone de liquidité H4 est clairement identifiable et évidente. Si biais BULLISH: liquidité sell-side (EQL/lows). Si biais BEARISH: buy-side (EQH/highs). Refuser si niveau pas clair.",
    aiPromptTarget: "Confirme l'existence d'une liquidité H4 claire et où elle se situe (sell-side vs buy-side selon le biais)."
  },
  H4_DISPLACEMENT_OK: {
    tf: "H4",
    title: "Displacement validé",
    description: {
      search: "Repérer une impulsion agressive après la prise de liquidité (bougies larges, clôtures nettes).",
      smc: "Displacement = intention institutionnelle + déplacement de valeur.",
      why: "Sans displacement, OB/FVG sont faibles et le setup est fragile.",
      action: "Autorise la recherche d'une FVG liée au move."
    },
    objectiveDetailed: "Vérifier un displacement H4: mouvement impulsif net après la liquidité, avec clôtures directionnelles et cassure structurelle (BOS/CHoCH). Refuser si move lent, en escalier, ou sans cassure nette.",
    aiPromptTarget: "Confirme s'il y a un displacement H4 propre après la liquidité, et dans quel sens."
  },
  H4_FVG_OK: {
    tf: "H4",
    title: "FVG créée par displacement",
    description: {
      search: "Identifier une FVG (inefficiency) directement issue du displacement.",
      smc: "FVG = déséquilibre laissé par l'exécution agressive.",
      why: "Renforce la zone; souvent revisitée.",
      action: "Autorise l'identification de l'order block source."
    },
    objectiveDetailed: "Vérifier qu'une FVG H4 existe et qu'elle provient directement du displacement (inefficiency liée aux bougies impulsives). Refuser si FVG douteuse ou non liée à l'impulsion.",
    aiPromptTarget: "Confirme l'existence et l'emplacement d'une FVG H4 liée au displacement."
  },
  H4_OB_OK: {
    tf: "H4",
    title: "Order Block H4 valide",
    description: {
      search: "Identifier la dernière bougie opposée avant le displacement (origine du BOS).",
      smc: "OB = zone d'origine des ordres institutionnels.",
      why: "C'est la zone de travail la plus défendable.",
      action: "Fixe la zone H4 officielle; autorise H1 (réaction)."
    },
    objectiveDetailed: "Vérifier que l'OB H4 est bien la dernière bougie opposée avant le displacement (origine) et qu'il n'est pas invalidé (pas de clôture au-delà). Refuser si OB mal placé.",
    aiPromptTarget: "Confirme que l'OB H4 est correct (origine du displacement) et encore valide."
  },
  // ===================== H1 =====================
  H1_PRICE_IN_ZONE: {
    tf: "H1",
    title: "Prix dans la zone H4",
    description: {
      search: "Confirmer que le prix est réellement entré/touché la zone H4 (OB/FVG).",
      smc: "Sans mitigation/retour zone, pas de réaction attendue.",
      why: "On ne peut pas valider un sweep/CHoCH sans contact zone.",
      action: "Autorise la recherche du sweep H1."
    },
    objectiveDetailed: "Vérifier sur H1 que le prix a bien touché/est entré dans la zone H4 (OB/FVG) de manière claire. Refuser si le prix est encore à distance.",
    aiPromptTarget: "Confirme si le prix est réellement dans la zone H4 sur H1."
  },
  H1_SWEEP_OK: {
    tf: "H1",
    title: "Sweep de liquidité H1",
    description: {
      search: "Identifier un sweep H1 (prise de liquidité locale) contre le biais.",
      smc: "Sweep = chasse de stops, création de carburant.",
      why: "Sans sweep, le retournement est souvent incomplet/fragile.",
      action: "Autorise la validation du CHoCH H1."
    },
    objectiveDetailed: "Vérifier un sweep H1 clair: balayage d'un niveau évident (EQH/EQL) contre le biais. Refuser si juste du bruit sans prise nette de niveau.",
    aiPromptTarget: "Confirme s'il y a un sweep H1 clair contre le biais, et quel niveau a été balayé."
  },
  H1_CHOCH_OK: {
    tf: "H1",
    title: "CHoCH H1 confirmé",
    description: {
      search: "Valider un CHoCH H1 dans le sens du biais (break + clôture).",
      smc: "CHoCH = changement de caractère, transfert de contrôle.",
      why: "Sans CHoCH, on ne descend pas en M15.",
      action: "Autorise M15 (setup technique)."
    },
    objectiveDetailed: "Vérifier un CHoCH H1 confirmé par clôture dans le sens du biais après le sweep. Refuser si cassure uniquement par mèche ou si pas de swing clair cassé.",
    aiPromptTarget: "Confirme si un CHoCH H1 est confirmé et quel swing est cassé."
  },
  // ===================== M15 =====================
  M15_STRUCTURE_OK: {
    tf: "M15",
    title: "Structure M15 alignée",
    description: {
      search: "Vérifier que la micro-structure M15 est cohérente avec H1 et le biais.",
      smc: "Alignement microstructure avant entrée.",
      why: "Si M15 est en balance/contradictoire, l'entrée est fragile.",
      action: "Autorise la recherche du CHoCH M15."
    },
    objectiveDetailed: "Vérifier que la structure M15 est alignée avec H1/biais (pas de range ambigu). Refuser si microstructure confuse.",
    aiPromptTarget: "Confirme si la structure M15 est alignée avec H1 et le biais."
  },
  M15_CHOCH_OK: {
    tf: "M15",
    title: "CHoCH M15 confirmé",
    description: {
      search: "Valider le déclencheur M15: changement de caractère dans le sens du biais.",
      smc: "CHoCH M15 = timing fin confirmé.",
      why: "Sans CHoCH M15, l'OB d'entrée est faible.",
      action: "Autorise l'identification de l'OB M15 (zone d'entrée)."
    },
    objectiveDetailed: "Vérifier un CHoCH M15 confirmé par clôture (pas une mèche) dans le sens du biais. Refuser si faux break.",
    aiPromptTarget: "Confirme si le CHoCH M15 est confirmé par clôture et quel swing est cassé."
  },
  M15_OB_OK: {
    tf: "M15",
    title: "Order Block M15 valide (zone d'entrée)",
    description: {
      search: "Identifier l'OB M15: dernière bougie opposée avant CHoCH M15 (zone d'entrée).",
      smc: "OB M15 = zone d'exécution précise.",
      why: "C'est la zone où placer LIMIT si le prix n'est pas revenu.",
      action: "Déclenche la décision LIMIT vs MARKET."
    },
    objectiveDetailed: "Vérifier que l'OB M15 est la dernière bougie opposée avant le CHoCH M15 et qu'il reste valide. Refuser si zone mal définie ou déjà traversée.",
    aiPromptTarget: "Confirme si l'OB M15 est correct et encore valide."
  },
  // ===================== ORDER =====================
  ORDER_LIMIT_READY: {
    tf: "M15",
    title: "Décision: LIMIT ou attendre MARKET ?",
    description: {
      search: "Décider mécaniquement LIMIT vs MARKET selon la position du prix par rapport à l'OB M15.",
      smc: "Rule-based execution: pas de subjectivité.",
      why: "Évite de poser un LIMIT quand le prix est déjà dans la zone (trop tard).",
      action: "Si prix pas revenu → poser LIMIT. Sinon → attendre M5 et entrer MARKET sur rejet+momentum."
    },
    objectiveDetailed: "Décider LIMIT vs MARKET: si le prix n'a pas encore retest l'OB M15, LIMIT autorisé; si le prix est déjà dans l'OB M15, LIMIT interdit → attendre confirmation M5 pour MARKET.",
    aiPromptTarget: "Dis uniquement: LIMIT ou MARKET, puis 2 preuves max (prix vs OB M15)."
  },
  WAIT_MARKET_CONFIRMATION: {
    tf: "M15",
    title: "Attendre confirmation MARKET (prix déjà dans l'OB)",
    description: {
      search: "Confirmer que le prix est déjà dans l'OB M15, donc on ne pose pas LIMIT.",
      smc: "Late entry rule: pas de LIMIT si déjà mitigé.",
      why: "Évite l'entrée 'trop tardive' sans signal de rejet.",
      action: "Descendre en M5 pour exécuter MARKET seulement sur rejet + momentum."
    },
    objectiveDetailed: "Confirmer que le prix est déjà dans l'OB M15, donc LIMIT interdit. On attend M5: rejet + momentum pour MARKET.",
    aiPromptTarget: "Confirme que le prix est déjà dans l'OB M15 → attendre M5 pour MARKET."
  },
  LIMIT_PLACED: {
    tf: "M15",
    title: "Ordre LIMIT posé",
    description: {
      search: "Confirmer qu'un ordre LIMIT a été posé au bon endroit (OB M15) avec sens imposé par biais.",
      smc: "Execution plan: LIMIT = meilleure entrée si retest à venir.",
      why: "Structure le trade avant M5; M5 sert à valider ou annuler.",
      action: "Passe en M5 pour validation (tap/rejet/momentum) après déclenchement."
    },
    objectiveDetailed: "Confirmer que l'ordre LIMIT est placé sur l'OB M15 dans le sens du biais (BULL→BUY LIMIT, BEAR→SELL LIMIT) et que l'OB est toujours valide.",
    aiPromptTarget: "Confirme que l'ordre LIMIT (virtuel) est logique: placé sur OB M15, sens conforme au biais."
  },
  // ===================== M5 =====================
  M5_TAP_OK: {
    tf: "M5",
    title: "Tap précis (contact zone)",
    description: {
      search: "Confirmer le contact net du prix avec la zone d'entrée (OB/FVG M15).",
      smc: "Tap = test de la zone.",
      why: "Sans tap, pas de rejet valide.",
      action: "Autorise la validation du rejet M5."
    },
    objectiveDetailed: "Vérifier que le prix a touché précisément la zone d'entrée (OB/FVG M15). Refuser si le prix reste à distance.",
    aiPromptTarget: "Confirme s'il y a un tap précis dans la zone d'entrée."
  },
  M5_REJECTION_OK: {
    tf: "M5",
    title: "Rejet clair M5",
    description: {
      search: "Mèche contre la zone + clôture dans le sens du biais.",
      smc: "Rejection candle = défense de zone.",
      why: "Sans rejet clair, l'entrée est aléatoire.",
      action: "Autorise la validation du momentum."
    },
    objectiveDetailed: "Vérifier un rejet M5 clair: wick contre la zone + clôture dans le sens du biais. Refuser si bougie neutre/doji.",
    aiPromptTarget: "Confirme s'il y a un rejet clair M5 (mèche + clôture directionnelle)."
  },
  M5_MOMENTUM_OK: {
    tf: "M5",
    title: "Momentum immédiat",
    description: {
      search: "Expansion immédiate post-rejet (accélération, pas de stagnation).",
      smc: "Momentum = validation d'intention à l'exécution.",
      why: "Sans momentum, on annule: risque de chop et stop.",
      action: "Déclenche l'exécution (LIMIT exécuté ou MARKET sur clôture)."
    },
    objectiveDetailed: "Vérifier un momentum immédiat après rejet: bougie(s) d'expansion dans le sens du biais. Refuser si stagnation/lenteur.",
    aiPromptTarget: "Confirme s'il y a un momentum immédiat post-rejet."
  },
  MARKET_EXECUTION: {
    tf: "M5",
    title: "Entrée MARKET (si pas de LIMIT)",
    description: {
      search: "Exécuter MARKET uniquement après tap + rejet + momentum.",
      smc: "Market entry = déclenchement sur confirmation, pas sur anticipation.",
      why: "Empêche d'entrer sans preuve de défense.",
      action: "Entrée MARKET dans le sens du biais (BULL→BUY, BEAR→SELL)."
    },
    objectiveDetailed: "Confirmer que toutes les conditions M5 (tap, rejet, momentum) sont réunies pour exécuter MARKET si aucun LIMIT n'a été posé.",
    aiPromptTarget: "Confirme si les conditions sont réunies pour une entrée MARKET (tap+rejet+momentum)."
  },
  TRADE_EXECUTED: {
    tf: "M5",
    title: "TRADE EXÉCUTÉ",
    description: {
      search: "Toutes les conditions sont validées; exécution conforme au playbook.",
      smc: "Trade = conséquence du système, pas un choix émotionnel.",
      why: "Assure discipline et répétabilité.",
      action: "Passer à la gestion active (hors scope ici)."
    },
    objectiveDetailed: "Confirmer que le trade respecte le playbook (chemin complet validé).",
    aiPromptTarget: "Confirme si le trade est conforme au playbook (toutes conditions validées)."
  },
  CANCEL_TRADE: {
    tf: "M5",
    title: "ANNULER LE TRADE",
    description: {
      search: "Annuler en cas d'absence de rejet/momentum ou zone traversée sans réaction.",
      smc: "No trade rule = protection du capital.",
      why: "Le setup est invalide/fragile.",
      action: "Retour à l'état parent (M15 ou H1 selon ton moteur)."
    },
    objectiveDetailed: "Confirmer que les conditions d'annulation sont présentes (pas de rejet / pas de momentum / zone traversée).",
    aiPromptTarget: "Confirme si le trade doit être annulé (conditions invalidantes présentes)."
  }
};

// =====================================================
// AI Prompt Builder (cumulatif et context-aware)
// =====================================================

function formatCheckedPath(checkedSteps, bias, valueZone) {
  const lines = [];
  for (const stepState of checkedSteps) {
    const step = stepLibrary[stepState];
    if (!step) continue;
    lines.push(`- ✅ ${stepState} — ${step.title}`);
  }
  if (bias && bias !== "UNKNOWN") {
    lines.push(`- ℹ️ Biais D1: ${bias}`);
  }
  if (valueZone && valueZone !== "UNKNOWN") lines.push(`- ℹ️ Zone de valeur D1: ${valueZone}`);
  return lines.length ? lines.join("\n") : "- (Aucune étape validée pour l'instant)";
}

function getAllowedDirection(bias) {
  if (bias === "BULLISH") return "ACHAT uniquement (BULLISH → BUY à l'exécution)";
  if (bias === "BEARISH") return "VENTE uniquement (BEARISH → SELL à l'exécution)";
  return "UNKNOWN (sens non défini tant que le biais n'est pas validé)";
}

/**
 * Construit un prompt IA strict, cumulatif et context-aware.
 * @param {Object} ctx - contexte {checkedSteps, bias, valueZone, symbol, notes}
 * @param {string} stateName - nom de l'état à valider (clé stepLibrary)
 * @returns {string}
 */
function buildAIPrompt(ctx, stateName) {
  const step = stepLibrary[stateName];
  if (!step) return `ERREUR: état inconnu: ${stateName}`;

  const symbol = (ctx.symbol || "").trim() || "UNKNOWN";
  const bias = ctx.bias || "UNKNOWN";
  const valueZone = ctx.valueZone || "UNKNOWN";
  const notes = (ctx.notes || "").trim();
  const mode = ctx.mode || "SWING";

  const checkedPath = formatCheckedPath(ctx.checkedSteps || [], bias, valueZone);
  const allowedDirection = getAllowedDirection(bias);
  
  // Récupérer le TF dynamique en fonction du mode
  let tfForStep = step.tf; // fallback au TF statique
  
  // Mapper les TF statiques (D1, H4, H1, M15, M5) aux TF dynamiques selon le mode
  if (step.tf === "D1") tfForStep = getTFForLevel(mode, "CONTEXT");
  else if (step.tf === "H4") tfForStep = getTFForLevel(mode, "ZONE");
  else if (step.tf === "H1") tfForStep = getTFForLevel(mode, "REACTION");
  else if (step.tf === "M15") tfForStep = getTFForLevel(mode, "SETUP");
  else if (step.tf === "M5") tfForStep = getTFForLevel(mode, "EXECUTION");

  const stepObjective = step.objectiveDetailed;
  const stepTarget = step.aiPromptTarget;

  return `RÔLE
Tu es un valideur SMC strict (style desk). Tu dois répondre UNIQUEMENT:
1) Décision: ✅ VALIDER ou ❌ REFUSER
2) Preuves: 1 à 3 puces MAX (très courtes, factuelles)
3) Invalidation: 1 phrase (ce qui invaliderait la condition)
Aucune projection, aucun scénario, aucun "ça dépend". Si ambigu → REFUSER.

SYSTÈME (CONTEXTE FIXE)
Nous suivons un playbook SMC multi-timeframe hiérarchique.
Mode de trading: ${mode}
Architectures:
- SWING: D1 (contexte) → H4 (zone) → H1 (réaction) → M15 (setup) → M5 (exécution)
- INTRADAY: H4 (contexte) → H1 (zone) → M15 (réaction) → M5 (setup) → M1 (exécution)

Chaque étape doit être validée avant de cocher la case correspondante.

CONTEXTE ACTUEL (CHEMIN DÉJÀ VALIDÉ)
- Actif: ${symbol}
- Mode de trading: ${mode}
- Étape actuelle à valider: ${stateName} — ${step.title}
- Timeframe à analyser: ${tfForStep} (mode ${mode})

Résumé des validations déjà cochées (du haut vers le bas):
${checkedPath}

Contraintes déduites:
- Biais: ${bias}
- Zone de valeur: ${valueZone}
- Sens autorisé: ${allowedDirection}
- Notes utilisateur: ${notes || "(aucune)"}

OBJECTIF DE CETTE VALIDATION (CE QUE TU DOIS VÉRIFIER)
- Cible: ${stepTarget}
- Détails: ${stepObjective}

RÈGLES DE VALIDATION (TRÈS STRICTES)
- Analyse UNIQUEMENT sur le timeframe ${tfForStep} visible sur la capture.
- Si le TF sur la capture ne correspond pas → ❌ REFUSER.
- Si la capture ne permet pas de conclure clairement → ❌ REFUSER.
- Interdit de deviner des niveaux invisibles.

INPUT
Je joins une capture d'écran du graphique ${tfForStep}. Confirme si l'étape ${stateName} est valide.`;
}

const stateFlow = [
  "START",
  "D1_STRUCTURE_OK",
  "D1_BOS_OK",
  "D1_BIAS_BULLISH",
  "D1_BIAS_BEARISH",
  "D1_DISCOUNT_OK",
  "D1_PREMIUM_OK",
  "H4_STRUCTURE_OK",
  "H4_LIQUIDITY_OK",
  "H4_DISPLACEMENT_OK",
  "H4_FVG_OK",
  "H4_OB_OK",
  "H1_PRICE_IN_ZONE",
  "H1_SWEEP_OK",
  "H1_CHOCH_OK",
  "M15_STRUCTURE_OK",
  "M15_CHOCH_OK",
  "M15_OB_OK",
  "ORDER_LIMIT_READY",
  "WAIT_MARKET_CONFIRMATION",
  "LIMIT_PLACED",
  "M5_TAP_OK",
  "M5_REJECTION_OK",
  "M5_MOMENTUM_OK",
  "MARKET_EXECUTION",
  "TRADE_EXECUTED",
  "CANCEL_TRADE"
];

const stepDescriptions = {
  "d1-structure": {
    title: "Structure D1 valide",
    search: "Une structure Daily lisible et non ambiguë : HH / HL pour un contexte haussier, LL / LH pour un contexte baissier.",
    smc: "La structure représente l'architecture du marché à long terme.",
    why: "Sans structure claire, le marché est en équilibre ou en transition → aucun avantage statistique.",
    action: "Tant que cette case n'est pas cochée, aucune autre étape n'est accessible. C'est le point de départ obligatoire."
  },
  "d1-bos": {
    title: "BOS D1 confirmé",
    search: "Une clôture Daily qui casse le dernier swing structurel.",
    smc: "Le BOS valide une intention directionnelle réelle, pas un simple test de liquidité.",
    why: "Sans BOS, la structure peut être illusoire ou en range.",
    action: "Valide que le marché a choisi un sens. Autorise la sélection du biais (bull / bear)."
  },
  "d1-bias-bull": {
    title: "Biais haussier (BULLISH)",
    search: "Un contexte où la structure est haussière et le marché est en expansion ou revient en discount.",
    smc: "Un environnement favorable aux achats, mais pas encore une entrée.",
    why: "Le biais sert à restreindre les recherches futures et empêcher tout scénario vendeur.",
    action: "Verrouille la logique en mode haussier. Désactive toute option incompatible (premium, buy-side sweep, etc.)."
  },
  "d1-bias-bear": {
    title: "Biais baissier (BEARISH)",
    search: "Un contexte de distribution ou de retour en premium.",
    smc: "Un environnement favorable aux ventes, sans exécution immédiate.",
    why: "Empêcher toute tentative d'achat contre le flux institutionnel.",
    action: "Verrouille la logique en mode baissier. Désactive le discount et les scénarios acheteurs."
  },
  "d1-discount": {
    title: "Prix en DISCOUNT (si BULLISH)",
    search: "Un prix situé sous l'équilibre de la dernière impulsion Daily.",
    smc: "Une zone où les institutions ont intérêt à accumuler.",
    why: "Acheter en premium en biais haussier = mauvais RR + forte probabilité de stop.",
    action: "Autorise le passage en H4. Sans discount validé → interdiction d'entrer plus bas."
  },
  "d1-premium": {
    title: "Prix en PREMIUM (si BEARISH)",
    search: "Un prix situé au-dessus de l'équilibre.",
    smc: "Zone de distribution potentielle.",
    why: "Vendre en discount = vente tardive, faible espérance.",
    action: "Autorise le passage en H4. Bloque toute recherche prématurée."
  },
  "h4-structure": {
    title: "Structure H4 alignée D1",
    search: "Une structure H4 cohérente avec le biais Daily.",
    smc: "Confirmation intermédiaire que le marché ne distribue pas contre le HTF.",
    why: "Une zone H4 contre D1 est statistiquement fragile.",
    action: "Autorise la recherche de liquidité. En cas d'invalidation → retour à H4_STRUCTURE."
  },
  "h4-liquidity": {
    title: "Liquidité H4 identifiée",
    search: "Une zone claire où les stops sont visibles : BULLISH → sell-side, BEARISH → buy-side.",
    smc: "La source de carburant du prochain mouvement.",
    why: "Le marché ne se déplace pas sans liquidité.",
    action: "Sans liquidité → aucune zone valide. Condition obligatoire avant le displacement."
  },
  "h4-displacement": {
    title: "Displacement validé",
    search: "Une impulsion rapide, agressive, après la prise de liquidité.",
    smc: "L'empreinte de l'exécution institutionnelle.",
    why: "Sans displacement : OB faible, FVG non exploitable.",
    action: "Valide l'intention. Autorise la recherche de FVG."
  },
  "h4-fvg": {
    title: "FVG créée par displacement",
    search: "Une inefficience laissée par l'impulsion.",
    smc: "Un déséquilibre de marché.",
    why: "Les marchés ont tendance à revisiter ces zones.",
    action: "Renforce la zone. Prépare l'identification de l'OB."
  },
  "h4-ob": {
    title: "Order Block H4 valide",
    search: "La dernière bougie opposée avant le displacement.",
    smc: "La zone d'origine des ordres institutionnels.",
    why: "C'est la zone la plus défendable.",
    action: "Définit la zone de travail officielle. Toute invalidation ici reset H1/M15/M5."
  },
  "h1-price": {
    title: "Prix dans la zone H4",
    search: "Un retour effectif du prix dans la zone.",
    smc: "Contact avec la zone d'intérêt H4.",
    why: "Sans contact → pas de réaction possible.",
    action: "Active la surveillance H1."
  },
  "h1-sweep": {
    title: "Sweep de liquidité H1",
    search: "Un balayage de stops contre le biais.",
    smc: "Prise de liquidité avant impulsion.",
    why: "Créer le carburant du retournement.",
    action: "Condition obligatoire avant CHoCH."
  },
  "h1-choch": {
    title: "CHoCH H1 confirmé",
    search: "Un changement de caractère H1 dans le sens du biais.",
    smc: "Changement de contrôle du marché.",
    why: "Confirme que le contrôle change de camp.",
    action: "Autorise le passage en M15. En cas d'échec → retour H4_OB_OK."
  },
  "m15-structure": {
    title: "Structure M15 alignée",
    search: "Une micro-structure cohérente avec H1.",
    smc: "Structure fine alignée avec le HTF.",
    why: "Garantir la cohérence multi-timeframe.",
    action: "Condition de base avant toute entrée."
  },
  "m15-choch": {
    title: "CHoCH M15 confirmé",
    search: "Le déclencheur technique précis.",
    smc: "Signal de changement de caractère en M15.",
    why: "C'est le signal que le timing est correct.",
    action: "Autorise la définition de la zone d'entrée."
  },
  "m15-ob": {
    title: "Order Block M15 valide",
    search: "La zone exacte d'entrée.",
    smc: "Zone d'origine des ordres institutionnels en M15.",
    why: "Définir le point d'entrée précis.",
    action: "À cette étape, on sait : le sens du trade, la zone, le type d'ordre (limit ou market)."
  },
  "order-limit": {
    title: "Prix PAS encore revenu → LIMIT",
    search: "Le prix n'est pas encore revenu dans l'OB M15.",
    smc: "Opportunité de placer un ordre limite.",
    why: "Maximiser le R:R en entrant au meilleur prix.",
    action: "Active la possibilité de poser un ordre LIMIT."
  },
  "order-market": {
    title: "Prix DÉJÀ dans OB → attente MARKET",
    search: "Le prix est déjà dans la zone d'entrée.",
    smc: "Attente de confirmation M5 pour entrée au marché.",
    why: "Ne pas manquer l'opportunité si le prix est déjà dans la zone.",
    action: "Active la surveillance M5 pour confirmation avant entrée MARKET."
  },
  "limit-placed": {
    title: "Ordre LIMIT posé",
    search: "L'ordre limite a été placé dans l'OB M15.",
    smc: "Ordre en attente d'exécution.",
    why: "Attendre l'exécution au prix optimal.",
    action: "Surveiller l'exécution ou l'invalidation de la zone."
  },
  "m5-tap": {
    title: "Tap précis",
    search: "Contact exact avec l'OB M15.",
    smc: "Point de contact précis avec la zone d'intérêt.",
    why: "Valider que le prix atteint bien la zone prévue.",
    action: "Première validation de l'entrée potentielle."
  },
  "m5-rejection": {
    title: "Rejet clair",
    search: "Mèche + clôture dans le sens du biais.",
    smc: "Rejet visible de la zone.",
    why: "Confirmer que la zone est défendue.",
    action: "Deuxième validation avant momentum."
  },
  "m5-momentum": {
    title: "Momentum immédiat",
    search: "Accélération post-rejet.",
    smc: "Impulsion confirmant l'exécution institutionnelle.",
    why: "Valider que le mouvement commence réellement.",
    action: "LIMIT déjà posé → gestion. Sinon → MARKET exécuté."
  },
  "market-exec": {
    title: "Entrée MARKET",
    search: "Exécution au marché après validation M5.",
    smc: "Entrée immédiate au prix actuel.",
    why: "Capitaliser sur la confirmation sans attendre un meilleur prix.",
    action: "Entrée effective dans le trade (BUY si BULL, SELL si BEAR)."
  },
  "trade-executed": {
    title: "✓ TRADE EXÉCUTÉ",
    search: "Le trade est en position.",
    smc: "Position ouverte et gérée.",
    why: "Trade validé par l'ensemble du workflow.",
    action: "Gestion du trade : TP, SL, trailing selon invalidation H4."
  },
  "cancel": {
    title: "✗ Trade annulé",
    search: "Conditions d'entrée invalidées.",
    smc: "Setup compromis avant exécution.",
    why: "Préserver le capital face à une invalidation.",
    action: "Retour à M15_OB_OK pour réévaluer ou chercher un nouveau setup."
  }
};

const stageRank = {
  START: 0,
  D1_STRUCTURE_OK: 1,
  D1_BOS_OK: 2,
  D1_BIAS_BULLISH: 3,
  D1_BIAS_BEARISH: 3,
  D1_DISCOUNT_OK: 4,
  D1_PREMIUM_OK: 4,
  H4_STRUCTURE_OK: 5,
  H4_LIQUIDITY_OK: 6,
  H4_DISPLACEMENT_OK: 7,
  H4_FVG_OK: 8,
  H4_OB_OK: 9,
  H1_PRICE_IN_ZONE: 10,
  H1_SWEEP_OK: 11,
  H1_CHOCH_OK: 12,
  M15_STRUCTURE_OK: 13,
  M15_CHOCH_OK: 14,
  M15_OB_OK: 15,
  ORDER_LIMIT_READY: 16,
  WAIT_MARKET_CONFIRMATION: 16,
  LIMIT_PLACED: 17,
  M5_TAP_OK: 18,
  M5_REJECTION_OK: 19,
  M5_MOMENTUM_OK: 20,
  MARKET_EXECUTION: 21,
  TRADE_EXECUTED: 22,
  CANCEL_TRADE: 99
};

const groupConfig = {
  D1: {
    steps: 4,
    unlockState: "START",
    rollbackTargets: ["START", "D1_STRUCTURE_OK", "D1_BOS_OK", "D1_BOS_OK"]
  },
  H4: {
    steps: 5,
    statesPerStep: [
      "H4_STRUCTURE_OK",
      "H4_LIQUIDITY_OK",
      "H4_DISPLACEMENT_OK",
      "H4_FVG_OK",
      "H4_OB_OK"
    ],
    unlockState: ["D1_DISCOUNT_OK", "D1_PREMIUM_OK"],
    rollbackTargets: [
      "D1_BOS_OK",
      "H4_STRUCTURE_OK",
      "H4_LIQUIDITY_OK",
      "H4_DISPLACEMENT_OK",
      "H4_FVG_OK"
    ]
  },
  H1: {
    steps: 3,
    statesPerStep: ["H1_PRICE_IN_ZONE", "H1_SWEEP_OK", "H1_CHOCH_OK"],
    unlockState: "H4_OB_OK",
    rollbackTarget: "H4_OB_OK"
  },
  M15: {
    steps: 3,
    statesPerStep: ["M15_STRUCTURE_OK", "M15_CHOCH_OK", "M15_OB_OK"],
    unlockState: "H1_CHOCH_OK",
    rollbackTarget: "H1_CHOCH_OK"
  },
  ORDER: {
    steps: 2,
    unlockState: "M15_OB_OK",
    rollbackTargets: ["M15_OB_OK", "M15_OB_OK"]
  },
  M5: {
    steps: 5,
    unlockState: ["LIMIT_PLACED", "WAIT_MARKET_CONFIRMATION"],
    rollbackTarget: "M15_OB_OK"
  },
  CANCEL: {
    steps: 1,
    unlockState: ["ORDER_LIMIT_READY", "LIMIT_PLACED", "M5_TAP_OK", "M5_REJECTION_OK"],
    rollbackTarget: "M15_OB_OK"
  }
};

let currentState = "START";
let currentBias = "UNKNOWN";
let currentValueZone = "UNKNOWN";
let currentOrderType = null;
let trainingMode = false;
let isHydrating = false;
let seenSteps = new Set();

const STORAGE_KEY = "smc_sessions_v1";

const appState = {
  sessions: [],
  activeSessionId: null,
  preferences: {
    trainingMode: false
  }
};

const SessionStore = {
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
    // Valider le mode
    const validMode = MODE_CONFIG[mode] ? mode : "SWING";
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
      // mode est conservé intentionnellement
    });
    session.updatedAt = Date.now();
    this.save();
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

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const dashboardView = document.getElementById("dashboardView");
const sessionView = document.getElementById("sessionView");
const dashboardGrid = document.getElementById("dashboardGrid");
const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardSearch = document.getElementById("dashboardSearch");
const biasFilter = document.getElementById("biasFilter");
const newSessionBtn = document.getElementById("newSessionBtn");
const backToDashboard = document.getElementById("backToDashboard");
const sessionSymbol = document.getElementById("sessionSymbol");
const progressFill = document.getElementById("progressFill");
const logList = document.getElementById("logList");
const resetSessionBtn = document.getElementById("resetSessionBtn");
const exportSessionBtn = document.getElementById("exportSessionBtn");
const biasBadge = document.getElementById("biasBadge");
const modeBadge = document.getElementById("modeBadge");
const valueZoneBadge = document.getElementById("valueZoneBadge");
const currentStateBadge = document.getElementById("currentStateBadge");
const trainingModeToggle = document.getElementById("trainingModeToggle");
const symbolInput = document.getElementById("symbolInput");
const notesInput = document.getElementById("notesInput");
const messageList = document.getElementById("messageList");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabContents = Array.from(document.querySelectorAll(".tab-content"));

const allCheckboxes = Array.from(document.querySelectorAll("input[type=checkbox][data-group]"));
const groupedCheckboxes = allCheckboxes.reduce((acc, checkbox) => {
  const group = checkbox.dataset.group;
  if (!acc[group]) acc[group] = [];
  acc[group].push(checkbox);
  return acc;
}, {});

Object.values(groupedCheckboxes).forEach((items) =>
  items.sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step))
);

function setView(view) {
  dashboardView.classList.toggle("active", view === "dashboard");
  sessionView.classList.toggle("active", view === "session");
}

function formatDate(ts) {
  return new Date(ts).toLocaleString("fr-FR", { hour12: false });
}

function getNextAction(state) {
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

function renderDashboard() {
  const query = dashboardSearch.value.trim().toLowerCase();
  const bias = biasFilter.value;
  const sessions = appState.sessions.filter((session) => {
    const matchesQuery = !query || session.symbol.toLowerCase().includes(query);
    const matchesBias = bias === "ALL" || session.bias === bias;
    return matchesQuery && matchesBias;
  });

  dashboardGrid.innerHTML = "";
  dashboardEmpty.style.display = sessions.length ? "none" : "block";

  sessions.forEach((session) => {
    const card = document.createElement("div");
    card.className = "dashboard-card";
    const mode = session.mode || "SWING";
    card.innerHTML = `
      <h4>${session.symbol}</h4>
      <div class="dashboard-meta">
        <div>Mode: <strong>${mode}</strong></div>
        <div>Bias: ${session.bias}</div>
        <div>Value Zone: ${session.valueZone}</div>
        <div>State: ${session.currentState}</div>
        <div>Next: ${getNextAction(session.currentState)}</div>
        <div>Updated: ${formatDate(session.updatedAt)}</div>
      </div>
      <div class="dashboard-actions">
        <button class="btn-primary" type="button" data-action="open">Open</button>
        <button class="btn-ghost" type="button" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector("[data-action='open']").addEventListener("click", () => {
      SessionStore.setActiveSession(session.id);
      navigateToSession(session.id);
    });

    card.querySelector("[data-action='delete']").addEventListener("click", () => {
      if (confirm(`Supprimer la session ${session.symbol} ?`)) {
        SessionStore.deleteSession(session.id);
        renderDashboard();
      }
    });

    dashboardGrid.appendChild(card);
  });
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

function bindUIToSession(session) {
  if (!session) return;
  isHydrating = true;
  currentState = session.currentState || "START";
  currentBias = session.bias || "UNKNOWN";
  currentValueZone = session.valueZone || "UNKNOWN";
  currentOrderType = session.orderType || null;
  const currentMode = session.mode || "SWING";
  seenSteps = new Set(session.seenSteps || []);
  trainingMode = Boolean(appState.preferences?.trainingMode);
  trainingModeToggle.checked = trainingMode;
  sessionSymbol.textContent = session.symbol;
  symbolInput.value = session.symbol;
  notesInput.value = session.notes || "";

  const checkedSet = new Set(session.checkedSteps || []);
  allCheckboxes.forEach((cb) => {
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
  // Rendu des ChoiceGroups après le chargement de la session
  renderChoiceGroups();
}

/**
 * Rend tous les ChoiceGroups présents dans les cartes
 */
function renderChoiceGroups() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  
  // BIAS: Bullish vs Bearish en D1
  const d1Card = document.getElementById("card-d1");
  if (d1Card && !d1Card.querySelector("[data-choice-group-id='BIAS']")) {
    const biasGroup = choiceGroups.find(g => g.id === "BIAS");
    const checksDiv = d1Card.querySelector(".checks");
    if (biasGroup && checksDiv) {
      const biasEl = renderChoiceGroup(biasGroup);
      checksDiv.insertBefore(biasEl, checksDiv.firstChild);
      
      // Masquer les labels avec les checkboxes du biais
      const biasCheckboxes = checksDiv.querySelectorAll(
        'input[data-state="D1_BIAS_BULLISH"], input[data-state="D1_BIAS_BEARISH"]'
      );
      biasCheckboxes.forEach(cb => {
        const label = cb.closest("label");
        if (label) label.style.display = "none";
      });
    }
  }
  
  // VALUE_ZONE: Discount vs Premium en D1
  const d1Card2 = document.getElementById("card-d1");
  if (d1Card2 && !d1Card2.querySelector("[data-choice-group-id='VALUE_ZONE']")) {
    const valueZoneGroup = choiceGroups.find(g => g.id === "VALUE_ZONE");
    const checksDiv = d1Card2.querySelector(".checks");
    if (valueZoneGroup && checksDiv) {
      const valueZoneEl = renderChoiceGroup(valueZoneGroup);
      checksDiv.appendChild(valueZoneEl);
      
      // Masquer les labels avec les checkboxes de value zone
      const valueCheckboxes = checksDiv.querySelectorAll(
        'input[data-state="D1_DISCOUNT_OK"], input[data-state="D1_PREMIUM_OK"]'
      );
      valueCheckboxes.forEach(cb => {
        const label = cb.closest("label");
        if (label) label.style.display = "none";
      });
    }
  }
  
  // ORDER_TYPE: Limit vs Market dans ORDER card
  const orderCard = document.getElementById("card-order");
  if (orderCard && !orderCard.querySelector("[data-choice-group-id='ORDER_TYPE']")) {
    const orderTypeGroup = choiceGroups.find(g => g.id === "ORDER_TYPE");
    const checksDiv = orderCard.querySelector(".checks");
    if (orderTypeGroup && checksDiv) {
      const orderTypeEl = renderChoiceGroup(orderTypeGroup);
      checksDiv.insertBefore(orderTypeEl, checksDiv.firstChild);
      
      // Masquer les labels avec les checkboxes de type d'ordre
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

/**
 * Gère la sélection d'une option dans un ChoiceGroup
 * @param {string} groupId - ID du groupe
 * @param {string} selectedState - État sélectionné
 */
function handleChoiceGroupSelection(groupId, selectedState) {
  if (isHydrating) return;
  
  const group = choiceGroups.find((g) => g.id === groupId);
  if (!group) return;
  
  // Récupérer l'option sélectionnée
  const selectedOption = group.options.find((opt) => opt.state === selectedState);
  if (!selectedOption) return;
  
  // Décocher les autres options du groupe
  group.options.forEach((option) => {
    if (option.state !== selectedState) {
      const checkbox = allCheckboxes.find((cb) => cb.dataset.state === option.state);
      if (checkbox && checkbox.checked) {
        checkbox.checked = false;
      }
    }
  });
  
  // Valider la nouvelle option
  const selectedCheckbox = allCheckboxes.find((cb) => cb.dataset.state === selectedState);
  if (selectedCheckbox) {
    selectedCheckbox.checked = true;
    // Déclencher le changement
    handleCheck({ target: selectedCheckbox });
  }
}

/**
 * Mappe un état (state) à un stepId pour les info/AI buttons
 * @param {string} state - État (ex: "D1_BIAS_BULLISH")
 * @returns {string} stepId (ex: "d1-bias-bull")
 */
function mapStateToStepId(state) {
  const mapping = {
    "D1_BIAS_BULLISH": "d1-bias-bull",
    "D1_BIAS_BEARISH": "d1-bias-bear",
    "D1_DISCOUNT_OK": "d1-discount",
    "D1_PREMIUM_OK": "d1-premium",
    "ORDER_LIMIT_READY": "order-limit",
    "WAIT_MARKET_CONFIRMATION": "order-market"
  };
  return mapping[state] || state;
}

/**
 * Rend un ChoiceGroup (segmented control) pour un groupe de choix exclusifs
 * @param {Object} choiceGroup - Configuration du groupe de choix
 * @returns {HTMLElement}
 */
function renderChoiceGroup(choiceGroup) {
  const container = document.createElement("div");
  container.className = "choice-group-container";
  container.dataset.choiceGroupId = choiceGroup.id;
  
  // En-tête
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
  
  // Segmented control (options)
  const control = document.createElement("div");
  control.className = "segmented-control";
  
  choiceGroup.options.forEach((option) => {
    const checkedSet = new Set(collectCheckedSteps());
    const isChecked = checkedSet.has(option.state);
    const isDisabled = option.condition && !option.condition();
    
    // Wrapper pour l'option (flex-direction: column pour aligner verticalement)
    const optionWrapper = document.createElement("div");
    optionWrapper.className = "segmented-option-wrapper";
    optionWrapper.style.flexDirection = "column";
    optionWrapper.style.alignItems = "flex-start";
    optionWrapper.style.gap = "8px";
    
    // Radio button (hidden)
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = choiceGroup.id;
    radio.value = option.state;
    radio.checked = isChecked;
    radio.disabled = isDisabled;
    radio.dataset.choiceGroupId = choiceGroup.id;
    radio.dataset.state = option.state;
    radio.className = "segmented-radio";
    
    // Wrapper horizontal pour le bouton et les actions
    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.width = "100%";
    buttonRow.style.gap = "6px";
    
    // Label (visible button)
    const label = document.createElement("label");
    label.className = "segmented-button";
    label.style.flex = "1";
    if (isChecked) label.classList.add("active");
    if (isDisabled) label.classList.add("disabled");
    
    // Contenu du bouton
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
    
    // Info button (ℹ️)
    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "choice-info-btn";
    infoBtn.textContent = "ℹ️";
    infoBtn.dataset.stepId = mapStateToStepId(option.state);
    infoBtn.disabled = isDisabled;
    infoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showPanel(infoBtn.dataset.stepId);
    });
    
    // AI button (?)
    const aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "choice-ai-btn";
    aiBtn.textContent = "?";
    aiBtn.dataset.stepId = mapStateToStepId(option.state);
    aiBtn.disabled = isDisabled;
    aiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const stateName = option.state;
      openAIPromptModal(stateName);
    });
    
    // Assemble: radio + ligne de bouton
    buttonRow.appendChild(radio);
    buttonRow.appendChild(label);
    buttonRow.appendChild(infoBtn);
    buttonRow.appendChild(aiBtn);
    
    optionWrapper.appendChild(buttonRow);
    
    control.appendChild(optionWrapper);
    
    // Event listener pour le radio
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        handleChoiceGroupSelection(choiceGroup.id, option.state);
      }
    });
  });
  
  container.appendChild(control);
  return container;
}

function renderSessionView() {
  const session = SessionStore.getActiveSession();
  if (!session) {
    navigateToDashboard();
    return;
  }
  setView("session");
  bindUIToSession(session);
}

function renderTransitions() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  logList.innerHTML = "";
  const entries = [...session.transitions].reverse();
  entries.forEach((item) => {
    const li = document.createElement("li");
    li.className = `log-entry ${item.type === "warn" ? "status-warn" : "status-ok"}`;
    const time = new Date(item.ts).toLocaleTimeString("fr-FR", { hour12: false });
    const label = item.type === "warn" ? "Rollback" : "Transition";
    li.innerHTML = `<span>${label}: ${item.from} → ${item.to}</span><span>${time}</span>`;
    logList.appendChild(li);
  });
}

function renderMessages() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  messageList.innerHTML = "";
  session.messages.slice().reverse().forEach((message) => {
    const item = document.createElement("div");
    item.className = "message-item";
    item.innerHTML = `
      <div class="message-meta">${formatDate(message.ts)}</div>
      <div>${message.text}</div>
    `;
    messageList.appendChild(item);
  });
}

function collectCheckedSteps() {
  const checkedStates = allCheckboxes.filter((cb) => cb.checked).map((cb) => cb.dataset.state);
  return stateFlow.filter((state) => checkedStates.includes(state));
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
    notes: notesInput.value || ""
  });
  renderDashboard();
}

function logTransition(from, to, type = "ok") {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  SessionStore.addTransition(session.id, from, to, type);
  renderTransitions();
}

function syncBiasState(newState) {
  if (newState === "D1_BIAS_BULLISH") {
    currentBias = "BULLISH";
  }
  if (newState === "D1_BIAS_BEARISH") {
    currentBias = "BEARISH";
  }
  if (["START", "D1_STRUCTURE_OK", "D1_BOS_OK"].includes(newState)) {
    currentBias = "UNKNOWN";
  }
  if (newState === "D1_DISCOUNT_OK") {
    currentValueZone = "DISCOUNT";
  }
  if (newState === "D1_PREMIUM_OK") {
    currentValueZone = "PREMIUM";
  }
  if (["START", "D1_STRUCTURE_OK", "D1_BOS_OK", "D1_BIAS_BULLISH", "D1_BIAS_BEARISH"].includes(newState)) {
    currentValueZone = "UNKNOWN";
  }
  if (newState === "ORDER_LIMIT_READY") {
    currentOrderType = "LIMIT";
  }
  if (newState === "WAIT_MARKET_CONFIRMATION") {
    currentOrderType = "MARKET";
  }
  if (newState === "START" || newState === "M15_OB_OK") {
    currentOrderType = null;
  }
}

function setState(newState) {
  if (currentState === newState) return;
  const previous = currentState;
  currentState = newState;
  syncBiasState(newState);
  logTransition(previous, newState, "ok");
  updateUI();
  persistSessionState();
}

function rollbackTo(targetState) {
  const previous = currentState;
  currentState = targetState;
  syncBiasState(targetState);
  logTransition(previous, targetState, "warn");
  resetBelow(targetState);
  updateUI();
  flashInvalidation(previous);
  persistSessionState();
}

function getStageRank(state) {
  return stageRank[state] ?? 0;
}

function getUnlockRank(unlockState) {
  if (Array.isArray(unlockState)) {
    return Math.max(...unlockState.map(getStageRank));
  }
  return getStageRank(unlockState);
}

function resetBelow(state) {
  const targetRank = getStageRank(state);
  Object.entries(groupConfig).forEach(([group, cfg]) => {
    const unlockRank = getUnlockRank(cfg.unlockState);
    if (unlockRank > targetRank) {
      groupedCheckboxes[group].forEach((cb) => {
        cb.checked = false;
      });
    }
  });
}

function resetGroupFromStep(group, step) {
  const list = groupedCheckboxes[group] || [];
  list.forEach((cb) => {
    if (Number(cb.dataset.step) >= step) cb.checked = false;
  });
}

function resetGroup(group) {
  const list = groupedCheckboxes[group] || [];
  list.forEach((cb) => {
    cb.checked = false;
  });
}

function resetGroup(group) {
  const list = groupedCheckboxes[group] || [];
  list.forEach((cb) => {
    cb.checked = false;
  });
}

function getGroupProgress(group) {
  const list = groupedCheckboxes[group] || [];
  if (group === "D1") {
    const step1 = list.find((cb) => Number(cb.dataset.step) === 1)?.checked;
    const step2 = list.find((cb) => Number(cb.dataset.step) === 2)?.checked;
    const biasChecked = list.some((cb) => Number(cb.dataset.step) === 3 && cb.checked);
    const valueChecked = list.some((cb) => Number(cb.dataset.step) === 4 && cb.checked);
    if (!step1) return 0;
    if (!step2) return 1;
    if (!biasChecked) return 2;
    return valueChecked ? 4 : 3;
  }
  if (group === "ORDER") {
    const step1 = list.some((cb) => Number(cb.dataset.step) === 1 && cb.checked);
    const step2 = list.some((cb) => Number(cb.dataset.step) === 2 && cb.checked);
    if (!step1) return 0;
    return step2 ? 2 : 1;
  }
  let progress = 0;
  for (const cb of list) {
    if (cb.checked) {
      progress += 1;
    } else {
      break;
    }
  }
  return progress;
}

function isGroupUnlocked(group) {
  const unlockState = groupConfig[group].unlockState;
  return getStageRank(currentState) >= getUnlockRank(unlockState);
}

function updateUI() {
  const progress = getStageRank(currentState) / Math.max(...Object.values(stageRank));
  progressFill.style.width = `${Math.round(progress * 100)}%`;

  const cards = {
    D1: document.getElementById("card-d1"),
    H4: document.getElementById("card-h4"),
    H1: document.getElementById("card-h1"),
    M15: document.getElementById("card-m15"),
    ORDER: document.getElementById("card-order"),
    M5: document.getElementById("card-m5"),
    CANCEL: document.getElementById("card-cancel")
  };

  cards.D1.classList.add("active");
  cards.H4.classList.toggle("active", getStageRank(currentState) >= getStageRank("D1_DISCOUNT_OK"));
  cards.H1.classList.toggle("active", getStageRank(currentState) >= getStageRank("H4_OB_OK"));
  cards.M15.classList.toggle("active", getStageRank(currentState) >= getStageRank("H1_CHOCH_OK"));
  cards.ORDER.classList.toggle("active", getStageRank(currentState) >= getStageRank("M15_OB_OK"));
  cards.M5.classList.toggle("active", getStageRank(currentState) >= getStageRank("ORDER_LIMIT_READY") || getStageRank(currentState) >= getStageRank("WAIT_MARKET_CONFIRMATION"));
  cards.CANCEL.classList.toggle("active", getStageRank(currentState) >= getStageRank("M15_OB_OK") && currentState !== "TRADE_EXECUTED");

  Object.keys(groupedCheckboxes).forEach((group) => {
    const progressCount = getGroupProgress(group);
    const unlocked = isGroupUnlocked(group);

    groupedCheckboxes[group].forEach((cb) => {
      const step = Number(cb.dataset.step);
      let canToggle = unlocked && step <= progressCount + 1;

      // Allow LIMIT execution directly when LIMIT is placed
      if (group === "M5" && step === 5 && currentOrderType === "LIMIT") {
        const limitPlaced = groupedCheckboxes.ORDER?.some(
          (item) => item.dataset.state === "LIMIT_PLACED" && item.checked
        );
        if (limitPlaced) {
          canToggle = true;
        }
      }
      cb.disabled = !canToggle && !cb.checked;

      // Disable/enable AI button and info icon based on checkbox state
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

      // Conditional visibility for D1 premium/discount based on bias
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

      // Conditional visibility for ORDER LIMIT_PLACED based on order type
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

      // Conditional visibility for M5 MARKET_EXECUTION (only if no LIMIT placed)
      if (group === "M5" && step === 4) {
        const label = cb.closest("label");
        const showIf = label?.dataset.showIf;
        if (showIf && currentOrderType !== "LIMIT") {
          const shouldShow = getStageRank(currentState) >= getStageRank("M5_MOMENTUM_OK");
          label.style.display = shouldShow ? "flex" : "none";
        } else if (currentOrderType === "LIMIT") {
          label.style.display = "none";
        }
      }
    });
  });

  updateBadges();
}

function handleCheck(e) {
  if (isHydrating) return;
  const cb = e.target;
  const group = cb.dataset.group;
  const step = Number(cb.dataset.step);
  const config = groupConfig[group];

  if (!config) return;

  if (trainingMode && cb.checked) {
    const stepId = cb.dataset.stepId;
    if (stepId && !seenSteps.has(stepId)) {
      cb.checked = false;
      showPanel(stepId);
      updateUI();
      return;
    }
  }

  const progressBefore = getGroupProgress(group);
  const effectiveProgressBefore = cb.checked ? Math.max(progressBefore - 1, 0) : progressBefore;
  const unlocked = isGroupUnlocked(group);

  if (cb.checked) {
    // Special allowance: LIMIT can execute directly after LIMIT_PLACED
    if (group === "M5" && step === 5 && currentOrderType === "LIMIT") {
      const limitPlaced = groupedCheckboxes.ORDER?.some(
        (item) => item.dataset.state === "LIMIT_PLACED" && item.checked
      );
      if (limitPlaced) {
        setState("TRADE_EXECUTED");
        updateUI();
        return;
      }
    }

    if (!unlocked || step !== effectiveProgressBefore + 1) {
      cb.checked = false;
      updateUI();
      return;
    }

    if (group === "D1") {
      if (step === 1) {
        setState("D1_STRUCTURE_OK");
      }
      if (step === 2) {
        setState("D1_BOS_OK");
      }
      if (step === 3) {
        const siblings = groupedCheckboxes[group].filter(
          (item) => Number(item.dataset.step) === 3 && item !== cb
        );
        siblings.forEach((item) => (item.checked = false));
        resetGroupFromStep("D1", 4);
        resetBelow("D1_BOS_OK");
        setState(cb.dataset.state);
      }
      if (step === 4) {
        setState(cb.dataset.state);
        resetBelow(cb.dataset.state);
      }
    } else if (group === "ORDER") {
      if (step === 1) {
        const siblings = groupedCheckboxes[group].filter(
          (item) => Number(item.dataset.step) === 1 && item !== cb
        );
        siblings.forEach((item) => (item.checked = false));
        resetGroupFromStep("ORDER", 2);
        resetGroup("M5");
        resetGroup("CANCEL");
        resetBelow("M15_OB_OK");
        setState(cb.dataset.state);
      }
      if (step === 2) {
        setState(cb.dataset.state);
      }
    } else if (group === "M5") {
      const statesM5 = ["M5_TAP_OK", "M5_REJECTION_OK", "M5_MOMENTUM_OK", "MARKET_EXECUTION", "TRADE_EXECUTED"];
      if (step <= 3) {
        setState(statesM5[step - 1]);
      }
      if (step === 4 && currentOrderType !== "LIMIT") {
        setState("MARKET_EXECUTION");
      }
      if (step === 5 && currentOrderType !== "LIMIT") {
        setState("TRADE_EXECUTED");
      }
    } else if (group === "CANCEL") {
      setState("CANCEL_TRADE");
    } else if (config.statesPerStep) {
      const nextState = config.statesPerStep[step - 1];
      setState(nextState);
    } else if (config.stateOnComplete) {
      const progressAfter = getGroupProgress(group);
      if (progressAfter === config.steps) {
        setState(config.stateOnComplete);
      }
    }
  } else {
    resetGroupFromStep(group, step);

    if (group === "H4") {
      const biasState = currentBias === "BULLISH" ? "D1_BIAS_BULLISH" : currentBias === "BEARISH" ? "D1_BIAS_BEARISH" : "D1_BOS_OK";
      const rollbackState = step === 1 ? biasState : config.rollbackTargets[step - 1];
      rollbackTo(rollbackState);
      return;
    }

    if (group === "D1") {
      const rollbackState = config.rollbackTargets[step - 1];
      rollbackTo(rollbackState);
      return;
    }

    if (group === "ORDER") {
      const rollbackState = config.rollbackTargets[step - 1];
      rollbackTo(rollbackState);
      return;
    }

    if (group === "CANCEL") {
      rollbackTo("M15_OB_OK");
      return;
    }

    if (config.rollbackTarget) {
      rollbackTo(config.rollbackTarget);
      return;
    }
  }

  updateUI();
  persistSessionState();
}

function resetAll() {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  SessionStore.resetSession(session.id);
  bindUIToSession(SessionStore.getActiveSession());
}

function updateBadges() {
  const biasText = currentBias || "UNKNOWN";
  const valueText = currentValueZone || "UNKNOWN";
  const stateText = currentState || "START";

  biasBadge.textContent = `BIAS: ${biasText}`;
  valueZoneBadge.textContent = `VALUE: ${valueText}`;
  currentStateBadge.textContent = `STATE: ${stateText}`;

  biasBadge.classList.toggle("badge-success", biasText === "BULLISH");
  biasBadge.classList.toggle("badge-warn", biasText === "BEARISH");
  biasBadge.classList.toggle("badge-neutral", biasText === "UNKNOWN");

  valueZoneBadge.classList.toggle("badge-success", valueText === "DISCOUNT");
  valueZoneBadge.classList.toggle("badge-warn", valueText === "PREMIUM");
  valueZoneBadge.classList.toggle("badge-neutral", valueText === "UNKNOWN");

  currentStateBadge.classList.toggle("badge-neutral", !stateText || stateText === "START");
}

function updateModeBadge(mode) {
  const modeText = mode || "SWING";
  modeBadge.textContent = `MODE: ${modeText}`;
  modeBadge.classList.toggle("badge-success", modeText === "SWING");
  modeBadge.classList.toggle("badge-warn", modeText === "INTRADAY");
}

/**
 * Met à jour les titres et descriptions des cartes selon le mode de trading
 */
function updateCardLabelsForMode(mode) {
  const currentMode = mode || "SWING";
  
  // Mapping des cartes à mettre à jour
  const cardConfig = {
    "card-d1": { level: "CONTEXT", step: "D1" },
    "card-h4": { level: "ZONE", step: "H4" },
    "card-h1": { level: "REACTION", step: "H1" },
    "card-m15": { level: "SETUP", step: "M15" },
    "card-m5": { level: "EXECUTION", step: "M5" }
  };
  
  Object.entries(cardConfig).forEach(([cardId, config]) => {
    const card = document.getElementById(cardId);
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
  const card = document.getElementById(cardId);
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

allCheckboxes.forEach((cb) => cb.addEventListener("change", handleCheck));
resetSessionBtn.addEventListener("click", resetAll);
exportSessionBtn.addEventListener("click", () => {
  const session = SessionStore.getActiveSession();
  if (session) SessionStore.exportSession(session.id);
});
trainingModeToggle.addEventListener("change", () => {
  trainingMode = trainingModeToggle.checked;
  appState.preferences.trainingMode = trainingMode;
  SessionStore.save();
  updateUI();
});

// =====================
// AI PROMPT CONTEXT (pour buildAIPrompt)
// =====================

// Collecte le contexte cumulatif
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

// Ouvre le modal de prompt IA
function openAIPromptModal(stateName) {
  const step = stepLibrary[stateName];
  if (!step) return;
  
  const ctx = getAIContext();
  const prompt = buildAIPrompt(ctx, stateName);
  
  const modal = document.getElementById("aiPromptModal");
  const promptText = document.getElementById("aiPromptText");
  const closeAIModal = document.getElementById("closeAIModal");
  const copyPromptBtn = document.getElementById("copyPromptBtn");
  const copyAndCloseBtn = document.getElementById("copyAndCloseBtn");
  const aiModalOverlay = document.getElementById("aiModalOverlay");
  
  // Affiche le prompt
  promptText.textContent = prompt;
  
  modal.classList.add("visible");
  aiModalOverlay.classList.add("visible");
  
  // Bouton copier
  copyPromptBtn.onclick = () => copyToClipboard(prompt);
  
  // Bouton copier & fermer
  copyAndCloseBtn.onclick = () => {
    copyToClipboard(prompt);
    modal.classList.remove("visible");
    aiModalOverlay.classList.remove("visible");
  };
  
  // Fermer
  closeAIModal.onclick = () => {
    modal.classList.remove("visible");
    aiModalOverlay.classList.remove("visible");
  };
  
  aiModalOverlay.onclick = () => {
    modal.classList.remove("visible");
    aiModalOverlay.classList.remove("visible");
  };
}

// Copie le texte au presse-papiers
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Prompt copié au presse-papiers!");
    }).catch(() => fallbackCopyToClipboard(text));
  } else {
    fallbackCopyToClipboard(text);
  }
}

// Fallback si clipboard API indisponible
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

// =====================
// TOOLTIP & EXPLANATION PANEL
// =====================

const tooltip = document.getElementById("tooltip");
const explanationPanel = document.getElementById("explanationPanel");
const panelOverlay = document.getElementById("panelOverlay");
const closePanel = document.getElementById("closePanel");
const panelTitle = document.getElementById("panelTitle");
const panelSearch = document.getElementById("panelSearch");
const panelSmc = document.getElementById("panelSmc");
const panelWhy = document.getElementById("panelWhy");
const panelAction = document.getElementById("panelAction");

const allInfoIcons = document.querySelectorAll(".info-icon");
const allAIButtons = document.querySelectorAll(".ai-button");

function showTooltip(stepId, x, y) {
  const stepName = mapStepIdToState(stepId);
  const step = stepLibrary[stepName];
  if (!step) return;
  
  tooltip.textContent = step.title;
  tooltip.classList.add("visible");
  
  const tooltipRect = tooltip.getBoundingClientRect();
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
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.classList.remove("visible");
}

// Map stepId (data-step-id) → stateName (clé stepLibrary)
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
  
  panelTitle.textContent = step.title;
  panelSearch.textContent = step.description.search;
  panelSmc.textContent = step.description.smc;
  panelWhy.textContent = step.description.why;
  panelAction.textContent = step.description.action;
  
  panelOverlay.classList.add("visible");
  explanationPanel.classList.add("visible");
}

function hidePanel() {
  panelOverlay.classList.remove("visible");
  explanationPanel.classList.remove("visible");
}

// Event listeners pour info icons (ℹ️)
allInfoIcons.forEach((icon) => {
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

// Event listeners pour AI buttons (?)
allAIButtons.forEach((btn) => {
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

closePanel.addEventListener("click", hidePanel);
panelOverlay.addEventListener("click", hidePanel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hidePanel();
    document.getElementById("aiPromptModal")?.classList.remove("visible");
    document.getElementById("aiModalOverlay")?.classList.remove("visible");
  }
});

SessionStore.load();
trainingMode = Boolean(appState.preferences?.trainingMode);
trainingModeToggle.checked = trainingMode;

dashboardSearch.addEventListener("input", renderDashboard);
biasFilter.addEventListener("change", renderDashboard);
newSessionBtn.addEventListener("click", () => {
  showModeSelectionModal();
});

// Gestionnaire pour fermer la modal avec le bouton X
document.addEventListener("DOMContentLoaded", () => {
  const closeModeModalBtn = document.getElementById("closeModeModal");
  if (closeModeModalBtn) {
    closeModeModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("modeSelectionModal");
      const overlay = document.getElementById("modeModalOverlay");
      if (modal) modal.classList.remove("visible");
      if (overlay) overlay.classList.remove("visible");
    });
  }
});

/**
 * Affiche une modal pour sélectionner le mode de trading et créer une session
 */
function showModeSelectionModal() {
  const modal = document.getElementById("modeSelectionModal");
  if (!modal) {
    console.warn("Modal modeSelectionModal non trouvée");
    // Fallback: utiliser prompt simple
    const symbol = prompt("Symbol (ex: EURUSD)");
    if (!symbol) return;
    const session = SessionStore.createSession(symbol, "SWING");
    if (session) {
      navigateToSession(session.id);
    }
    return;
  }
  
  const overlay = document.getElementById("modeModalOverlay");
  const symbolInput = modal.querySelector("#modeSymbolInput");
  const swingRadio = modal.querySelector("input[value='SWING']");
  const intradayRadio = modal.querySelector("input[value='INTRADAY']");
  const confirmBtn = modal.querySelector("#confirmModeBtn");
  const cancelBtn = modal.querySelector("#cancelModeBtn");
  
  // Reset
  if (symbolInput) symbolInput.value = "";
  if (swingRadio) swingRadio.checked = true;
  
  modal.classList.add("visible");
  if (overlay) overlay.classList.add("visible");
  
  // Focus sur l'input
  if (symbolInput) {
    symbolInput.focus();
    symbolInput.select();
  }
  
  // Gestionnaire confirm
  const handleConfirm = () => {
    const symbol = (symbolInput?.value || "").trim();
    if (!symbol) {
      alert("Veuillez entrer un symbol (ex: EURUSD)");
      return;
    }
    const mode = swingRadio?.checked ? "SWING" : "INTRADAY";
    
    // Fermer la modal
    modal.classList.remove("visible");
    if (overlay) overlay.classList.remove("visible");
    
    // Créer la session
    const session = SessionStore.createSession(symbol, mode);
    if (session) {
      navigateToSession(session.id);
    }
  };
  
  // Gestionnaire cancel
  const handleCancel = () => {
    modal.classList.remove("visible");
    if (overlay) overlay.classList.remove("visible");
  };
  
  if (confirmBtn) {
    confirmBtn.onclick = handleConfirm;
  }
  if (cancelBtn) {
    cancelBtn.onclick = handleCancel;
  }
  if (overlay) {
    overlay.onclick = handleCancel;
  }
  
  // Permettre Entrée pour confirmer, Échap pour annuler
  if (symbolInput) {
    symbolInput.onkeyup = (e) => {
      if (e.key === "Enter") handleConfirm();
      if (e.key === "Escape") handleCancel();
    };
  }
}

backToDashboard.addEventListener("click", navigateToDashboard);

notesInput.addEventListener("input", () => {
  persistSessionState();
});

sendMessageBtn.addEventListener("click", () => {
  const session = SessionStore.getActiveSession();
  if (!session) return;
  SessionStore.addMessage(session.id, messageInput.value);
  messageInput.value = "";
  renderMessages();
  renderDashboard();
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target)?.classList.add("active");
  });
});

window.addEventListener("hashchange", handleRoute);
handleRoute();
