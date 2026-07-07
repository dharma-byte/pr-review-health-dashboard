const GITHUB_TOKEN_KEY = "githubToken";
const GITHUB_USERNAME_KEY = "githubUsername";

export interface StoredCredentials {
  githubToken: string;
  githubUsername: string;
}

export async function getStoredCredentials(): Promise<Partial<StoredCredentials>> {
  const result = await chrome.storage.local.get([GITHUB_TOKEN_KEY, GITHUB_USERNAME_KEY]);
  return {
    githubToken: result[GITHUB_TOKEN_KEY] as string | undefined,
    githubUsername: result[GITHUB_USERNAME_KEY] as string | undefined,
  };
}

export async function setStoredCredentials(credentials: StoredCredentials): Promise<void> {
  await chrome.storage.local.set({
    [GITHUB_TOKEN_KEY]: credentials.githubToken,
    [GITHUB_USERNAME_KEY]: credentials.githubUsername,
  });
}
