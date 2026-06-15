import type { AutonomyLevel } from "../context/ScheduleContext";

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  type: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  suggestion?: string;
  confidence: number;
}

export interface ActionProposal {
  action: string;
  params: Record<string, unknown>;
  reason: string;
  impact: string;
  confidence: number;
}

export interface ExecutiveSummary {
  status: "healthy" | "attention" | "critical";
  headline: string;
  keyMetrics: Record<string, unknown>;
}

export interface AetherisResponse {
  version: number;
  generatedAt: string;
  summary: ExecutiveSummary;
  insights: Insight[];
  suggestedActions: ActionProposal[];
  explainability: ExplainabilityReport;
  autonomyLevel: AutonomyLevel;
}

export interface ExplainabilityReport {
  reasoning: string[];
  affectedGoals: string[];
  affectedBlocks: string[];
  affectedMetrics: string[];
  expectedImpact: string;
  confidence: number;
}

export interface Suggestion {
  id: string;
  type: string;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
  actionable: boolean;
}

export interface RecoveryAnalysis {
  recoveryScore: number;
  sustainableScore: number;
  overloadDetected: boolean;
  burnoutDetected: boolean;
  recommendations: string[];
}
