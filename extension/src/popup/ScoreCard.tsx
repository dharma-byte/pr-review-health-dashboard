import type { ScoreResponse } from "../shared/messaging";
import type { ScoreLevel } from "../shared/types";

const LEVEL_LABEL: Record<ScoreLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

interface ScoreCardProps {
  response: ScoreResponse;
  onRescore: () => void;
  rescoring: boolean;
}

export default function ScoreCard({ response, onRescore, rescoring }: ScoreCardProps) {
  return (
    <div className={`score-card score-card--${response.ok ? response.result.level : "error"}`}>
      {response.ok ? (
        <>
          <div className="score-summary">
            <span className={`score-pill score-pill--${response.result.level}`}>
              {LEVEL_LABEL[response.result.level]}
            </span>
            <span className="score-points">{response.result.points} pts</span>
          </div>
          <ul className="score-reasons">
            {response.result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="score-error">
          <p>{response.error}</p>
          <button type="button" className="score-link-button" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Settings
          </button>
        </div>
      )}

      <div className="score-footer">
        <button type="button" className="score-rescore" onClick={onRescore} disabled={rescoring}>
          {rescoring ? "Re-scoring…" : "Re-score"}
        </button>
      </div>
    </div>
  );
}
