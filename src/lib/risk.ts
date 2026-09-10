import type { Condition } from "@/lib/detect.functions";

export type Block = {
  id: string;
  name: string;
  tempC: number;
  humidity: number;
  soil: string;
  baseRisk: number;
};

export const BLOCKS: Block[] = [
  { id: "A2", name: "Block A2 — Rampur", tempC: 31, humidity: 78, soil: "Loamy, moist", baseRisk: 62 },
  { id: "B1", name: "Block B1 — Sonepur", tempC: 29, humidity: 55, soil: "Sandy, dry", baseRisk: 28 },
  { id: "C3", name: "Block C3 — Devgarh", tempC: 33, humidity: 66, soil: "Clay, damp", baseRisk: 45 },
  { id: "D4", name: "Block D4 — Kishanpura", tempC: 30, humidity: 84, soil: "Loamy, waterlogged", baseRisk: 71 },
];

export const EXTRA_BLOCKS = [
  25, 55, 38, 20, 72, 15, 44, 60, 28, 33, 50, 22, 68, 40, 35, 58,
].map((risk, i) => ({ id: `Blk ${i + 5}`, risk }));

export const CONDITION_SCORE: Record<Condition, number> = {
  healthy: 8,
  mild: 35,
  moderate: 62,
  severe_rotten: 90,
};

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export const RISK_LABELS: Record<RiskLevel, { en: string; hi: string; className: string }> = {
  low: { en: "Low risk", hi: "कम जोखिम", className: "bg-healthy" },
  moderate: { en: "Moderate risk", hi: "मध्यम जोखिम", className: "bg-mild" },
  high: { en: "High risk", hi: "अधिक जोखिम", className: "bg-moderate" },
  critical: { en: "Critical risk", hi: "गंभीर जोखिम", className: "bg-severe" },
};

export function riskLevel(score: number): RiskLevel {
  if (score < 30) return "low";
  if (score < 50) return "moderate";
  if (score < 70) return "high";
  return "critical";
}

export type FusionSignal = { key: string; label: string; weight: number; value: number };

export type Fusion = {
  score: number;
  level: RiskLevel;
  signals: FusionSignal[];
};

/** Fuses the photo diagnosis with trap counts, weather and local outbreak history. */
export function fuseRisk(input: {
  condition: Condition;
  confidence: number;
  block: Block;
  trapCount: number | null;
}): Fusion {
  const image = CONDITION_SCORE[input.condition] * (0.6 + 0.4 * input.confidence);
  const weather = Math.min(
    100,
    Math.max(0, (input.block.humidity - 40) * 1.6 + (input.block.tempC - 24) * 3),
  );
  const trap = input.trapCount === null ? null : Math.min(100, input.trapCount * 4);
  const history = input.block.baseRisk;

  const raw: Array<[string, string, number, number | null]> = [
    ["image", "Symptom photo", 0.45, image],
    ["weather", "Weather & soil", 0.22, weather],
    ["trap", "Pest-trap count", 0.18, trap],
    ["history", "Outbreak history", 0.15, history],
  ];

  const active = raw.filter(([, , , v]) => v !== null) as Array<[string, string, number, number]>;
  const totalWeight = active.reduce((s, [, , w]) => s + w, 0);
  const signals: FusionSignal[] = active.map(([key, label, w, v]) => ({
    key,
    label,
    weight: Math.round((w / totalWeight) * 100),
    value: Math.round(v),
  }));
  const score = Math.round(signals.reduce((s, sig) => s + (sig.weight / 100) * sig.value, 0));

  return { score, level: riskLevel(score), signals };
}

export type Submission = {
  id: string;
  at: number;
  blockId: string;
  crop: string;
  disease: string;
  condition: Condition;
  score: number;
  status: "pending" | "confirmed" | "corrected";
};

const KEY = "khetrakshak.submissions";

export function loadSubmissions(): Submission[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Submission[];
  } catch {
    return [];
  }
}

export function saveSubmissions(list: Submission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  window.dispatchEvent(new Event("khetrakshak-submissions"));
}

export function addSubmission(s: Submission) {
  saveSubmissions([s, ...loadSubmissions()]);
}

export function seedTrend(): number[] {
  return [32, 35, 31, 38, 42, 40, 46, 44, 51, 49, 55, 53, 58, 56];
}
