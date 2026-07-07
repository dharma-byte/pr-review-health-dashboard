import type { ScoreResponse } from "../shared/messaging";
import type { ScoreLevel } from "../shared/types";

const BADGE_ID = "pr-review-health-badge";

const LEVEL_STYLES: Record<ScoreLevel, { bg: string; fg: string; label: string }> = {
  low: { bg: "#dafbe1", fg: "#1a7f37", label: "Low risk" },
  medium: { bg: "#fff8c5", fg: "#9a6700", label: "Medium risk" },
  high: { bg: "#ffebe9", fg: "#cf222e", label: "High risk" },
};

const NEUTRAL_STYLE = { bg: "#f6f8fa", fg: "#656d76" };

function findTitleAnchor(): Element | null {
  return document.querySelector(".gh-header-title") ?? document.querySelector("h1");
}

export function hasBadge(): boolean {
  return document.getElementById(BADGE_ID) !== null;
}

export function renderBadge(response: ScoreResponse | undefined): void {
  document.getElementById(BADGE_ID)?.remove();

  const anchor = findTitleAnchor();
  if (!anchor) return;

  const badge = document.createElement("span");
  badge.id = BADGE_ID;
  Object.assign(badge.style, {
    display: "inline-block",
    marginLeft: "8px",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    verticalAlign: "middle",
  });

  if (!response) {
    badge.textContent = "Scoring…";
    badge.style.background = NEUTRAL_STYLE.bg;
    badge.style.color = NEUTRAL_STYLE.fg;
  } else if (response.ok) {
    const style = LEVEL_STYLES[response.result.level];
    badge.textContent = `Risk: ${style.label}`;
    badge.style.background = style.bg;
    badge.style.color = style.fg;
    badge.title = response.result.reasons.join("\n");
  } else {
    badge.textContent = "Risk: unavailable";
    badge.style.background = NEUTRAL_STYLE.bg;
    badge.style.color = NEUTRAL_STYLE.fg;
    badge.title = response.error;
  }

  anchor.appendChild(badge);
}
