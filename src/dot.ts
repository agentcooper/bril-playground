import { Instruction } from "./bril.ts";
import type { CFG } from "./cfg.ts";

function stringifyOptions(...args: { [key: string]: string }[]) {
  const result = {};
  for (const arg of args) {
    Object.assign(result, arg);
  }
  return (
    "[" +
    Object.entries(result)
      .filter(([_, value]) => Boolean(value))
      .map(([key, value]) => `${key}="${value}"`)
      .join(", ") +
    "]"
  );
}

function getLabel(block: Instruction[]): string {
  return block.map((instruction) => `${stringify(instruction)}\\l`).join("");
}

export function buildDot(cfg: CFG, highlight: Set<string>, current?: string) {
  let nodes = "";
  let edges = "";

  for (const blockName of cfg.blocks.keys()) {
    const block = cfg.getBlockByName(blockName);

    const options = stringifyOptions(
      {
        shape: "box",
        xlabel: blockName,
        label: getLabel(block),
      },
      highlight.has(blockName)
        ? { style: "filled", fillcolor: "aquamarine" }
        : {},
      current === blockName ? { color: "#6c6c6c" } : {}
    );

    nodes += `  "${blockName}" ${options};\n`;

    for (const successorName of cfg.getBlockSuccessors(block)) {
      edges += `  "${blockName}" -> "${successorName}";\n`;
    }
  }

  return `
  digraph main {
    node [style="filled", fillcolor="#cceeff44", fontname = "courier", fontsize="10", color="#dddddd"]
    edge [color="#6c6c6c"]
  ${nodes.trimEnd()}
  
  ${edges.trimEnd()}
  }
      `;
}

export function stringify(instr: any): string {
  if (instr.op === "const") {
    const tyann = instr.type ? `: ${type_to_str(instr.type)}` : "";
    return `${instr.dest ?? ""}${tyann} = const ${
      instr.value?.toString().toLowerCase() ?? ""
    }`;
  } else {
    let rhs = instr.op;
    if (instr.funcs?.length) {
      rhs += ` ${instr.funcs.map((f: any) => `@${f}`).join(" ")}`;
    }
    if (instr.args?.length) {
      rhs += ` ${instr.args.join(" ")}`;
    }
    if (instr.labels?.length) {
      rhs += ` ${instr.labels.map((l: any) => `.${l}`).join(" ")}`;
    }
    if (instr.dest) {
      const tyann = instr.type ? `: ${type_to_str(instr.type)}` : "";
      return `${instr.dest}${tyann} = ${rhs}`;
    } else {
      return rhs;
    }
  }
}

function type_to_str(type: any): string {
  if (typeof type === "object" && type !== null) {
    const [key, value] = Object.entries(type)[0];
    return `${key}<${type_to_str(value)}>`;
  } else {
    return type.toString();
  }
}
