export type DigestMode = "auto" | "manual";
export type DigestTimeframe = "daily" | "weekly" | "monthly" | "custom";
export type ReportCardKind =
  | "recovery"
  | "productivity"
  | "schedule-quality"
  | "goal-alignment"
  | "consistency"
  | "programs"
  | "burnout"
  | "opportunity";
export type ReportCardSeverity = "insight" | "warning" | "opportunity" | "trend" | "recommendation";
export type DigestColor = "blue" | "purple" | "amber" | "teal";

export interface ReportCard {
  kind: ReportCardKind;
  severity: ReportCardSeverity;
  title: string;
  body: string;
  detail?: string;
  actionable?: boolean;
}

export interface Digest {
  id: string;
  mode: DigestMode;
  timeframe: DigestTimeframe;
  date: string;
  generatedAt: string;
  color: DigestColor;
  generatedBy: "ai" | "heuristic";
  summary: string;
  cards: ReportCard[];
  recommendations: string[];
  opportunities: { label: string; action?: string }[];
}

export interface DigestStoreData {
  digests: Digest[];
  settings: {
    mode: DigestMode;
    lastGeneratedDate: string | null;
  };
}
