export type Tier = "free" | "pro" | "founding";

export function entitlementsFor(tier: Tier): { maxStudents: number } {
  if (tier === "free") return { maxStudents: 5 };
  return { maxStudents: Infinity };
}
