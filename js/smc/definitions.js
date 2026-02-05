// =====================================================
// SMC Decision Engine — Step Library (V4.2 + AI)
// Bibliothèque centralisée: source de vérité unique
// =====================================================

export const stepLibrary = {
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
// STATE FLOW
// =====================================================

export const stateFlow = [
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

// =====================================================
// CHOICE GROUPS
// =====================================================

export const choiceGroups = [
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
        requiresBias: "BULLISH"
      },
      { 
        state: "D1_PREMIUM_OK", 
        label: "Premium", 
        icon: "🔼",
        hint: "Prix au-dessus de l'équilibre, favorable aux ventes",
        requiresBias: "BEARISH"
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
// STEP DESCRIPTIONS (for panel)
// =====================================================

export const stepDescriptions = {
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

// =====================================================
// STAGE RANK (progression tracking)
// =====================================================

export const stageRank = {
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

// =====================================================
// GROUP CONFIG (unlock conditions, rollback targets)
// =====================================================

export const groupConfig = {
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

