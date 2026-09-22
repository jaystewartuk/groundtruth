import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AssertionStatus, WorkflowTriggerArgs } from "../types.js";

// YAML 1.1 famously turns a bare `on:` key into the boolean `true` (the
// classic "Norway problem"). The `yaml` package parses YAML 1.2 by default,
// which does not have this footgun — but we check every alias anyway so a
// future parser change or an oddly-authored workflow file can't silently
// turn this into "no trigger found".
function getOnBlock(doc: unknown): unknown {
  if (!doc || typeof doc !== "object") return undefined;
  const obj = doc as Record<PropertyKey, unknown>;
  return obj.on ?? obj["on"] ?? obj[true as unknown as string] ?? obj["true"];
}

function triggerConfig(onBlock: unknown, trigger: string): { present: boolean; config: unknown } {
  if (typeof onBlock === "string") return { present: onBlock === trigger, config: undefined };
  if (Array.isArray(onBlock)) return { present: onBlock.includes(trigger), config: undefined };
  if (onBlock && typeof onBlock === "object") {
    const obj = onBlock as Record<string, unknown>;
    return { present: trigger in obj, config: obj[trigger] };
  }
  return { present: false, config: undefined };
}

function branchesInclude(config: unknown, target: string): boolean {
  if (!config || typeof config !== "object") return true; // no branch restriction = runs everywhere
  const branches = (config as Record<string, unknown>).branches;
  if (branches === undefined) return true; // no `branches:` key = runs on every branch
  if (typeof branches === "string") return branches === target;
  if (Array.isArray(branches)) return branches.includes(target);
  return true;
}

export function checkWorkflowTrigger(
  repoRoot: string,
  args: WorkflowTriggerArgs,
): { status: AssertionStatus; detail: string } {
  const workflowPath = join(repoRoot, ".github", "workflows", args.workflow);
  if (!existsSync(workflowPath)) {
    return { status: "failing", detail: `.github/workflows/${args.workflow} does not exist` };
  }

  let doc: unknown;
  try {
    doc = parseYaml(readFileSync(workflowPath, "utf8"));
  } catch (err) {
    return {
      status: "unverifiable",
      detail: `.github/workflows/${args.workflow} is not valid YAML: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const onBlock = getOnBlock(doc);
  if (onBlock === undefined) {
    return { status: "failing", detail: `${args.workflow} has no top-level 'on:' trigger block` };
  }

  const { present, config } = triggerConfig(onBlock, args.trigger);
  if (!present) {
    return { status: "failing", detail: `${args.workflow} does not trigger on '${args.trigger}'` };
  }

  if (args.target && !branchesInclude(config, args.target)) {
    return {
      status: "failing",
      detail: `${args.workflow} triggers on '${args.trigger}' but not for branch '${args.target}'`,
    };
  }

  return {
    status: "passing",
    detail: `${args.workflow} triggers on '${args.trigger}'${args.target ? ` (branch '${args.target}')` : ""}`,
  };
}
