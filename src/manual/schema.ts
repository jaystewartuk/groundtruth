import { z } from "zod";

// Validates a hand-authored .groundtruth.jsonc file. This is the interim
// input format until LLM extraction exists — each entry has exactly the
// shape extraction will need to produce later ({ claim, kind, args, source }),
// so nothing here is throwaway once extraction lands.

const pathArgs = z.object({ path: z.string().min(1) });

const envVarAbsentArgs = z.object({
  name: z.string().min(1),
  files: z.array(z.string().min(1)).optional(),
});

const scriptExistsArgs = z.object({
  name: z.string().min(1),
  packageJson: z.string().min(1).optional(),
});

const workflowTriggerArgs = z.object({
  workflow: z.string().min(1),
  trigger: z.string().min(1),
  target: z.string().min(1).optional(),
});

const symbolAtPathArgs = z.object({
  symbol: z.string().min(1),
  path: z.string().min(1),
});

const textPresentArgs = z.object({
  pattern: z.string().min(1),
  patternType: z.enum(["literal", "regex"]).optional(),
  caseInsensitive: z.boolean().optional(),
  path: z.string().min(1),
});

const patternDigest = z.object({
  algo: z.literal("sha256"),
  salt: z.string().min(1),
  digest: z.string().regex(/^[0-9a-f]{64}$/, "must be a lowercase hex sha256 digest"),
  rk: z.number().int().min(0).max(0xffffffff),
  length: z.number().int().min(1),
  normalize: z.enum(["lower", "exact"]),
});

const textAbsentArgs = z
  .object({
    pattern: z.string().min(1).optional(),
    patternType: z.enum(["literal", "regex"]).optional(),
    caseInsensitive: z.boolean().optional(),
    patternDigest: patternDigest.optional(),
    label: z.string().min(1).optional(),
    files: z.array(z.string().min(1)).optional(),
    include: z.array(z.string().min(1)).optional(),
    exclude: z.array(z.string().min(1)).optional(),
  })
  .refine((args) => (args.pattern === undefined) !== (args.patternDigest === undefined), {
    message: "exactly one of `pattern` and `patternDigest` must be set",
  })
  .refine((args) => !(args.patternDigest && args.label === undefined), {
    message: "`label` is required with `patternDigest` — it is the report's only handle for the redacted fact",
  })
  .refine((args) => !(args.patternDigest && (args.patternType || args.caseInsensitive !== undefined)), {
    message:
      "`patternType`/`caseInsensitive` do not apply to `patternDigest` — digests match exact literals; matching is baked in at authoring time via `normalize`",
  })
  .refine((args) => !(args.files && args.include), {
    message: "`files` and `include` are mutually exclusive — list exact files or scope by glob, not both",
  });

const base = {
  claim: z.string().min(1),
  source: z.string().min(1),
};

export const assertionSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("path_exists"), args: pathArgs }),
  z.object({ ...base, kind: z.literal("path_absent"), args: pathArgs }),
  z.object({ ...base, kind: z.literal("env_var_absent"), args: envVarAbsentArgs }),
  z.object({ ...base, kind: z.literal("script_exists"), args: scriptExistsArgs }),
  z.object({ ...base, kind: z.literal("workflow_trigger"), args: workflowTriggerArgs }),
  z.object({ ...base, kind: z.literal("symbol_at_path"), args: symbolAtPathArgs }),
  z.object({ ...base, kind: z.literal("text_present"), args: textPresentArgs }),
  z.object({ ...base, kind: z.literal("text_absent"), args: textAbsentArgs }),
]);

export const manualAssertionsFileSchema = z.object({
  $schema: z.string().optional(),
  assertions: z.array(assertionSchema).min(1),
});

export type ManualAssertionsFile = z.infer<typeof manualAssertionsFileSchema>;
