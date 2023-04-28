// bril2json < public/condition.bril | deno run cli.ts

import type * as bril from "./src/bril.ts";
import { CFG } from "./src/cfg.ts";
import { stringify } from "./src/dot.ts";

const stdin = new TextDecoder().decode(await Deno.readAll(Deno.stdin));

const program = JSON.parse(stdin) as bril.Program;

for (const fn of program.functions) {
  const cfg = new CFG(fn);

  cfg.addSSA();

  console.log(
    cfg
      .reassemble()
      .map((p) => stringify(p))
      .join("\n")
  );
}
