#!/usr/bin/env node
// Throwaway: reconstruct a groundtruth drift history from a repo's git log.
//
// Two independent passes, because they have different requirements:
//
//   coverage  — pure `git show` / `git diff`. Needs no working tree, no
//               assertions file, and works on any repo. This is the
//               load-bearing panel: lines of new agent context that nothing
//               checks.
//   state     — needs a real working tree to check against, so it uses one
//               reusable worktree and moves it commit to commit. Only valid
//               where .groundtruth.jsonc is self-contained (no ../sibling
//               paths, which do not resolve from a worktree).
//
// Anachronism rule: an assertion only counts from the first commit at which
// its source file existed. Today's assertions run against an old tree
// otherwise produce a wall of red that is an artifact of the assertion not
// existing yet, rather than drift.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CONTEXT_CANDIDATES = ["CLAUDE.md", "AGENTS.md", ".cursor/rules", ".github/copilot-instructions.md"];

function git(repo, args, allowFail = false) {
  try {
    return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

const showAt = (repo, sha, path) => git(repo, ["show", `${sha}:${path}`], true);

/** Commits touching the context layer, oldest first — the only commits at
 *  which the coverage number can change. */
function contextCommits(repo) {
  const out = git(repo, ["log", "--reverse", "--format=%H|%cI|%an|%s", "--", ...CONTEXT_CANDIDATES]);
  return out.trim().split("\n").filter(Boolean).map((l) => {
    const [sha, date, author, ...rest] = l.split("|");
    return { sha, date, author, subject: rest.join("|") };
  });
}

/** Lines each assertion cites, as { file -> Set(lineNo) }, read at a commit. */
function citedLinesAt(repo, sha) {
  const raw = showAt(repo, sha, ".groundtruth.jsonc");
  const cited = new Map();
  let count = 0;
  if (!raw) return { cited, count };
  for (const m of raw.matchAll(/"source"\s*:\s*"([^"]+)"/g)) {
    count++;
    const [file, range] = m[1].split("#L");
    if (!range) continue;
    const [a, b] = range.split("-").map(Number);
    if (!cited.has(file)) cited.set(file, new Set());
    for (let n = a; n <= (b || a); n++) cited.get(file).add(n);
  }
  return { cited, count };
}

/** Line numbers added or modified in `file` between two commits, in the
 *  newer commit's numbering. Parsed from -U0 hunk headers. */
function addedLines(repo, prev, cur, file) {
  const diff = git(repo, ["diff", "-U0", "--no-color", prev, cur, "--", file], true);
  const lines = new Set();
  if (!diff) return lines;
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const len = m[2] === undefined ? 1 : Number(m[2]);
    for (let n = start; n < start + len; n++) lines.add(n);
  }
  return lines;
}

function coveragePass(repo) {
  const commits = contextCommits(repo);
  const rows = [];
  let cumulativeUncovered = 0;
  let prev = null;

  for (const c of commits) {
    const present = CONTEXT_CANDIDATES.filter((f) => showAt(repo, c.sha, f) !== null);
    const totalLines = present.reduce((n, f) => n + (showAt(repo, c.sha, f) ?? "").split("\n").length, 0);
    const { cited, count: assertionCount } = citedLinesAt(repo, c.sha);

    let added = 0;
    let uncovered = 0;
    if (prev) {
      for (const f of present) {
        const lines = addedLines(repo, prev.sha, c.sha, f);
        added += lines.size;
        const citedInF = cited.get(f) ?? new Set();
        for (const n of lines) if (!citedInF.has(n)) uncovered++;
      }
    }
    cumulativeUncovered += uncovered;

    const citedTotal = [...cited.values()].reduce((n, s) => n + s.size, 0);
    rows.push({
      sha: c.sha.slice(0, 8), date: c.date, author: c.author, subject: c.subject.slice(0, 70),
      contextFiles: present, totalLines, assertions: assertionCount, citedLines: citedTotal,
      addedLines: added, uncoveredAdded: uncovered, cumulativeUncovered,
      coveragePct: totalLines ? +(100 * citedTotal / totalLines).toFixed(1) : 0,
    });
    prev = c;
  }
  return rows;
}

/** True when every assertion path is inside the repo — ../sibling paths make
 *  a worktree checkout meaningless. */
function selfContained(repo) {
  const raw = showAt(repo, "HEAD", ".groundtruth.jsonc");
  return raw ? !/"\.\.\//.test(raw) : false;
}

