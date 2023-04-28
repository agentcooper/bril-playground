import { expect, test } from "vitest";
import { readFileSync } from "fs";
import * as path from "path";
import { parse } from "../src/parse";

test("parse", () => {
  const a = readFileSync(
    path.join(__dirname, "../public/condition.bril")
  ).toString();

  expect(parse(a)).toMatchSnapshot();
});
