import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssertionStatus, TextMatchesAcrossArgs, TextNormalizer } from "../types.js";

// Why this kind exists, since it is the first one that is about agreement
// between files rather than about a fact inside one.
//
// A sentence that has to be stated identically in several places is a
// standing invitation to drift, and the drift is never a bad edit — it is a
// *correct* edit that reached most of the copies. The motivating case: one
// availability sentence living in a CV, a LinkedIn draft, a booking message,
// a website and a profile README. Two separate fixes each reached four of the
// six, and both times a substring search reported the remaining two as clean,
// because every variant contained the substring being grepped for.
//
// Hence the two properties that matter more than the matching itself:
// normalisation (below), and treating a *missing* file as a failure.

/** Collapse every run of whitespace to one space. This is the transform that
 * earns the kind its keep: hard-wrapped prose is the single most common way a
 * phrase hides from a line-oriented search, and a Markdown file re-wrapped by
 * a formatter changes none of its meaning and all of its line breaks. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Strip the wrappers that surround prose without being part of it:
 * per-line blockquote markers and `*`/`_` emphasis runs. Deliberately narrow
 * — see the known gap in the README's kind table for what it does not do. */
function stripMarkdown(text: string): string {
  return text.replace(/^[ \t]*>[ \t]?/gm, "").replace(/[*_]/g, "");
}

const NORMALIZERS: Record<TextNormalizer, (text: string) => string> = {
  whitespace: collapseWhitespace,
  markdown: stripMarkdown,
};

// Order matters: markdown stripping runs first so that removing a `>` at the
// start of a line leaves whitespace for the collapse pass to absorb.
const ORDER: TextNormalizer[] = ["markdown", "whitespace"];

function normalize(text: string, requested: TextNormalizer[]): string {
  return ORDER.filter((n) => requested.includes(n)).reduce(
    (acc, n) => NORMALIZERS[n](acc),
    text,
  );
}

export function checkTextMatchesAcross(
  repoRoot: string,
  args: TextMatchesAcrossArgs,
): { status: AssertionStatus; detail: string } {
  const requested = args.normalize ?? ["whitespace"];
  const needle = normalize(args.text, requested);

  if (needle === "") {
    return { status: "unverifiable", detail: "text is empty after normalization" };
  }

  const missing: string[] = [];
  const without: string[] = [];

  for (const file of args.files) {
    const absPath = join(repoRoot, file);
    if (!existsSync(absPath)) {
      missing.push(file);
      continue;
    }
    if (!normalize(readFileSync(absPath, "utf8"), requested).includes(needle)) {
      without.push(file);
    }
  }

  // A missing file fails rather than reporting unverifiable, which is the
  // opposite of env_var_absent's policy and deliberately so. There, a file
  // that does not exist cannot contain the variable, so absence tells you
  // nothing and guessing "passing" would be a false clean. Here the claim is
  // that N named surfaces all state this sentence; a surface that no longer
  // exists is not an unknown, it is a surface that has stopped stating it.
  // Reporting unverifiable would mean deleting a file is the way to go green.
  if (missing.length > 0 || without.length > 0) {
    const parts = [
      missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
      without.length > 0 ? `does not contain the text: ${without.join(", ")}` : null,
    ].filter(Boolean);
    return { status: "failing", detail: parts.join("; ") };
  }

  return {
    status: "passing",
    detail: `all ${args.files.length} file(s) contain the text: ${args.files.join(", ")}`,
  };
}
