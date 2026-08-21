// Fam AI safety + scope guardrails. Classifies a user request before any
// action or LLM call happens. Green = assist normally. Yellow = limited
// general assistance (never professional conclusions). Red = refuse expert
// claims, but still offer operational household help. OUT_OF_SCOPE = refuse
// arbitrary general knowledge (Fam AI is not "Grok inside FamOS").

const RED_PATTERNS = [
  // Medical
  /\b(diagnos|medication dosage|dose of|prescribe|prescription for|is my child (?:sick|ill|autistic|adhd)|symptoms of|should i take)\b/i,
  /\b(cancer|tumor|seizure|overdose|poisoning)\b/i,
  // Legal / custody
  /\b(legal advice|child custody|divorce advice|sue|lawsuit|is it legal)\b/i,
  // Mental health diagnosis
  /\b(diagnos.*(?:depression|anxiety|adhd|autism|bipolar)|(?:depressed|anxious)\s+diagnos)\b/i,
  // Financial transactions / purchases
  /\b(pay for|buy (?:this|that)|purchase|send money|transfer money|invest in|credit card number|order (?:a|an|the))\b/i,
  // Secret monitoring / circumventing privacy
  /\b(secretly (?:track|watch|monitor)|spy on|without (?:them|her|him|their) knowing|hide (?:my|this) (?:location|activity|messages?))\b/i,
  // Dangerous activities
  /\b(how (?:to )?(?:make|build|create) (?:a bomb|an explosive|weapons?)|poison|torture|self.?harm|suicide)\b/i,
  // Emergency
  /\b(emergency|911|call an ambulance|is it an emergency)\b/i,
];

const YELLOW_PATTERNS = [
  /\b(nutrition|diet|calories|protein intake|healthy eating)\b/i,
  /\b(exercise|workout|training plan|fitness)\b/i,
  /\b(school advice|homework help|study tips)\b/i,
  /\b(parenting (?:advice|tip)|discipline|behaviour|behavior)\b/i,
  /\b(travel safety|car seat|airplane (?:travel|safety))\b/i,
  /\b(financial organization|budget advice|savings tips)\b/i,
  /\b(relationship|argu(?:e|ment)|disagreement|fight)\b/i,
];

const GENERAL_KNOWLEDGE_PATTERNS = [
  /\b(who (?:won|is|was) (?:the|a))\b/i,
  /\b(what (?:is|was) (?:the|a))\b/i,
  /\b(when (?:was|did))\b/i,
  /\b(how (?:tall|big|far|long) (?:is|was))\b/i,
  /\b(history|geography|science|math|football|nfl|nba|super bowl|election|president|movie|actor|celebrity)\b/i,
];

// Requested action risk levels (PRD §11).
export const RISK = {
  READ: 0,          // No confirmation
  REVERSIBLE: 1,    // Execute immediately with Undo
  MODERATE: 2,      // Confirm when ambiguity exists
  HIGH: 3,          // Always require explicit confirmation
};

export const RISK_LABEL = {
  0: "Read only",
  1: "Reversible",
  2: "Needs review",
  3: "High impact",
};

export function classifyRequest(text) {
  if (RED_PATTERNS.some((pattern) => pattern.test(text))) return { level: "red", pattern: RED_PATTERNS.find((pattern) => pattern.test(text)) };
  if (YELLOW_PATTERNS.some((pattern) => pattern.test(text))) return { level: "yellow", pattern: YELLOW_PATTERNS.find((pattern) => pattern.test(text)) };
  return { level: "green" };
}

export function isGeneralKnowledge(text) {
  // Ignore household-shaped questions: "what's on today", "who's driving",
  // "what time is soccer", "what do we need for" etc.
  if (/\b(what('| i)?s on|who('| i)?s driving|who needs|what time|what do we need|what are we|what's everyone|what is everyone|what should i|whats)\b/i.test(text)) return false;
  if (/household|family|calendar|event|task|grocery|meal|list|schedule|today|tomorrow|weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday/i.test(text)) return false;
  return GENERAL_KNOWLEDGE_PATTERNS.some((pattern) => pattern.test(text));
}

// Teen guardrails (PRD §26): teenagers can do most household operations but
// cannot change privacy, invite/remove members, or touch permissions.
export function memberPermissions(member) {
  if (!member) return { isTeen: false, isOwner: false, canManageHousehold: false };
  const role = (member.role || "").toLowerCase();
  const isOwner = role.includes("owner");
  return {
    isTeen: !isOwner && /teen|child|kid/i.test(member.name) === false && false, // age isn't stored; treat all non-owners as standard
    isOwner,
    canManageHousehold: isOwner,
  };
}

export const RED_RESPONSE = "I can’t act as a medical, legal, or financial expert, and I won’t help with anything that could put your family at risk or bypass someone’s privacy. I can still help with the operational side — for example, I can cancel or reschedule the activity, find the event details, or adjust transportation.";
export const YELLOW_RESPONSE = "I can give light, general guidance here, but please treat it as a starting point — not professional advice. Want me to do something operational instead, like scheduling, packing, or assigning a driver?";
export const OUT_OF_SCOPE_RESPONSE = "Fam AI is designed to help manage your household and family activities. I can help with schedules, lists, groceries, tasks, and planning — but general knowledge questions are outside what I do.";
