import { randomBytes } from "node:crypto";
import { buildPatternDigest } from "./assertions/text-match.js";

// `groundtruth digest` — the authoring helper for redacted text_absent
// patterns. Nobody hand-computes a salted digest. The literal is read from
// stdin, never argv: argv lands in shell history, which is itself a context
// surface the fact is supposed to leave. The plaintext exists only in this
// process's memory. See ADR-0007.

/** Read all of stdin. Exposed for the evict command too. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** A trailing newline is the shell's (echo, heredoc, an editor's final
 * newline), not the fact's — strip it so the digest matches the fact alone. */
export function trimTrailingNewlines(text: string): string {
  return text.replace(/(?:\r?\n)+$/, "");
}

export async function runDigest(argv: string[]): Promise<number> {
  let normalize: "lower" | "exact" = "lower";
  for (const arg of argv) {
    if (arg === "--exact") normalize = "exact";
    else if (arg !== "--stdin") {
      process.stderr.write(`Unknown option "${arg}" for groundtruth digest.\n`);
      return 2;
    }
  }

  if (process.stdin.isTTY) {
    process.stderr.write("Enter the literal to digest, then press Enter and Ctrl-D:\n");
  }
  const literal = trimTrailingNewlines(await readStdin());
  if (literal.length === 0) {
    process.stderr.write("Nothing to digest — pipe or type the literal on stdin.\n");
    return 2;
  }

  const digest = buildPatternDigest(literal, randomBytes(16).toString("hex"), normalize);
  process.stdout.write(`${JSON.stringify({ patternDigest: digest }, null, 2)}\n`);
  process.stderr.write(
    "Paste this into a text_absent assertion's args, and add a `label` — it is\n" +
      "required with patternDigest, and it's the only handle failure reports get.\n",
  );
  return 0;
}
