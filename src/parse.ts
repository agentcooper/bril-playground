// @ts-nocheck

// ./generated/bril-parser.js is generated from ./bril.lark using https://github.com/larkjs/lark
import { Program } from "./bril.js";
import { get_parser, Token } from "./generated/bril-parser.js";

Token.prototype.toString = function () {
  return this.value;
};

const _pos = (token) => ({
  line: token.line,
  column: token.column,
});

let transformer = {
  start(items) {
    var structs = items.filter((i) => "mbrs" in i);
    var funcs = items.filter((i) => !("mbrs" in i));
    if (structs.length > 0) {
      return {
        structs: structs,
        functions: funcs,
      };
    } else {
      return {
        functions: funcs,
      };
    }
  },

  func(items) {
    const [name, args, typ] = items;

    const instrs = items.filter(
      (i) => typeof i === "object" && ("op" in i || "label" in i)
    );

    const func = {
      name: name.toString().slice(1), // Strip `@`.
      instrs: instrs,
    };
    if (args.length > 0) {
      func.args = args;
    }
    if (typeof typ === "string") {
      func.type = typ;
    }
    if (this.include_pos) {
      func.pos = _pos(name);
    }
    return func;
  },

  arg(items) {
    const [name, typ] = items;
    return {
      name: name.toString(),
      type: typ,
    };
  },

  struct(items) {
    const [_, name, ...mbrs] = items;
    return {
      name: name,
      mbrs: mbrs,
    };
  },

  mbr(items) {
    const [name, typ] = items;
    return {
      name: name,
      type: typ,
    };
  },

  arg_list(items) {
    return items;
  },

  const(items) {
    const [dest, type, val] = items;
    const out = {
      op: "const",
      dest: dest.toString(),
      value: val,
    };
    if (type) {
      out.type = type;
    }
    if (this.include_pos) {
      out.pos = _pos(dest);
    }
    return out;
  },

  vop(items) {
    const [dest, type, op] = items;
    const out = { dest: dest.toString() };
    if (type) {
      out.type = type;
    }
    Object.assign(out, op);
    if (this.include_pos) {
      out.pos = _pos(dest);
    }
    return out;
  },

  op(items) {
    const op_token = items.shift();
    const opcode = op_token.toString();

    const funcs = [];
    const labels = [];
    const args = [];
    for (const item of items) {
      if (item.type === "FUNC") {
        funcs.push(item.toString().slice(1));
      } else if (item.type === "LABEL") {
        labels.push(item.toString().slice(1));
      } else {
        args.push(item.toString());
      }
    }

    const out = { op: opcode };
    if (args.length) {
      out.args = args;
    }
    if (funcs.length) {
      out.funcs = funcs;
    }
    if (labels.length) {
      out.labels = labels;
    }
    if (this.include_pos) {
      out.pos = _pos(op_token);
    }
    return out;
  },

  eop(items) {
    const [op] = items;
    return op;
  },

  label(items) {
    const name = items[0];
    const out = { label: String(name).slice(1) }; // Strip `.`.
    if (this.include_pos) {
      out.pos = _pos(name);
    }
    return out;
  },

  int(items) {
    return parseInt(String(items[0]));
  },

  bool(items) {
    if (String(items[0]) === "true") {
      return true;
    } else {
      return false;
    }
  },

  paramtype(items) {
    return { [items[0]]: items[1] };
  },

  primtype(items) {
    return String(items[0]);
  },

  float(items) {
    return parseFloat(items[0]);
  },

  nullptr(items) {
    return 0;
  },
};

const parser = get_parser({ transformer });

export function parse(input: string): Program {
  return parser.parse(input);
}
