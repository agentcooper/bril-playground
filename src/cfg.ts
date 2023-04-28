import type * as bril from "./bril.ts";

import { dominatorTree } from "./dom.ts";
import { postOrder } from "./graph.ts";
import { getWithDefault, invert } from "./map.ts";
import { equal, filter, intersect, map } from "./set.ts";
import { getTypes, insert_phis, ssa_rename } from "./ssa.ts";

type Block = bril.Instruction[];

const terminators = new Set(["br", "jmp", "ret"]);

function isTerminator(instr: bril.Instruction) {
  return terminators.has(instr.op);
}

function isLabel(instr: bril.Instruction | bril.Label): instr is bril.Label {
  return "label" in instr;
}

function lastInstruction(block: Block) {
  return block[block.length - 1];
}

export class CFG {
  fn: bril.Function;
  blocks: Map<string, Block>;

  constructor(fn: bril.Function) {
    const blocks = this.getBasicBlocks(fn);
    const map = new Map<string, Block>();
    for (let block of blocks) {
      let name: string;
      const [firstInstruction, ...rest] = block;
      if (isLabel(firstInstruction)) {
        name = firstInstruction.label;
        block = rest;
      } else {
        name = this.generateName(`bb`, new Set(map.keys()));
      }
      map.set(name, block as Block);
    }
    this.blocks = map;
    this.addEntry();
    this.addTerminators();
    this.fn = fn;
  }

  private getBasicBlocks(fn: bril.Function) {
    let currentBlock: Array<bril.Instruction | bril.Label> = [];
    const blocks: Array<typeof currentBlock> = [];
    for (const instruction of fn.instrs) {
      if (isLabel(instruction)) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = [instruction];
      } else {
        currentBlock.push(instruction);
        if (isTerminator(instruction)) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }
    return blocks;
  }

  getBlockSuccessors(block: bril.Instruction[]): Set<string> {
    return this.getSuccessors(lastInstruction(block));
  }

  getSuccessors(instruction: bril.Instruction): Set<string> {
    if (instruction.op === "br" || instruction.op === "jmp") {
      return new Set(instruction.labels);
    }
    return new Set();
  }

  getBlockByName(name: string): Block {
    return this.blocks.get(name)!;
  }

  getEdges(): [Map<string, Set<string>>, Map<string, Set<string>>] {
    const successors = new Map<string, Set<string>>();
    const predecessors = new Map<string, Set<string>>();
    for (const blockName of this.blocks.keys()) {
      successors.set(blockName, new Set());
      predecessors.set(blockName, new Set());
    }
    for (const [blockName, block] of this.blocks.entries()) {
      for (const successorName of this.getBlockSuccessors(block)) {
        successors.get(blockName)!.add(successorName);
        predecessors.get(successorName)!.add(blockName);
      }
    }
    return [successors, predecessors];
  }

  reassemble(): (bril.Instruction | bril.Label)[] {
    const instructions: (bril.Instruction | bril.Label)[] = [];
    for (const [blockName, block] of this.blocks.entries()) {
      instructions.push({ label: blockName });
      for (const instruction of block) {
        instructions.push(instruction);
      }
    }
    return instructions;
  }

  getPhis(): Map<string, Set<string>> {
    const df = this.computeDominatorFrontiers();
    const defs = this.computeDefinitions();
    const phis = new Map<string, Set<string>>();
    for (const blockName of this.blocks.keys()) {
      phis.set(blockName, new Set());
    }
    for (const [v, definitionBlocks] of defs) {
      const defBloks = [...new Set(definitionBlocks)];
      for (const def of defBloks) {
        for (const b of df.get(def)!) {
          if (!phis.get(b)!.has(v)) {
            phis.get(b)!.add(v);
            if (!defBloks.includes(b)) {
              defBloks.push(b);
            }
          }
        }
      }
    }
    return phis;
  }

  computeDefinitions(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const [blockName, block] of this.blocks.entries()) {
      for (const instruction of block) {
        if ("dest" in instruction) {
          getWithDefault(result, instruction.dest, () => new Set()).add(
            blockName
          );
        }
      }
    }
    return result;
  }

  /**
   * Block A dominates block B if every path from entry block to block B includes A.
   *
   * Means that A must always execute before B.
   *
   * @returns Map of dominators for each block.
   */
  computeDominators(): Map<string, Set<string>> {
    const entry = [...this.blocks.keys()][0];
    const [successors, predecessors] = this.getEdges();
    const dom = new Map<string, Set<string>>();
    for (const blockName of this.blocks.keys()) {
      dom.set(blockName, new Set(this.blocks.keys()));
    }
    const reversePostOrder = [...postOrder(successors, entry)].reverse();
    while (true) {
      let changed = false;
      for (const blockName of reversePostOrder) {
        const newDom = intersect(
          Array.from(map(predecessors.get(blockName)!, (p) => dom.get(p)!))
        );
        newDom.add(blockName);
        if (!equal(dom.get(blockName)!, newDom)) {
          dom.set(blockName, newDom);
          changed = true;
        }
      }
      if (!changed) {
        break;
      }
    }
    return dom;
  }

  computeDominatorFrontiers(): Map<string, Set<string>> {
    const [successors] = this.getEdges();
    const dominatedBy = this.computeDominators();
    const dominates = invert(dominatedBy);
    const frontiers = new Map<string, Set<string>>();
    for (const block of this.blocks.keys()) {
      frontiers.set(block, new Set());
    }
    for (const block of dominatedBy.keys()) {
      const dominated_succs = new Set<string>();
      for (const domi of dominates.get(block)!) {
        for (const s of successors.get(domi)!) {
          dominated_succs.add(s);
        }
      }
      frontiers.set(
        block,
        filter(
          dominated_succs,
          (k) => !dominates.get(block)!.has(k) || k === block
        )
      );
    }
    return frontiers;
  }

  addEntry(): void {
    const firstLabel = [...this.blocks.keys()][0];
    let found = false;
    for (const block of this.blocks.values()) {
      for (const instruction of block) {
        if (
          "labels" in instruction &&
          instruction.labels?.includes(firstLabel)
        ) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return;
    }
    const entry = this.generateName(`entry`, new Set(this.blocks.keys()));
    // reinsert keys so that entry comes first
    const copy = new Map(this.blocks);
    this.blocks.clear();
    this.blocks.set(entry, []);
    for (const [key, value] of copy) {
      this.blocks.set(key, value);
    }
  }

  addTerminators(): void {
    const blockNames = [...this.blocks.keys()];
    for (let i = 0; i < blockNames.length; i++) {
      const isLast = i == blockNames.length - 1;
      const blockName = blockNames[i];
      const block = this.blocks.get(blockName)!;
      if (block.length === 0 || !isTerminator(lastInstruction(block))) {
        if (isLast) {
          block.push({ op: "ret", args: [] });
        } else {
          block.push({ op: "jmp", labels: [blockNames[i + 1]] });
        }
      }
    }
  }

  addSSA(): void {
    const domTree = dominatorTree(this.computeDominators());
    const phis = this.getPhis();
    const [successors] = this.getEdges();
    const arg_names = (this.fn.args ?? []).map((arg) => arg.name);
    const ssa_result = ssa_rename(
      this.blocks,
      phis,
      successors,
      domTree,
      arg_names
    );
    insert_phis(this.blocks, ssa_result, getTypes(this.fn));
  }

  private generateName(prefix: string, usedNames: Set<string>): string {
    let counter = 1;
    while (true) {
      const candidate = `${prefix}${counter}`;
      if (!usedNames.has(candidate)) {
        return candidate;
      }
      counter += 1;
    }
  }
}
