import { useEffect, useState } from "react";
import { ApiError, registerGithubToken } from "../shared/api";
import { DEFAULT_BACKEND_URL, getStoredCredentials, setStoredCredentials } from "../shared/storage";
import "./options.css";

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "success" } | { kind: "error"; message: string };

export default function OptionsPage() {
  const [githubUsername, setGithubUsername] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  useEffect(() => {
    getStoredCredentials().then((stored) => {
      if (stored.githubUsername) setGithubUsername(stored.githubUsername);
      if (stored.githubToken) setGithubToken(stored.githubToken);
      if (stored.backendUrl) setBackendUrl(stored.backendUrl);
    });
  }, []);

  const canSave = githubUsername.trim().length > 0 && githubToken.trim().length > 0 && backendUrl.trim().length > 0;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ kind: "saving" });

    try {
      await registerGithubToken(backendUrl.trim(), githubUsername.trim(), githubToken.trim());
      await setStoredCredentials({
        githubUsername: githubUsername.trim(),
        githubToken: githubToken.trim(),
        backendUrl: backendUrl.trim(),
      });
      setStatus({ kind: "success" });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not reach the backend. Check the backend URL and that the server is running.";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="options-page">
      <h1>PR Review Health Dashboard</h1>
      <p className="options-subtitle">
        Connect your GitHub account and backend so the extension can score pull requests.
      </p>

      <form onSubmit={handleSave} className="options-form">
        <label className="options-field">
          <span>GitHub username</span>
          <input
            type="text"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            placeholder="octocat"
            autoComplete="off"
          />
        </label>

        <label className="options-field">
          <span>GitHub personal access token</span>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            autoComplete="off"
          />
          <small>
            Needs read-only <code>repo</code> scope. Generate one under GitHub Settings → Developer settings →
            Personal access tokens. Stored locally in Chrome and encrypted at rest on your backend — never sent
            anywhere else.
          </small>
        </label>

        <label className="options-field">
          <span>Backend URL</span>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder={DEFAULT_BACKEND_URL}
            autoComplete="off"
          />
        </label>

        <button type="submit" disabled={!canSave || status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>

        {status.kind === "success" && <p className="options-status options-status--success">Connected.</p>}
        {status.kind === "error" && <p className="options-status options-status--error">{status.message}</p>}
      </form>
    </div>
  );
}
