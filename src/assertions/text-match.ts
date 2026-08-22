import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PatternDigest } from "../types.js";

// Shared machinery for the content-assertion kinds (text_present,
// text_absent) and the evict command: scope resolution over tracked text
// files, plaintext line matching, and the two-stage digest matcher for
// redacted patterns. See ADR-0006 (scope rules) and ADR-0007 (digests).

// ---------------------------------------------------------------------------
// Rolling-hash parameters. These are part of the on-disk digest format: every
// committed patternDigest's `rk` field was computed under them, so they must
// never change without an `algo` version bump.
const RK_BASE = 257;

/** Rabin-Karp hash (base 257, modulus 2^32) of a byte buffer. */
export function rollingHash(bytes: Buffer): number {
  let h = 0;
  for (const byte of bytes) h = (Math.imul(h, RK_BASE) + byte) >>> 0;
  return h;
}

/** Salted confirmation hash: hex sha256(utf8(salt) + windowBytes). */
export function saltedDigest(salt: string, windowBytes: Buffer): string {
  return createHash("sha256").update(salt, "utf8").update(windowBytes).digest("hex");
}

export function normalizeText(text: string, normalize: PatternDigest["normalize"]): string {
  return normalize === "lower" ? text.toLowerCase() : text;
}

/** Build a complete patternDigest for a literal — the authoring side of the
 * matcher below, used by `groundtruth digest` and `evict --redact`. */
export function buildPatternDigest(
  literal: string,
  salt: string,
  normalize: PatternDigest["normalize"],
): PatternDigest {
  const normalized = Buffer.from(normalizeText(literal, normalize), "utf8");
  return {
    algo: "sha256",
    salt,
    digest: saltedDigest(salt, normalized),
    rk: rollingHash(normalized),
    length: normalized.length,
    normalize,
  };
}

// ---------------------------------------------------------------------------
// Scope resolution

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8 * 1024;

export type Scope =
  | { ok: true; files: string[]; skipped: string[]; description: string }
  | { ok: false; detail: string };

/** Minimal glob → RegExp: supports `**` (any path segments), `*` (within a
 * segment), and `?` (single character). Deliberately tiny instead of a
 * dependency — the CLI stays light, and these three cover the include/exclude
 * shapes an assertions file realistically needs (ADR-0006). */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        // `**/` matches zero or more whole segments; bare `**` matches anything.
        out += glob[i + 2] === "/" ? "(?:[^/]*/)*" : ".*";
        i += glob[i + 2] === "/" ? 2 : 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += ch!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

function isBinary(absPath: string): boolean {
  const fd = readFileSync(absPath);
  return fd.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}

/**
 * Resolve which files a text_absent-style scan covers.
 *
 * With `files`: exactly those (a missing file counts as "absent there", but
 * if none exist the scan is unverifiable, mirroring env_var_absent). Without:
 * every git-tracked file under `repoRoot` — never a raw directory walk, which
 * would scan node_modules and produce garbage — filtered by `include`/`exclude`
 * globs. Binary files and files over 5 MB are skipped and reported in
 * `skipped`, never silently. The assertions file itself is always excluded;
 * see CheckContext in types.ts for why.
 */
export function resolveScope(
  repoRoot: string,
  opts: {
    files?: string[];
    include?: string[];
    exclude?: string[];
    assertionsFile?: string;
  },
): Scope {
  const excludedAbsolute = new Set<string>([resolve(repoRoot, ".groundtruth.jsonc")]);
  if (opts.assertionsFile) excludedAbsolute.add(resolve(opts.assertionsFile));

  let candidates: string[];
  let description: string;

  if (opts.files && opts.files.length > 0) {
    const existing = opts.files.filter((f) => {
      try {
        return statSync(join(repoRoot, f)).isFile();
      } catch {
        return false;
      }
    });
    if (existing.length === 0) {
      return {
        ok: false,
        detail: `none of the target files exist (checked: ${opts.files.join(", ")})`,
      };
    }
    candidates = existing;
    description = `${existing.length} listed file(s)`;
  } else {
    const ls = spawnSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "buffer",
      shell: false,
    });
    if (ls.error || ls.status !== 0) {
      return {
        ok: false,
        detail:
          `cannot enumerate tracked files (git ${ls.error ? "is not available" : `exited ${ls.status}`} in ${repoRoot}) — ` +
          `pass explicit \`files\` or \`include\` to scan without git`,
      };
    }
    candidates = ls.stdout.toString("utf8").split("\0").filter(Boolean);
    if (opts.include && opts.include.length > 0) {
      const includes = opts.include.map(globToRegExp);
      candidates = candidates.filter((f) => includes.some((re) => re.test(f)));
    }
    description = `${candidates.length} tracked file(s)`;
  }

  if (opts.exclude && opts.exclude.length > 0) {
    const excludes = opts.exclude.map(globToRegExp);
    candidates = candidates.filter((f) => !excludes.some((re) => re.test(f)));
  }

  const files: string[] = [];
  const skipped: string[] = [];
  for (const file of candidates) {
    const abs = resolve(repoRoot, file);
    if (excludedAbsolute.has(abs)) continue;
    if (file === ".git" || file.startsWith(".git/")) continue;
    let size: number;
    try {
      const stat = statSync(abs);
      if (!stat.isFile()) continue;
      size = stat.size;
    } catch {
      continue; // tracked but deleted from the working tree — nothing to scan
    }
    if (size > MAX_FILE_BYTES) {
      skipped.push(`${file} (${Math.round(size / 1024 / 1024)} MB, over the 5 MB scan limit)`);
      continue;
    }
    if (isBinary(abs)) {
      skipped.push(`${file} (binary)`);
      continue;
    }
    files.push(file);
  }

  return { ok: true, files, skipped, description };
}

