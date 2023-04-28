export function invert<T>(map: Map<T, Set<T>>): Map<T, Set<T>> {
  const result = new Map<T, Set<T>>();
  for (const [key, value] of map.entries()) {
    for (const v of value) {
      if (!result.has(v)) {
        result.set(v, new Set());
      }
      result.get(v)!.add(key);
    }
  }
  return result;
}

export function getWithDefault<K, V>(map: Map<K, V>, key: K, fn: () => V): V {
  if (!map.has(key)) {
    map.set(key, fn());
  }
  return map.get(key)!;
}

export function copy<K, V>(input: Map<K, V[]>): Map<K, V[]> {
  const copy = new Map<K, V[]>();
  for (const [key, value] of input.entries()) {
    copy.set(key, [...value]);
  }
  return copy;
}
