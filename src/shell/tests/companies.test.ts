import { describe, it, expect } from "vitest";

// Pure logic unit: ancestor row computation
// Mirrors the logic in insertAncestors() in src/shell/lib/actions/companies.ts
function computeAncestorRows(
  companyId: string,
  parentId: string | null,
  parentAncestorRows: { ancestorId: string; depth: number }[]
): { ancestorId: string; descendantId: string; depth: number }[] {
  const selfRow = { ancestorId: companyId, descendantId: companyId, depth: 0 };
  if (!parentId) return [selfRow];
  return [
    ...parentAncestorRows.map((r) => ({
      ancestorId: r.ancestorId,
      descendantId: companyId,
      depth: r.depth + 1,
    })),
    selfRow,
  ];
}

describe("computeAncestorRows", () => {
  it("root company: only self-reference", () => {
    const rows = computeAncestorRows("c1", null, []);
    expect(rows).toEqual([{ ancestorId: "c1", descendantId: "c1", depth: 0 }]);
  });

  it("child of root: parent ref + child self-ref", () => {
    const rows = computeAncestorRows("c2", "c1", [{ ancestorId: "c1", depth: 0 }]);
    expect(rows).toEqual([
      { ancestorId: "c1", descendantId: "c2", depth: 1 },
      { ancestorId: "c2", descendantId: "c2", depth: 0 },
    ]);
  });

  it("grandchild: gets 3 rows (grandparent, parent, self)", () => {
    const parentAncestors = [
      { ancestorId: "c1", depth: 1 },
      { ancestorId: "c2", depth: 0 },
    ];
    const rows = computeAncestorRows("c3", "c2", parentAncestors);
    expect(rows).toEqual([
      { ancestorId: "c1", descendantId: "c3", depth: 2 },
      { ancestorId: "c2", descendantId: "c3", depth: 1 },
      { ancestorId: "c3", descendantId: "c3", depth: 0 },
    ]);
  });

  it("self-reference depth is always 0", () => {
    const rows = computeAncestorRows("c5", "c4", [{ ancestorId: "c4", depth: 0 }]);
    const selfRow = rows.find((r) => r.ancestorId === "c5" && r.descendantId === "c5");
    expect(selfRow?.depth).toBe(0);
  });
});
