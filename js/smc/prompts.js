import { stepLibrary } from './definitions.js';
import { getTFForLevel } from './config.js';

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
 * @param {Object} ctx - contexte {checkedSteps, bias, valueZone, symbol, notes, mode}
 * @param {string} stateName - nom de l'état à valider (clé stepLibrary)
 * @returns {string}
 */
export function buildAIPrompt(ctx, stateName) {
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
