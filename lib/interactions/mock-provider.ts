import { listInteractionPairs } from "@/lib/database/interactions";
import { normalizeMedicineName } from "./normalize";
import type { InteractionFinding, InteractionProvider } from "./types";

/**
 * Demo interaction checker. It reads the DrugInteraction table, which is seeded with a clearly
 * labelled mock dataset (source = "mock-demo-dataset"). The result is never a verified clinical fact.
 */
export class MockInteractionProvider implements InteractionProvider {
  readonly name = "mock-demo-dataset";

  async checkPairs(medicineNames: string[]): Promise<InteractionFinding[]> {
    const normalized = [...new Set(medicineNames.map(normalizeMedicineName).filter(Boolean))];
    if (normalized.length < 2) return [];

    const rules = await listInteractionPairs();
    const findings: InteractionFinding[] = [];
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const a = normalized[i] ?? "";
        const b = normalized[j] ?? "";
        const [low, high] = a < b ? [a, b] : [b, a];
        const rule = rules.find((item) => item.medicineA === low && item.medicineB === high);
        if (rule) {
          findings.push({
            medicineA: rule.medicineA,
            medicineB: rule.medicineB,
            severity: "potential",
            description: rule.description,
            source: rule.source,
          });
        }
      }
    }
    return findings;
  }
}
