import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Assertion } from "../types.js";

// Every assertion carries a `source` — "<file>#L<line>" — and the whole
// promise of the report is that it traces a failure back to the sentence that
// made the claim. That pointer is itself a claim about the repo, and it rots
// the same way every other claim does: someone inserts a paragraph into
// CLAUDE.md, every line number below it shifts, and the assertions still pass
// while pointing at the wrong sentence. Nothing about the check itself
// notices, because the check reads the repo, not the citation.
//
// Measured on this repo before this module existed: 9 of 15 pointers had
// drifted, and the Action had been annotating the wrong lines of CLAUDE.md.
// A tool that exists to catch unchecked claims cannot leave this one
// unchecked.
//
// The matching is deliberately fuzzy. A `claim` is a hand-copied, often
// elided ("It ships ... as a GitHub Action") paraphrase of prose that may be
// hard-wrapped across the cited span, so an exact substring test would be
// wrong far more often than the drift it is looking for. Token overlap
// answers the question actually worth asking — "is the cited span even about
// this claim?" — and is what separates a slightly loose citation from one
// pointing at an unrelated paragraph.

export type SourceWarning = {
  claim: string;
  source: string;
  reason: string;
  /** Where the claim's text actually appears now, when it can be located. */
  suggestion?: string;
  /** How many further assertions cite the same missing file. Set only on the
   * one warning emitted for it, so a first run against a repo with no context
   * file yet reports that fact once instead of once per assertion. */
  alsoAffects?: number;
};

/** Fraction of the claim's distinct words that must appear in the cited span. */
const MATCH_THRESHOLD = 0.6;

/** Claims are abbreviated with an ellipsis when the original spans a
 * paragraph; each side is matched separately and the best score wins. */
const ELISION = /\s*(?:\.\.\.|…)\s*/;

const SOURCE_PATTERN = /^(.*?)#L(\d+)(?:-L?(\d+))?$/;

export type ParsedSource = { file: string; start: number | null; end: number | null };

export function parseSource(source: string): ParsedSource {
  const match = SOURCE_PATTERN.exec(source.trim());
  if (!match) return { file: source.trim(), start: null, end: null };
  const [, file, start, end] = match;
  return {
    file: (file ?? "").trim(),
    start: Number(start),
    end: end ? Number(end) : Number(start),
  };
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

/** How much of `claim` the `span` accounts for, 0..1. */
function overlap(claim: string, span: string): number {
  const wanted = new Set(tokenize(claim));
  if (wanted.size === 0) return 1;
  const present = new Set(tokenize(span));
  let hits = 0;
  for (const token of wanted) if (present.has(token)) hits++;
  return hits / wanted.size;
}

function scoreClaim(claim: string, span: string): number {
  return Math.max(...claim.split(ELISION).filter(Boolean).map((part) => overlap(part, span)));
}

/** The line where this claim now reads best, scanning windows the same height
 * as the citation — so a warning tells the maintainer what to change it to. */
function relocate(claim: string, lines: string[], height: number): { line: number; score: number } | null {
  let best: { line: number; score: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const score = scoreClaim(claim, lines.slice(i, i + height).join(" "));
    if (!best || score > best.score) best = { line: i + 1, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}

function formatSuggestion(file: string, line: number, height: number): string {
  return height > 1 ? `${file}#L${line}-${line + height - 1}` : `${file}#L${line}`;
}

/**
 * Check that every assertion's `source` cites lines that actually state its
 * claim. Findings are warnings, never failures: a loose citation is a
 * documentation bug, not drift in the repo the assertions describe, and it
 * must not start failing builds for people who upgrade. `--strict-sources`
 * opts into failing on them.
 */
export function verifyAssertionSources(repoRoot: string, assertions: Assertion[]): SourceWarning[] {
  const warnings: SourceWarning[] = [];
  const fileCache = new Map<string, string[] | null>();
  // A missing context file is one fact about the repo, not one per assertion
  // that cites it. Copying the shipped example into a repo with no CLAUDE.md
  // yet would otherwise open with the same sentence seven times.
  const missingFileWarning = new Map<string, SourceWarning>();

  const linesOf = (file: string): string[] | null => {
    if (!fileCache.has(file)) {
      const absPath = join(repoRoot, file);
      fileCache.set(file, existsSync(absPath) ? readFileSync(absPath, "utf8").split(/\r?\n/) : null);
    }
    return fileCache.get(file) ?? null;
  };

  for (const assertion of assertions) {
    const { claim, source } = assertion;
    const { file, start, end } = parseSource(source);
    if (!file) continue;

    const lines = linesOf(file);
    if (lines === null) {
      const first = missingFileWarning.get(file);
      if (first) {
        first.alsoAffects = (first.alsoAffects ?? 0) + 1;
      } else {
        const warning: SourceWarning = {
          claim,
          source,
          reason: `source file "${file}" does not exist`,
        };
        missingFileWarning.set(file, warning);
        warnings.push(warning);
      }
      continue;
    }

    // No "#L" fragment: the citation names a file and nothing finer, which is
    // a weaker pointer but not a wrong one. Nothing to verify.
    if (start === null || end === null) continue;

    if (start < 1 || end > lines.length) {
      const moved = relocate(claim, lines, Math.max(1, end - start + 1));
      warnings.push({
        claim,
        source,
        reason: `cites line ${start}-${end} but ${file} has ${lines.length} lines`,
        ...(moved ? { suggestion: formatSuggestion(file, moved.line, Math.max(1, end - start + 1)) } : {}),
      });
      continue;
    }

    const height = end - start + 1;
    if (scoreClaim(claim, lines.slice(start - 1, end).join(" ")) >= MATCH_THRESHOLD) continue;

    const found = relocate(claim, lines, height);
    warnings.push({
      claim,
      source,
      reason: `${file} line ${start}${height > 1 ? `-${end}` : ""} does not state this claim`,
      ...(found ? { suggestion: formatSuggestion(file, found.line, height) } : {}),
    });
  }

  return warnings;
}