// ---------------------------------------------------------------------------
// Matching

export type Hit = {
  file: string;
  line: number; // 1-based
  text?: string; // the matching line — absent for digest hits, by design
};

export type Matcher =
  | { ok: true; findIn: (file: string, content: string) => Hit[] }
  | { ok: false; detail: string };

/** Compile a plaintext pattern into a line-by-line matcher. An invalid regex
 * yields `{ ok: false }` — surfaced as unverifiable, never a crash and never
 * a silent pass (ADR-0002). */
export function compilePattern(opts: {
  pattern: string;
  patternType?: "literal" | "regex";
  caseInsensitive?: boolean;
}): Matcher {
  const flags = opts.caseInsensitive ? "i" : "";
  let re: RegExp;
  if ((opts.patternType ?? "literal") === "regex") {
    try {
      re = new RegExp(opts.pattern, flags);
    } catch (err) {
      return {
        ok: false,
        detail: `pattern does not compile as a regex: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else {
    re = new RegExp(opts.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  }
  return {
    ok: true,
    findIn: (file, content) => {
      const hits: Hit[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.replace(/\r$/, "");
        if (re.test(line)) hits.push({ file, line: i + 1, text: line });
      }
      return hits;
    },
  };
}

/**
 * Compile a redacted pattern into a matcher. Digests match exact literals of
 * known length — no regex, no substring-of-unknown-length (the honest scope;
 * ADR-0007). Two stages per file: a Rabin-Karp rolling hash over every
 * `length`-byte window as a prefilter, then a salted SHA-256 confirmation on
 * the rare candidates. Hits carry a location but never the matched text.
 */
export function compileDigest(pd: PatternDigest): Matcher {
  if (pd.algo !== "sha256") {
    return { ok: false, detail: `unsupported patternDigest algo "${pd.algo}"` };
  }
  if (pd.length < 1) {
    return { ok: false, detail: `patternDigest length must be >= 1, got ${pd.length}` };
  }

  // 257^(length-1) mod 2^32, for removing the window's leading byte.
  let lead = 1;
  for (let i = 1; i < pd.length; i++) lead = Math.imul(lead, RK_BASE) >>> 0;

  return {
    ok: true,
    findIn: (file, content) => {
      const bytes = Buffer.from(normalizeText(content, pd.normalize), "utf8");
      if (bytes.length < pd.length) return [];

      const hits: Hit[] = [];
      let h = rollingHash(bytes.subarray(0, pd.length));
      for (let start = 0; ; start++) {
        if (h === pd.rk) {
          const window = bytes.subarray(start, start + pd.length);
          if (saltedDigest(pd.salt, window) === pd.digest) {
            let line = 1;
            for (let i = 0; i < start; i++) if (bytes[i] === 0x0a) line++;
            hits.push({ file, line });
          }
        }
        const next = start + pd.length;
        if (next >= bytes.length) break;
        h = (Math.imul((h - Math.imul(bytes[start]!, lead)) >>> 0, RK_BASE) + bytes[next]!) >>> 0;
      }
      return hits;
    },
  };
}

/** Format hits for a `detail` string: capped at 20 locations, but the count
 * stays accurate past the cap. Hit text is never included here — callers that
 * may print matched lines (evict, without --redact) do so themselves. */
export function formatHits(hits: Hit[]): string {
  const shown = hits.slice(0, 20).map((h) => `${h.file}#L${h.line}`);
  const more = hits.length - shown.length;
  return shown.join(", ") + (more > 0 ? ` …and ${more} more` : "");
}
