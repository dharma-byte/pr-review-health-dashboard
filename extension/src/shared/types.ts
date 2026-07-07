export interface PRFacts {
  owner: string;
  repo: string;
  prNumber: number;
  linesChanged: number;
  filesChanged: number;
  daysOpen: number;
  touchedTestFiles: boolean;
}

export type ScoreLevel = "low" | "medium" | "high";

export interface ScoreResult {
  level: ScoreLevel;
  points: number;
  reasons: string[];
}
