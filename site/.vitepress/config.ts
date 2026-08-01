import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const SITE_URL = "https://groundtruth.sh/";
const DESCRIPTION =
  "A compiler and CI gate for your CLAUDE.md / AGENTS.md — turn agent-context claims into checkable assertions and catch drift before an agent acts on a stale rule.";

export default withMermaid(
  defineConfig({
    title: "groundtruth",
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
      ["meta", { name: "theme-color", content: "#3f6212" }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "groundtruth" }],
      ["meta", { property: "og:title", content: "groundtruth — a compiler for your agent-context files" }],
      ["meta", { property: "og:description", content: DESCRIPTION }],
      ["meta", { property: "og:image", content: `${SITE_URL}og-image.png` }],
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      ["meta", { property: "og:url", content: SITE_URL }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:title", content: "groundtruth — a compiler for your agent-context files" }],
      ["meta", { name: "twitter:description", content: DESCRIPTION }],
      ["meta", { name: "twitter:image", content: `${SITE_URL}og-image.png` }],
    ],

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

      sidebar: {
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
      },

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
    },

    mermaid: {},
  }),
);
