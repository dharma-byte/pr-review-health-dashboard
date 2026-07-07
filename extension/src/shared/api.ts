export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function registerGithubToken(
  backendUrl: string,
  githubUsername: string,
  githubToken: string,
): Promise<void> {
  const response = await fetch(`${backendUrl}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ github_username: githubUsername, github_token: githubToken }),
  });

  if (!response.ok) {
    throw new ApiError(`Backend rejected the token (HTTP ${response.status})`, response.status);
  }
}
