import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type DefaultTheme, type HeadConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const SITE_URL = "https://groundtruth.sh/";
const SITE_TITLE = "groundtruth";
const OG_TITLE = "groundtruth — a compiler for your agent-context files";
const DESCRIPTION =
  "A compiler and CI gate for your CLAUDE.md / AGENTS.md — turn agent-context claims into checkable assertions and catch drift before an agent acts on a stale rule.";

// The released CLI/Action version this site documents, read from the root
// package.json at build time. package.json and action.yml's `version` input
// are bumped together in every release commit (see the release-process page),
// so this is always the version a consumer should pin.
const CLI_VERSION: string = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;

// Wherever a page needs to mention that version — pinned Action refs in YAML
// examples, mostly — the markdown source writes this placeholder instead of a
// literal number, and the markdown pipeline substitutes it at build time
// (fenced code, inline code, and plain text alike). A release bump therefore
// updates every example on the next deploy; there is no way for a pinned
// version in the docs to go stale. Stale pinned versions are documentation
// drift, and this site cannot afford the irony.
const VERSION_TOKEN = "%%GT_VERSION%%";

const substituteVersion = (text: string): string =>
  text.split(VERSION_TOKEN).join(CLI_VERSION);

type MdToken = {
  type: string;
  content: string;
  children?: MdToken[] | null;
};

// Declared once, used twice: rendered into themeConfig below, and walked by
// buildEnd to emit llms.txt in the same order readers see in the sidebar.
const SIDEBAR: Record<string, { text: string; items: { text: string; link: string }[] }[]> = {
  "/guide/": [
    {
      text: "Guide",
      items: [
        { text: "Getting started", link: "/guide/getting-started" },
        { text: "Configuration", link: "/guide/configuration" },
        { text: "GitHub Action", link: "/guide/github-action" },
        { text: "End-to-end example", link: "/guide/example" },
      ],
    },
  ],
  "/reference/": [
    {
      text: "Reference",
      items: [
        { text: "CLI", link: "/reference/cli" },
        { text: "Assertion kinds", link: "/reference/assertion-kinds" },
      ],
    },
  ],
  "/architecture/": [
    {
      text: "Architecture",
      items: [
        { text: "Overview", link: "/architecture/overview" },
        { text: "Decisions (ADRs)", link: "/architecture/decisions" },
      ],
    },
  ],
  "/project/": [
    {
      text: "Project",
      items: [
        { text: "Roadmap", link: "/project/roadmap" },
        { text: "FAQ", link: "/project/faq" },
        { text: "Troubleshooting", link: "/project/troubleshooting" },
        { text: "Contributing", link: "/project/contributing" },
        { text: "Development", link: "/project/development" },
        { text: "Release process", link: "/project/release-process" },
      ],
    },
  ],
};

const stripFrontmatter = (src: string): string =>
  src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

