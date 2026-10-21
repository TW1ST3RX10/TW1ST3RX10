import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER || "TW1ST3RX10";

if (!token) {
  throw new Error("GITHUB_TOKEN não configurado.");
}

const colors = {
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
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              name
            }
          }
        }
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
/* LANGUAGE DATA                                                              */
/* -------------------------------------------------------------------------- */

const languageBytes = new Map();

for (const repository of user.repositories.nodes) {
  if (repository.isFork) continue;

  for (const edge of repository.languages.edges) {
    const language = edge.node.name;
    const current = languageBytes.get(language) || 0;

    languageBytes.set(language, current + edge.size);
  }
}

const languages = [...languageBytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([name, bytes]) => ({
    name,
    bytes,
  }));

const totalLanguageBytes = languages.reduce(
  (sum, language) => sum + language.bytes,
  0,
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
    fill="${colors.text}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="13"
    font-weight="700"
    letter-spacing="1.8">
    ACTIVITY
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
  const days = allDays;
  let record = 0;
  let run = 0;
  for (const day of days) {
    run = day.contributionCount > 0 ? run + 1 : 0;
    record = Math.max(record, run);
  }
  let current = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const day of [...days].reverse()) {
    if (day.date === today && day.contributionCount === 0) continue;
    if (day.contributionCount > 0) current++;
    else break;
  }
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const repo = [...user.repositories.nodes].filter((item) => !item.isFork)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const updated = repo ? new Date(repo.updatedAt).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">

  <text x="30" y="30" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="1.8">SEQUÊNCIAS · ÚLTIMOS 12 MESES</text>

  <g>
    <rect x="30" y="48" width="126" height="24" rx="4" fill="${colors.blue}" />
    <text x="93" y="64" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1">SEQUÊNCIA ATUAL</text>
    <text x="30" y="119" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${current}</text>
    <text x="89" y="117" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="14">dias seguidos</text>
    <line x1="30" y1="132" x2="280" y2="132" stroke="#D1D9E0" stroke-width="2" stroke-linecap="round" />
    <line x1="30" y1="132" x2="${Math.max(31, 30 + 250 * (record ? current / record : 0))}" y2="132" stroke="${colors.blue}" stroke-width="5" stroke-linecap="round" />
  </g>

  <line x1="310" y1="48" x2="310" y2="139" stroke="#D1D9E0" stroke-width="1" />

  <g>
    <rect x="340" y="48" width="78" height="24" rx="4" fill="${colors.blue}" />
    <text x="379" y="64" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1">RECORDE</text>
    <text x="340" y="119" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${record}</text>
    <text x="399" y="117" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="14">dias seguidos</text>
  </g>

  <g>
    <text x="570" y="70" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1.2">DIAS COM ATIVIDADE</text>
    <text x="570" y="112" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">${activeDays}</text>
    <text x="613" y="111" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="12">de ${days.length}</text>
  </g>

  ${repo ? `<line x1="30" y1="151" x2="${width - 30}" y2="151" stroke="#D1D9E0" stroke-width="1" />
  <text x="30" y="174" fill="${colors.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1.2">REPOSITÓRIO RECENTE</text>
  <a href="${escapeXml(repo.url)}"><text x="190" y="174" fill="${colors.blue}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">${escapeXml(repo.name)}</text></a>
  <text x="${width - 30}" y="174" text-anchor="end" fill="${colors.text}" font-family="Arial, Helvetica, sans-serif" font-size="12">${escapeXml(repo.primaryLanguage?.name || "Sem linguagem")} · atualizado em ${updated}</text>` : ""}

</svg>`;
}

/* -------------------------------------------------------------------------- */
/* LANGUAGES SVG                                                              */
/* -------------------------------------------------------------------------- */

function createLanguagesSvg() {
  const width = 900;
  const height = 365;

  const sections = [
    {
      title: "LANGUAGES",
      items: ["Python", "TypeScript", "Dart", "SQL"],
    },
    {
      title: "BACKEND",
      items: ["Node.js", "NestJS", "Prisma"],
    },
    {
      title: "DATABASE",
      items: ["MySQL"],
    },
    {
      title: "TOOLS",
      items: ["Git", "GitHub", "Docker"],
    },
  ];

  const pills = [];

  let y = 98;

  for (const section of sections) {
    pills.push(`
      <text
        x="30"
        y="${y}"
        fill="${colors.blue}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="10"
        font-weight="700"
        letter-spacing="1.8">
        ${section.title}
      </text>
    `);

    y += 25;

    let x = 30;

    for (const item of section.items) {
      const textWidth = item.length * 7.2;
      const pillWidth = textWidth + 30;

      if (x + pillWidth > width - 30) {
        x = 30;
        y += 43;
      }

      pills.push(`
        <g>
          <rect
            x="${x}"
            y="${y - 18}"
            width="${pillWidth}"
            height="30"
            rx="15"
            fill="${colors.blue}"
            stroke="none"
          />

          <text
            x="${x + 22}"
            y="${y + 1}"
            fill="#FFFFFF"
            font-family="Arial, Helvetica, sans-serif"
            font-size="11">
            ${escapeXml(item)}
          </text>
        </g>
      `);

      x += pillWidth + 10;
    }

    y += 48;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg">

  <text
    x="30"
    y="32"
    fill="${colors.blue}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="14"
    font-weight="700"
    letter-spacing="2.4">
    STACK
  </text>

  <text
    x="30"
    y="58"
    fill="${colors.muted}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="12">
    Technologies I currently use and study
  </text>

  ${pills}

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

await fs.writeFile(
  "assets/languages.svg",
  createLanguagesSvg(),
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
console.log(
  `Linguagens encontradas: ${languages.length}`,
);

console.log("\nPrincipais linguagens:");

for (const language of languages.slice(0, 6)) {
  const percentage =
    totalLanguageBytes > 0
      ? (language.bytes / totalLanguageBytes) * 100
      : 0;

  console.log(
    `- ${language.name}: ${percentage.toFixed(1)}%`,
  );
}
