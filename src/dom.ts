import { invert } from "./map.ts";

export function dominatorTree(
  dom: Map<string, Set<string>>
): Map<string, Set<string>> {
  const dom_inv = invert(dom);
  const dom_inv_strict = new Map<string, Set<string>>();
  for (const [a, bs] of dom_inv.entries()) {
    const strictBs = new Set(bs);
    strictBs.delete(a);
    dom_inv_strict.set(a, strictBs);
  }

  const dom_inv_strict_2x = new Map<string, Set<string>>();
  for (const [a, bs] of dom_inv_strict.entries()) {
    const resultBs = new Set<string>();
    for (const b of bs) {
      for (const bb of dom_inv_strict.get(b)!) {
        resultBs.add(bb);
      }
    }
    dom_inv_strict_2x.set(a, resultBs);
  }

  const result = new Map<string, Set<string>>();
  for (const [a, bs] of dom_inv_strict.entries()) {
    const resultBs = new Set<string>();
    for (const b of bs) {
      if (!dom_inv_strict_2x.get(a)!.has(b)) {
        resultBs.add(b);
      }
    }
    result.set(a, resultBs);
  }
  return result;
}
