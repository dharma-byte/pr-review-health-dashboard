import type { ExtensionMessage, ScoreResponse } from "../shared/messaging";
import { getStoredCredentials } from "../shared/storage";
import type { PRFacts, ScoreResult } from "../shared/types";

const TEST_FILE_PATTERN = /(^|\/)(tests?|specs?|__tests__)(\/|_|\.|$)|\.(test|spec)\.[^/.]+$/i;

interface GitHubPullRequest {
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
}

interface GitHubPullRequestFile {
  filename: string;
}

interface BackendScoreResponse {
  level: ScoreResult["level"];
  points: number;
  reasons: string[];
}

async function fetchGithubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("GitHub rejected the stored token. Reconnect it in the extension options.");
    }
    throw new Error(`GitHub API error ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

async function fetchPRFacts(owner: string, repo: string, number: number, token: string): Promise<PRFacts> {
  const [pr, files] = await Promise.all([
    fetchGithubJson<GitHubPullRequest>(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, token),
    fetchGithubJson<GitHubPullRequestFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`,
      token,
    ),
  ]);

  const daysOpen = Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24));

  return {
    owner,
    repo,
    prNumber: number,
    linesChanged: pr.additions + pr.deletions,
    filesChanged: pr.changed_files,
    daysOpen,
    touchedTestFiles: files.some((file) => TEST_FILE_PATTERN.test(file.filename)),
  };
}

async function scoreWithBackend(facts: PRFacts, githubUsername: string, backendUrl: string): Promise<ScoreResult> {
  const response = await fetch(`${backendUrl}/api/prs/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      github_username: githubUsername,
      owner: facts.owner,
      repo: facts.repo,
      pr_number: facts.prNumber,
      lines_changed: facts.linesChanged,
      files_changed: facts.filesChanged,
      days_open: facts.daysOpen,
      touched_test_files: facts.touchedTestFiles,
    }),
  });

  if (response.status === 404) {
    throw new Error("Backend doesn't recognize this GitHub user. Reconnect via the extension options.");
  }
  if (!response.ok) {
    throw new Error(`Backend scoring failed (HTTP ${response.status})`);
  }

  const body = (await response.json()) as BackendScoreResponse;
  return { level: body.level, points: body.points, reasons: body.reasons };
}

async function handlePrViewed(owner: string, repo: string, number: number): Promise<ScoreResponse> {
  const { githubToken, githubUsername, backendUrl } = await getStoredCredentials();

  if (!githubToken || !githubUsername || !backendUrl) {
    return { ok: false, error: "Not connected. Open the extension options and add your GitHub token." };
  }

  try {
    const facts = await fetchPRFacts(owner, repo, number, githubToken);
    const result = await scoreWithBackend(facts, githubUsername, backendUrl);
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while scoring this PR.";
    return { ok: false, error: message };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "PR_VIEWED") {
    handlePrViewed(message.owner, message.repo, message.number).then(sendResponse);
    return true;
  }
  return false;
});
