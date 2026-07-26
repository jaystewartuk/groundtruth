import { existsSync } from "node:fs";
import { join } from "node:path";

// Candidate agent-context files, in the order most tools check them. This is
// purely informational for the MVP (a header line telling the operator what
// context layer groundtruth found) — assertions are still hand-authored in
// .groundtruth.jsonc until LLM extraction lands, so discovery does not yet
// drive what gets checked.
const CONTEXT_FILE_CANDIDATES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursor/rules",
  ".github/copilot-instructions.md",
];

export function discoverContextFiles(repoRoot: string): string[] {
  return CONTEXT_FILE_CANDIDATES.filter((f) => existsSync(join(repoRoot, f)));
}
