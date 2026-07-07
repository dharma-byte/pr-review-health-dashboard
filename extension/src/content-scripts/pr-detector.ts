import { hasBadge, renderBadge } from "./badge-injector";
import { sendMessage, type ScoreResponse } from "../shared/messaging";

interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

function getPRInfoFromUrl(): PRInfo | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

let lastSeenPR: string | null = null;
let lastResponse: ScoreResponse | undefined;

async function checkForPRChange() {
  const info = getPRInfoFromUrl();

  if (!info) {
    lastSeenPR = null;
    lastResponse = undefined;
    return;
  }

  const key = `${info.owner}/${info.repo}#${info.number}`;

  if (key === lastSeenPR) {
    // GitHub's PR pages re-render parts of the DOM without a navigation (e.g. switching
    // tabs), which can wipe out our injected badge even though the viewed PR hasn't changed.
    if (!hasBadge()) renderBadge(lastResponse);
    return;
  }

  lastSeenPR = key;
  lastResponse = undefined;
  renderBadge(undefined);

  const response = await sendMessage({ type: "PR_VIEWED", ...info });
  lastResponse = response;
  renderBadge(response);
}

const observer = new MutationObserver(() => {
  void checkForPRChange();
});
observer.observe(document.body, { childList: true, subtree: true });
void checkForPRChange();
