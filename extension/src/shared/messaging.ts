import type { ScoreResult } from "./types";

export interface PrViewedMessage {
  type: "PR_VIEWED";
  owner: string;
  repo: string;
  number: number;
}

export type ExtensionMessage = PrViewedMessage;

export type ScoreResponse = { ok: true; result: ScoreResult } | { ok: false; error: string };

export function sendMessage(message: ExtensionMessage): Promise<ScoreResponse | undefined> {
  return chrome.runtime.sendMessage(message);
}