const frontmatterDescription = (src: string): string | undefined => {
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm?.[1].match(/^description:\s*(.+?)\s*$/m);
  return line?.[1].replace(/^["']|["']$/g, "");
};

export default withMermaid(
  defineConfig({
    title: SITE_TITLE,
    description: DESCRIPTION,
    lang: "en-US",
    base: "/",
    lastUpdated: true,
    cleanUrls: true,
    sitemap: {
      hostname: SITE_URL,
    },

    head: [
      ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
      ["meta", { name: "theme-color", content: "#16a34a" }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "groundtruth" }],
      ["meta", { property: "og:image", content: `${SITE_URL}og-image.png` }],
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      [
        "meta",
        {
          property: "og:image:alt",
          content: "groundtruth — verify CLAUDE.md / AGENTS.md claims against the actual repo",
        },
      ],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:image", content: `${SITE_URL}og-image.png` }],
      [
        "meta",
        {
          name: "twitter:image:alt",
          content: "groundtruth — verify CLAUDE.md / AGENTS.md claims against the actual repo",
        },
      ],
    ],

    // Canonical URL and social-card tags are per-page: search engines get one
    // canonical per route, and a shared link to any page unfurls with that
    // page's own title and description instead of the home page's.
    transformPageData(pageData) {
      const route = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
      const url = `${SITE_URL}${route}`;
      const isHome = pageData.relativePath === "index.md";
      const title = isHome ? OG_TITLE : `${pageData.title} | ${SITE_TITLE}`;
      const description = pageData.description || DESCRIPTION;

      const head: HeadConfig[] = [
        ["link", { rel: "canonical", href: url }],
        ["meta", { property: "og:url", content: url }],
        ["meta", { property: "og:title", content: title }],
        ["meta", { property: "og:description", content: description }],
        ["meta", { name: "twitter:title", content: title }],
        ["meta", { name: "twitter:description", content: description }],
      ];

      pageData.frontmatter.head = [...(pageData.frontmatter.head ?? []), ...head];
    },

    themeConfig: {
      logo: "/favicon.svg",
      siteTitle: "groundtruth",

      nav: [
        { text: "Guide", link: "/guide/getting-started" },
        { text: "GitHub Action", link: "/guide/github-action" },
        { text: "Reference", link: "/reference/cli" },
        { text: "Architecture", link: "/architecture/overview" },
        {
          text: "Project",
          items: [
            { text: "Roadmap", link: "/project/roadmap" },
            { text: "FAQ", link: "/project/faq" },
            { text: "Troubleshooting", link: "/project/troubleshooting" },
            { text: "Contributing", link: "/project/contributing" },
            { text: "Development", link: "/project/development" },
            { text: "Release process", link: "/project/release-process" },
          ],
        },
        { text: "GitHub", link: "https://github.com/jaystewart-dev/groundtruth" },
      ],

      sidebar: SIDEBAR as DefaultTheme.Sidebar,

      socialLinks: [
        { icon: "github", link: "https://github.com/jaystewart-dev/groundtruth" },
        { icon: "npm", link: "https://www.npmjs.com/package/@groundtruth-sh/cli" },
      ],

      search: {
        provider: "local",
      },

      editLink: {
        pattern: "https://github.com/jaystewart-dev/groundtruth/edit/main/site/:path",
        text: "Edit this page on GitHub",
      },

      footer: {
        message: "Released under the MIT License.",
        copyright: "Copyright © 2026 Jay Stewart",
      },

      outline: {
        level: [2, 3],
      },
    },

    markdown: {
      theme: { light: "github-light", dark: "github-dark" },
      config(md) {
        // Substitute the version placeholder after parsing, before rendering:
        // fenced code keeps clean syntax highlighting of the real value, and
        // the copy button copies what the page shows.
        md.core.ruler.push("gt_version", (state) => {
          const walk = (tokens: MdToken[]): void => {
            for (const token of tokens) {
              if (token.children) walk(token.children);
              if (
                (token.type === "fence" ||
                  token.type === "code_inline" ||
                  token.type === "code_block" ||
                  token.type === "text") &&
                token.content.includes(VERSION_TOKEN)
              ) {
                token.content = substituteVersion(token.content);
              }
            }
          };
          walk(state.tokens as unknown as MdToken[]);
        });
      },
    },

    // The audience for this tool runs coding agents; let those agents read the
    // docs without scraping HTML. llms.txt is a linked index, llms-full.txt is
    // every page's markdown in sidebar order — both generated from the real
    // page list at build time, so neither can drift from the site.
    buildEnd(siteConfig) {
      const { srcDir, outDir, pages } = siteConfig;

      const ordered: { title: string; link: string; relPath: string }[] = [];
      for (const groups of Object.values(SIDEBAR)) {
        for (const group of groups) {
          for (const item of group.items) {
            const relPath = `${item.link.replace(/^\//, "")}.md`;
            if (pages.includes(relPath)) {
              ordered.push({ title: item.text, link: item.link, relPath });
            }
          }
        }
      }
      // Anything published but not in the sidebar still gets listed — a page
      // silently missing from the index would be this site's own drift bug.
      for (const relPath of pages) {
        if (relPath === "index.md") continue;
        if (!ordered.some((entry) => entry.relPath === relPath)) {
          const title =
            stripFrontmatter(readFileSync(join(srcDir, relPath), "utf8")).match(/^#\s+(.+)$/m)?.[1] ??
            relPath;
          ordered.push({ title, link: `/${relPath.replace(/\.md$/, "")}`, relPath });
        }
      }

      const indexLines = [
        `# ${SITE_TITLE}`,
        "",
        `> ${DESCRIPTION}`,
        "",
        `Current release: v${CLI_VERSION} (npm: @groundtruth-sh/cli · GitHub Action: jaystewart-dev/groundtruth@v${CLI_VERSION})`,
        "",
        "## Docs",
        "",
        ...ordered.map(({ title, link, relPath }) => {
          const description = frontmatterDescription(readFileSync(join(srcDir, relPath), "utf8"));
          const url = `${SITE_URL}${link.replace(/^\//, "")}`;
          return `- [${title}](${url})${description ? `: ${description}` : ""}`;
        }),
        "",
        "## Optional",
        "",
        `- [Full docs as one file](${SITE_URL}llms-full.txt)`,
        `- [Source repository](https://github.com/jaystewart-dev/groundtruth)`,
        "",
      ];
      writeFileSync(join(outDir, "llms.txt"), indexLines.join("\n"));

      const fullSections = [{ title: SITE_TITLE, link: "/", relPath: "index.md" }, ...ordered].map(
        ({ title, link, relPath }) => {
          const raw = readFileSync(join(srcDir, relPath), "utf8");
          let content = substituteVersion(
            stripFrontmatter(raw).replace(/<style>[\s\S]*?<\/style>/g, ""),
          ).trim();
          if (!/^#\s/.test(content)) content = `# ${title}\n\n${content}`;
          const url = `${SITE_URL}${link.replace(/^\//, "")}`;
          return `<!-- Source: ${url} -->\n\n${content}`;
        },
      );
      writeFileSync(join(outDir, "llms-full.txt"), fullSections.join("\n\n---\n\n") + "\n");
    },

    vite: {
      define: {
        // PostHog's *public* project key — it ships in the client bundle by
        // design, so this is not a secret. It comes from the environment only
        // so that local, fork, and preview builds are silently untracked and
        // never pollute the production numbers. Consumed in theme/index.ts.
        __POSTHOG_KEY__: JSON.stringify(process.env.POSTHOG_KEY ?? ""),
      },
    },

    mermaid: {},
  }),
);
