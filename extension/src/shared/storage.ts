const GITHUB_TOKEN_KEY = "githubToken";
const GITHUB_USERNAME_KEY = "githubUsername";
const BACKEND_URL_KEY = "backendUrl";

export const DEFAULT_BACKEND_URL = "http://localhost:8000";

export interface StoredCredentials {
  githubToken: string;
  githubUsername: string;
  backendUrl: string;
}

export async function getStoredCredentials(): Promise<Partial<StoredCredentials>> {
  const result = await chrome.storage.local.get([GITHUB_TOKEN_KEY, GITHUB_USERNAME_KEY, BACKEND_URL_KEY]);
  return {
    githubToken: result[GITHUB_TOKEN_KEY] as string | undefined,
    githubUsername: result[GITHUB_USERNAME_KEY] as string | undefined,
    backendUrl: (result[BACKEND_URL_KEY] as string | undefined) ?? DEFAULT_BACKEND_URL,
  };
}

export async function setStoredCredentials(credentials: StoredCredentials): Promise<void> {
  await chrome.storage.local.set({
    [GITHUB_TOKEN_KEY]: credentials.githubToken,
    [GITHUB_USERNAME_KEY]: credentials.githubUsername,
    [BACKEND_URL_KEY]: credentials.backendUrl,
  });
}
