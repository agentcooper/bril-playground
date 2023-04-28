export function postOrder(
  successors: Map<string, Set<string>>,
  entry: string
): string[] {
  const out: string[] = [];
  const explored = new Set<string>();

  function helper(root: string) {
    if (explored.has(root)) {
      return;
    }
    explored.add(root);
    for (const successor of successors.get(root)!) {
      helper(successor);
    }
    out.push(root);
  }

  helper(entry);

  return out;
}
