import { execFileSync } from "node:child_process";

export function getGitHubToken() {
  const environmentToken = process.env.GITHUB_TOKEN?.trim();
  if (environmentToken) {
    return environmentToken;
  }

  let cliToken;
  try {
    cliToken = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(
      "GITHUB_TOKEN não configurado e não foi possível obter uma sessão autenticada do GitHub CLI. Execute `gh auth login` uma vez.",
      { cause: error },
    );
  }

  if (!cliToken) {
    throw new Error(
      "GITHUB_TOKEN não configurado e `gh auth token` não retornou um token. Execute `gh auth login` uma vez.",
    );
  }

  return cliToken;
}