function allCommits(repo) {
  return git(repo, ["log", "--reverse", "--format=%H|%cI|%an|%s"]).trim().split("\n").filter(Boolean).map((l) => {
    const [sha, date, author, ...rest] = l.split("|");
    return { sha, date, author, subject: rest.join("|") };
  });
}

// Reconstruct what the gate WOULD have reported on each commit, using the
// assertions file as it stood at that commit rather than today's. This is the
// only sound way to backfill state: an assertion authored in August makes a
// claim about an August repo, and applying it to July produces failures that
// are artifacts of the feature not existing yet. Verified: at groundtruth's
// 4a474b23 all 6 failures were of that kind. Commits before the assertions
// file existed are skipped rather than scored — there was no gate to report.
function statePass(repo, cli) {
  if (!selfContained(repo)) return { skipped: "assertions reference sibling repos (../), not checkable from a worktree" };
  const wt = mkdtempSync(join(tmpdir(), "gt-backfill-"));
  const tmpAssertions = join(tmpdir(), `gt-assertions-${process.pid}.jsonc`);
  const out = [];
  let skippedNoGate = 0;
  try {
    execFileSync("git", ["-C", repo, "worktree", "add", "--detach", "-f", wt, "HEAD"], { stdio: "ignore" });
    for (const c of allCommits(repo)) {
      const assertionsAtCommit = showAt(repo, c.sha, ".groundtruth.jsonc");
      if (assertionsAtCommit === null) { skippedNoGate++; continue; }
      writeFileSync(tmpAssertions, assertionsAtCommit);
      execFileSync("git", ["-C", wt, "checkout", "--detach", "-f", c.sha], { stdio: "ignore" });

      let res = null;
      try {
        res = JSON.parse(execFileSync("node", [cli, "check", "--repo", wt, "--file", tmpAssertions, "--json"],
          { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
      } catch (e) {
        try { res = JSON.parse(e.stdout ?? ""); } catch { res = null; }
      }
      if (!res) { out.push({ sha: c.sha.slice(0, 8), date: c.date, error: true }); continue; }

      out.push({
        sha: c.sha.slice(0, 8), date: c.date, author: c.author, subject: c.subject.slice(0, 70),
        total: res.results.length, passing: res.passing, failing: res.failing, unverifiable: res.unverifiable,
        failed: res.results.filter((a) => a.status === "failing").map((a) => a.assertion.source),
      });
    }
  } finally {
    execFileSync("git", ["-C", repo, "worktree", "remove", "--force", wt], { stdio: "ignore" });
    rmSync(wt, { recursive: true, force: true });
    rmSync(tmpAssertions, { force: true });
  }
  return { runs: out, skippedNoGate };
}

// ---- main ----
const repo = process.argv[2];
const cli = process.argv.slice(3).find((a) => !a.startsWith("--")) ?? "/Users/jay/repos/groundtruth/dist/cli.js";
const withState = process.argv.includes("--state");
if (!repo || repo.startsWith("--")) {
  console.error([
    "usage: backfill-history.mjs <repo> [path/to/dist/cli.js] [--state] [--out <file>]",
    "",
    "  Reconstructs a drift history from a repo's git log.",
    "  --state  also replay the gate commit by commit (needs a self-contained",
    "           .groundtruth.jsonc; slower, one worktree checkout per commit)",
  ].join("\n"));
  process.exit(1);
}

const coverage = coveragePass(repo);
const result = { repo, generated: new Date().toISOString(), coverage };
if (withState) result.state = statePass(repo, cli);

const name = repo.replace(/\/$/, "").split("/").pop();
const outFlag = process.argv.indexOf("--out");
const dest = outFlag !== -1 ? process.argv[outFlag + 1] : `history-${name}.json`;
writeFileSync(dest, JSON.stringify(result, null, 2));

console.log(`${name}: ${coverage.length} context commits`);
if (coverage.length) {
  const last = coverage[coverage.length - 1];
  console.log(`  context lines now: ${last.totalLines}  assertions: ${last.assertions}  cited: ${last.citedLines} (${last.coveragePct}%)`);
  console.log(`  cumulative uncovered added lines: ${last.cumulativeUncovered}`);
}
if (result.state?.skipped) console.log(`  state pass skipped — ${result.state.skipped}`);
else if (result.state) {
  const r = result.state.runs.filter((x) => !x.error);
  const red = r.filter((x) => x.failing > 0).length;
  console.log(`  gate reconstructed over ${r.length} commits (${result.state.skippedNoGate} before the gate existed)`);
  console.log(`  red on ${red} of them (${r.length ? (100 * red / r.length).toFixed(0) : 0}%)`);
}
console.log(`  -> ${dest}`);
