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
    <div className="score-card">
      {response.ok ? (
        <>
          <span className={`score-pill score-pill--${response.result.level}`}>
            {LEVEL_LABEL[response.result.level]}
          </span>
          <ul className="score-reasons">
            {response.result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="score-error">{response.error}</p>
      )}

      <button type="button" className="score-rescore" onClick={onRescore} disabled={rescoring}>
        {rescoring ? "Re-scoring…" : "Re-score"}
      </button>
    </div>
  );
}
