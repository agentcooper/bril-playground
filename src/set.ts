export function intersect<T>(sets: Array<Set<T>>): Set<T> {
  if (sets.length === 0) {
    return new Set<T>();
  }

  const result = new Set<T>(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    const currentSet = sets[i];
    for (const item of result) {
      if (!currentSet.has(item)) {
        result.delete(item);
      }
    }
  }

  return result;
}

export function map<T, K>(set: Set<T>, fn: (input: T) => K): Set<K> {
  const result = new Set<K>();
  for (const value of set.values()) {
    result.add(fn(value));
  }
  return result;
}

export function filter<T>(set: Set<T>, fn: (input: T) => boolean): Set<T> {
  const result = new Set<T>();
  for (const value of set.values()) {
    if (fn(value)) {
      result.add(value);
    }
  }
  return result;
}

export function equal(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }

  return true;
}
