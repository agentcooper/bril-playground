import * as d3 from "d3";
import { graphviz } from "d3-graphviz";
import { EditorView, basicSetup } from "codemirror";

import { CFG } from "./cfg.ts";
import { buildDot } from "./dot.ts";
import { parse } from "./parse";
import { Program } from "./bril";
import { evalProg } from "./interpreter.ts";
import { invert } from "./map.ts";

enum Hover {
  dominators,
  dominatedBy,
  frontiers,
}

interface State {
  convertToSSA: boolean;
  current?: string;
  hover: Set<string>;
  cfgName: string;
  cfg?: CFG;
  dominators: Map<string, Set<string>>;
  dominatedBy: Map<string, Set<string>>;
  frontiers: Map<string, Set<string>>;
  onHover: Hover;
}

const state: State = {
  convertToSSA: false,
  current: undefined,
  hover: new Set(),
  cfgName: "main",
  cfg: undefined,
  dominators: new Map(),
  dominatedBy: new Map(),
  frontiers: new Map(),
  onHover: Hover.dominators,
};

function compute() {
  const source = editor.state.doc.toString();
  const program: Program = parse(source);

  const fn =
    program.functions.find((f) => f.name === state.cfgName) ??
    program.functions[0];
  const cfg = new CFG(fn);

  if (state.convertToSSA) {
    cfg.addSSA();
  }

  state.cfg = cfg;
  state.dominators = cfg.computeDominators();
  state.dominatedBy = invert(state.dominators);
  state.frontiers = cfg.computeDominatorFrontiers();
}

function render() {
  compute();

  if (!state.cfg) {
    return;
  }

  const dot = buildDot(state.cfg, state.hover, state.current);

  graphviz("#graph", {
    useWorker: false, // could not figure out the proper way to use worker with Vite
  })
    .zoom(false)
    .renderDot(dot)
    .on("end", interactive);
}

function onHover(blockName: string): Set<string> {
  switch (state.onHover) {
    case Hover.dominators:
      return state.dominators.get(blockName)!;
    case Hover.dominatedBy:
      return state.dominatedBy.get(blockName)!;
    case Hover.frontiers:
      return state.frontiers.get(blockName)!;
  }
}

function interactive() {
  d3.selectAll(".node")
    .on("mouseover", (_event, data) => {
      const blockName: string = (data as unknown as { key: string }).key;
      state.current = blockName;
      state.hover = onHover(blockName);
      render();
    })
    .on("mouseout", () => {
      state.current = undefined;
      state.hover = new Set();
      render();
    });
}

const sourceSelect = document.getElementById("source-select")!;

let updateListenerExtension = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    render();
  }
});

let editor = new EditorView({
  extensions: [basicSetup, updateListenerExtension],
  parent: document.getElementById("editor")!,
});

sourceSelect.addEventListener(
  "change",
  async (event) => {
    state.cfgName = "main";
    const fileName = (event.target as HTMLSelectElement).value;
    const url = `${fileName}`;
    const res = await fetch(url);
    const text = await res.text();
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: text,
      },
    });
  },
  false
);

document
  .getElementById("ssa-checkbox")!
  .addEventListener("change", async (event) => {
    state.convertToSSA = (event.target as HTMLInputElement).checked;
    render();
  });

document
  .getElementById("cfg-function-name")!
  .addEventListener("input", async (event) => {
    state.cfgName = (event.target as HTMLInputElement).value;
    render();
  });

function toHover(input: string): Hover {
  switch (input) {
    case "dominators":
      return Hover.dominators;
    case "dominatedBy":
      return Hover.dominatedBy;
    case "frontiers":
      return Hover.frontiers;
    default:
      throw new Error(`Unknown value: ${input}`);
  }
}

document.getElementById("on-hover-select")!.addEventListener(
  "change",
  async (event) => {
    state.onHover = toHover((event.target as HTMLSelectElement).value);
    render();
  },
  false
);

function getRunArguments() {
  const node = document.getElementById(
    "run-arguments-input"
  ) as HTMLInputElement;

  if (!node.value) {
    return [];
  }

  return node.value.split(",");
}

document.getElementById("run-button")!.addEventListener("click", async () => {
  const source = editor.state.doc.toString();
  const program: Program = parse(source);
  evalProg(program, getRunArguments(), false);
});

setTimeout(() => {
  sourceSelect.dispatchEvent(new Event("change"));
}, 0);
