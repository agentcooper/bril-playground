import type * as bril from "./bril.ts";
import { copy } from "./map.ts";

type Block = bril.Instruction[];

interface Result {
  phi_args: Map<string, Map<string, [string, string][]>>;
  phi_dests: Map<string, Map<string, string | null>>;
}

export function getTypes(fn: bril.Function): Map<string, bril.Type> {
  const result = new Map<string, bril.Type>();
  for (const instruction of fn.instrs) {
    if ("dest" in instruction) {
      result.set(instruction.dest, instruction.type);
    }
  }
  return result;
}

export function insert_phis(
  blocks: Map<string, Block>,
  result: Result,
  types: Map<string, bril.Type>
) {
  for (const [blockName, block] of blocks) {
    for (const [dest, pairs] of [
      ...result.phi_args.get(blockName)!.entries(),
    ].sort((a, b) => a[0].localeCompare(b[0]))) {
      const phiInstruction: bril.Instruction = {
        op: "phi",
        dest: result.phi_dests.get(blockName)!.get(dest)!,
        type: types.get(dest)!,
        labels: pairs.map((p) => p[0]),
        args: pairs.map((p) => p[1]),
      };
      block.unshift(phiInstruction);
    }
  }
}

export function ssa_rename(
  blocks: Map<string, Block>,
  phis: Map<string, Set<string>>,
  succ: Map<string, Set<string>>,
  domtree: Map<string, Set<string>>,
  args: string[]
): Result {
  const stack = new Map<string, string[]>([[args[0], [args[0]]]]);
  const phi_args: Map<string, Map<string, [string, string][]>> = new Map();
  const phi_dests: Map<string, Map<string, string>> = new Map();
  const counters: Map<string, number> = new Map();

  function _push_fresh(varName: string): string {
    const varCount = counters.get(varName) ?? 0;
    const fresh = `${varName}.${varCount}`;
    counters.set(varName, varCount + 1);
    stack.set(varName, [fresh, ...(stack.get(varName) ?? [])]);
    return fresh;
  }

  function _rename(block: string): void {
    // console.log("Renaming", block);

    // Save stacks.
    const oldStack = copy(stack);

    // Rename phi-node destinations.
    phi_dests.set(block, new Map());
    for (const p of phis.get(block)!) {
      phi_dests.get(block)?.set(p, _push_fresh(p));
    }

    for (const instr of blocks.get(block)!) {
      // Rename arguments in normal instructions.
      if ("args" in instr) {
        const newArgs = instr.args!.map((arg) => stack.get(arg)?.[0] ?? arg);
        instr.args = newArgs;
      }

      // Rename destinations.
      if ("dest" in instr) {
        instr.dest = _push_fresh(instr.dest);
      }
    }

    // Rename phi-node arguments (in successors).
    if (!phi_args.has(block)) {
      phi_args.set(block, new Map());
    }

    for (const s of succ.get(block)!) {
      if (!phi_args.has(s)) {
        phi_args.set(s, new Map());
      }
      for (const p of phis.get(s) ?? []) {
        const val = stack.get(p)?.[0] ?? "__undefined";

        const v = [
          ...(phi_args.get(s)!.get(p) ?? []),
          [block, val] as [string, string],
        ];

        phi_args.get(s)?.set(p, v);
      }
    }

    // Recursive calls.
    for (const b of [...domtree.get(block)!].sort()) {
      _rename(b);
    }

    // Restore stacks.
    stack.clear();
    oldStack.forEach((v, k) => stack.set(k, v));
  }

  const entry = Array.from(blocks.keys())[0];
  _rename(entry);

  return { phi_args, phi_dests };
}
