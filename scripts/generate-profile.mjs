import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER || "TW1ST3RX10";

if (!token) {
  throw new Error("GITHUB_TOKEN não configurado.");
}

const colors = {
  heading: "#FFFFFF",
  text: "#57606A",
  muted: "#57606A",
  blue: "#0969DA",
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

const query = `
query($login: String!) {
  user(login: $login) {
    login
    name

    repositories(
      first: 100
      orderBy: {field: UPDATED_AT, direction: DESC}
      ownerAffiliations: OWNER
      privacy: PUBLIC
    ) {
      totalCount
      nodes {
        name
        isFork
        updatedAt
        url
        primaryLanguage { name }
      }
    }

    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalRepositoryContributions
      totalIssueContributions

      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
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
  body: JSON.stringify({
    query,
    variables: {
      login: username,
    },
  }),
});

const data = await response.json();

if (!response.ok || data.errors) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const user = data.data.user;

if (!user) {
  throw new Error(`Usuário ${username} não encontrado.`);
}

const contributionCalendar =
  user.contributionsCollection.contributionCalendar;

const totalContributions = contributionCalendar.totalContributions;

const allDays = contributionCalendar.weeks.flatMap(
  (week) => week.contributionDays,
);


/* -------------------------------------------------------------------------- */
/* ACTIVITY SVG                                                               */
/* -------------------------------------------------------------------------- */

function createActivitySvg() {
  const width = 900;
  const height = 112;

  const stats = [
    { value: totalContributions, label: "CONTRIBUTIONS" },
    { value: user.contributionsCollection.totalCommitContributions, label: "COMMITS" },
    { value: user.contributionsCollection.totalPullRequestContributions, label: "PULL REQUESTS" },
    { value: user.contributionsCollection.totalIssueContributions, label: "ISSUES" },
  ];

  const tags = stats
    .map((stat, index) => {
      const x = 30 + index * 215;
      const label = `${formatNumber(stat.value)} ${stat.label}`;

      return `
        <g>
          <rect
            x="${x}"
            y="52"
            width="190"
            height="30"
            rx="4"
          fill="${colors.blue}"
          />
          <text
            x="${x + 95}"
            y="72"
            text-anchor="middle"
            fill="#FFFFFF"
            font-family="Arial, Helvetica, sans-serif"
            font-size="11"
            font-weight="700">
            ${escapeXml(label)}
          </text>
        </g>
      `;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">

  <text
    x="30"
    y="28"
    fill="${colors.heading}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="13"
    font-weight="700"
    letter-spacing="1.8">
    CONTRIBUTIONS · LAST 12 MONTHS
  </text>

  ${tags}

</svg>`;
}

/* -------------------------------------------------------------------------- */
/* CONTRIBUTION SUMMARY                                                      */
/* -------------------------------------------------------------------------- */

function createContributionSvg() {
  const width = 900;
  const height = 190;
  const windowDays = 365;
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(`${today}T00:00:00Z`);
  firstDay.setUTCDate(firstDay.getUTCDate() - (windowDays - 1));
  const firstDate = firstDay.toISOString().slice(0, 10);
  const days = allDays.filter(
    (day) => day.date >= firstDate && day.date <= today,
  );
  let record = 0;
  let run = 0;
  for (const day of days) {
    run = day.contributionCount > 0 ? run + 1 : 0;
    record = Math.max(record, run);
  }
  let current = 0;
  for (const day of [...days].reverse()) {
    if (day.date === today && day.contributionCount === 0) continue;
    if (day.contributionCount > 0) current++;
    else break;
  }
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const repo = [...user.repositories.nodes].filter((item) => !item.isFork)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const updated = repo ? new Date(repo.updatedAt).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">

  <text x="30" y="30" fill="${colors.heading}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="1.8">SEQUENCES · LAST 12 MONTHS</text>

  <g>
    <rect x="27" y="48" width="130" height="24" rx="4" fill="${colors.blue}" />
    <text x="93" y="64" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1">CURRENT SEQUENCE</text>
    <text x="30" y="119" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${current}</text>
    <text x="89" y="117" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="14">days in a row</text>
    <line x1="30" y1="132" x2="280" y2="132" stroke="#D1D9E0" stroke-width="2" stroke-linecap="round" />
    <line x1="30" y1="132" x2="${Math.max(31, 30 + 250 * (record ? current / record : 0))}" y2="132" stroke="${colors.blue}" stroke-width="5" stroke-linecap="round" />
  </g>

  <line x1="310" y1="48" x2="310" y2="139" stroke="#D1D9E0" stroke-width="1" />

  <g>
    <rect x="340" y="48" width="78" height="24" rx="4" fill="${colors.blue}" />
    <text x="379" y="64" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1">RECORD</text>
    <text x="340" y="119" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${record}</text>
    <text x="399" y="117" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="14">days in a row</text>
  </g>

  <g>
    <rect x="570" y="48" width="130" height="24" rx="4" fill="${colors.blue}" />
    <text x="635" y="65" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1.2">DAYS WITH ACTIVITY</text>
    <text x="570" y="119" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${activeDays}</text>
    <text x="650" y="117" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="14">of ${windowDays}</text>
  </g>

  ${repo ? `<line x1="30" y1="151" x2="${width - 30}" y2="151" stroke="#D1D9E0" stroke-width="1" />
  <text x="30" y="174" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1.2">RECENT REPOSITORY</text>
  <a href="${escapeXml(repo.url)}"><text x="190" y="174" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">${escapeXml(repo.name)}</text></a>
  <text x="${width - 30}" y="174" text-anchor="end" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="12">${escapeXml(repo.primaryLanguage?.name || "No language")} · Updated on ${updated}</text>` : ""}

</svg>`;
}

/* -------------------------------------------------------------------------- */
/* WRITE FILES                                                                */
/* -------------------------------------------------------------------------- */

await fs.mkdir("assets", { recursive: true });

await fs.writeFile(
  "assets/activity.svg",
  createActivitySvg(),
  "utf8",
);

await fs.writeFile(
  "assets/contributions.svg",
  createContributionSvg(),
  "utf8",
);

/* -------------------------------------------------------------------------- */
/* SUMMARY                                                                    */
/* -------------------------------------------------------------------------- */

console.log("Perfil atualizado.");
console.log(`Usuário: ${user.login}`);
console.log(
  `Contributions: ${formatNumber(totalContributions)}`,
);
console.log(
  `Commits: ${formatNumber(
    user.contributionsCollection.totalCommitContributions,
  )}`,
);
console.log(
  `Pull Requests: ${formatNumber(
    user.contributionsCollection.totalPullRequestContributions,
  )}`,
);
console.log(
  `Repositórios: ${formatNumber(user.repositories.totalCount)}`,
);
