import { sendMessage } from "../shared/messaging";

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

async function checkForPRChange() {
  const info = getPRInfoFromUrl();

  if (!info) {
    lastSeenPR = null;
    return;
  }

  const key = `${info.owner}/${info.repo}#${info.number}`;
  if (key === lastSeenPR) return;
  lastSeenPR = key;

  const response = await sendMessage({ type: "PR_VIEWED", ...info });

  if (response?.ok) {
    console.log("[PR Review Health Dashboard] score:", response.result);
  } else {
    console.warn("[PR Review Health Dashboard] no score available:", response);
  }
}

const observer = new MutationObserver(() => {
  void checkForPRChange();
});
observer.observe(document.body, { childList: true, subtree: true });
void checkForPRChange();
