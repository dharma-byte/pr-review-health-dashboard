import { useCallback, useEffect, useState } from "react";
import { sendMessage, type ScoreResponse } from "../shared/messaging";
import ScoreCard from "./ScoreCard";
import "./popup.css";

interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

type ViewState = { kind: "not-a-pr" } | { kind: "loading" } | { kind: "ready"; response: ScoreResponse };

function parsePRInfoFromUrl(url: string | undefined): PRInfo | null {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: Number(match[3]) };
  } catch {
    return null;
  }
}

export default function Popup() {
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [rescoring, setRescoring] = useState(false);

  const score = useCallback(async (info: PRInfo) => {
    const response = await sendMessage({ type: "PR_VIEWED", ...info });
    setState({
      kind: "ready",
      response: response ?? { ok: false, error: "No response from the background worker." },
    });
  }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const info = parsePRInfoFromUrl(tab?.url);
      setPrInfo(info);
      if (info) {
        void score(info);
      } else {
        setState({ kind: "not-a-pr" });
      }
    });
  }, [score]);

  async function handleRescore() {
    if (!prInfo) return;
    setRescoring(true);
    await score(prInfo);
    setRescoring(false);
  }

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>PR Review Health Dashboard</h1>
        {prInfo && (
          <p className="popup-subtitle">
            {prInfo.owner}/{prInfo.repo} #{prInfo.number}
          </p>
        )}
      </header>

      {state.kind === "not-a-pr" && <p className="popup-empty">Open a GitHub pull request to see its risk score.</p>}
      {state.kind === "loading" && <p className="popup-loading">Scoring…</p>}
      {state.kind === "ready" && <ScoreCard response={state.response} onRescore={handleRescore} rescoring={rescoring} />}
    </div>
  );
}
