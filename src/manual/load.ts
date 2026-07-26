import { readFileSync } from "node:fs";
import { parse as parseJsonc } from "jsonc-parser";
import { manualAssertionsFileSchema } from "./schema.js";
import type { Assertion } from "../types.js";

export class ManualAssertionsError extends Error {}

/** Load and validate a .groundtruth.jsonc file. Throws with a precise
 * message on malformed JSONC or a schema violation — a bad assertions file
 * should fail loudly, not silently check nothing. */
export function loadManualAssertions(filePath: string): Assertion[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ManualAssertionsError(
      `could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const errors: import("jsonc-parser").ParseError[] = [];
  const parsed = parseJsonc(raw, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new ManualAssertionsError(
      `${filePath} is not valid JSONC (offset ${errors[0]?.offset}, error code ${errors[0]?.error})`,
    );
  }

  const result = manualAssertionsFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ManualAssertionsError(
      `${filePath} failed schema validation:\n${result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }

  return result.data.assertions;
}
