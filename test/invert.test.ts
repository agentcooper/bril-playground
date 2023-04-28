import { expect, test } from "vitest";
import { invert } from "../src/map";

test("invert", () => {
  const map = new Map([["a", new Set(["b", "c"])]]);
  expect(invert(map)).toEqual(
    new Map([
      ["b", new Set(["a"])],
      ["c", new Set(["a"])],
    ])
  );
});
