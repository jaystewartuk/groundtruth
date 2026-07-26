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
]);

export const manualAssertionsFileSchema = z.object({
  $schema: z.string().optional(),
  assertions: z.array(assertionSchema).min(1),
});

export type ManualAssertionsFile = z.infer<typeof manualAssertionsFileSchema>;
