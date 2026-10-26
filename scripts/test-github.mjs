import { getGitHubToken } from "./github-token.mjs";

const token = getGitHubToken();

const query = `
query {
  viewer {
    login
    name
    repositories(
      first: 10,
      ownerAffiliations: OWNER,
      privacy: PUBLIC
    ) {
      totalCount
    }
  }
}
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "TW1ST3RX10-profile",
  },
  body: JSON.stringify({ query }),
});

const data = await response.json();

if (!response.ok || data.errors) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(data.data.viewer);