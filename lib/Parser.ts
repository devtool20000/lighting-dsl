const WHITESPACE_CHARS = new Set([" ", "\t"]);
const MATCH_EXPAND_NAME_PATTEN = /^([a-zA-Z0-9\-]+)?/;

const DEFAULT_DELIMITERS = [".", ":", "@"];
export const DEFAULT_OPTIONS: ParseOptions = {
  childrenStart: "{",
  childrenEnd: "}",
  quoteStart: "`",
  quoteEnd: "`",
  delimiters: DEFAULT_DELIMITERS,
};

export type Replacer =
  | string
  | string[]
  | ((value: string) => string | string[]);

export type NameReplacer = string | ((value: string) => string);
export type ArgApplyFn = (arg: Arg) => void;
export type ArgSelectorFn = (arg: Arg) => boolean;
export type ArgSelector = ArgSelectorFn | string;

export function parse(text: string, options: Partial<ParseOptions> = {}): Node {
  options.childrenStart = options.childrenStart || "{";
  options.childrenEnd = options.childrenEnd || "}";
  options.quoteStart = options.quoteStart || "`";
  options.quoteEnd = options.quoteEnd || "`";
  options.delimiters = DEFAULT_DELIMITERS;
  const result = Node.fromText(text, true, options as ParseOptions);
  _recursiveUpdateParentToArg(result);
  return result;
}

export function _recursiveUpdateParentToArg(node: Node): Node {
  if (node.isNested) {
    for (const child of node.children) {
      if (!child.isNested) {
        child.arg.parent = node;
      } else {
        _recursiveUpdateParentToArg(child);
      }
    }
  }

  return node;
}

export function parseOne(
  text: string,
  options: Partial<ParseOptions> = {}
): Node {
  return Node.fromText(text, false, options as ParseOptions);
}

export interface ParseOptions {
  childrenStart: string;
  childrenEnd: string;
  quoteStart: string;
  quoteEnd: string;
  delimiters: string[];
}

// concat nodes to merge into a new node
// for nested nodes, it will spread and merge together so concat("a", "b c", "d") will return "a b c d"
export function concat(...nodes: (string | Node)[]): Node {
  let options = DEFAULT_OPTIONS;
  for (const node of nodes) {
    if (node instanceof Node) {
      options = node.options;
    }
  }
  const compiledNodes = nodes.map((node) => {
    if (typeof node === "string") {
      return parse(node, options);
    } else if (node instanceof Node) {
      return node;
    } else {
      throw new Error("node can only accept string and Node");
    }
  });
  const result = Node.fromParameters(null, [], true, options);
  for (const node of compiledNodes) {
    if (node.isNested) {
      result.push(...node.children);
    } else {
      result.push(node);
    }
  }
  return _recursiveUpdateParentToArg(result);
}

export class Node {
  private _children: Node[] = [];
  private _arg: Arg | null = null;

  public isNested!: boolean;
  public options!: ParseOptions;

  get text(): string {
    if (this.isNested) {
      return this._children
        .map((child) => (child.isNested ? `{${child.text}}` : child.text))
        .join(" ");
    } else {
      return this._arg!.toText();
    }
  }

  constructor() {}

  static fromText(
    text: string,
    isNested: boolean,
    options: ParseOptions
  ): Node {
    const node = new Node();
    node.isNested = isNested;
    node.options = options;

    if (isNested) {
      const parser = new NodeParser(options, text);
      node._children = parser.parse();
    } else {
      node._arg = node._parseArg(text, node.options.delimiters);
    }

    return node;
  }

  static fromParameters(
    arg: Arg | null,
    children: Node[],
    isNested: boolean,
    options: ParseOptions,
    isClone:boolean = true
  ): Node {
    const node = new Node();
    node.isNested = isNested;
    node.options = options;

    if (isNested) {
      node._children = children.map((node) => isClone ? node.clone() : node);
    } else {
      node._arg = arg ? (isClone ? arg.clone() : arg) : null;
    }
    return node;
  }

  get children(): Node[] {
    if (!this.isNested) {
      throw new Error(`'${this.text}' has no children`);
    }
    return this._children;
  }

  get arg(): Arg {
    if (this.isNested) {
      throw new Error(`'${this.text}' has children`);
    }
    return this._arg!;
  }

  private _parseArg(
    text: string,
    delimiters: string[] = DEFAULT_DELIMITERS
  ): Arg {
    if (this.isNested) {
      throw new Error(`'${this.text}' has children`);
    }
    const arg = new ArgParser(text, {
      ...this.options,
      delimiters,
    }).parse();
    return arg;
  }

  // apply to direct children, if nested appear, apply to the first arg of the children
  // if no children, then apply to self
  apply(...fns: ArgApplyFn[]): Node {
    for (const fn of fns) {
      if (this.isNested) {
        [...this.children].forEach((node) => node.applyFirst(fn));
      } else {
        this.applyFirst(fn);
      }
    }

    return _recursiveUpdateParentToArg(this);
  }

  // recursively apply to all elements
  applyAll(...fns: ArgApplyFn[]): Node {
    for (const fn of fns) {
      if (this.isNested) {
        [...this.children].forEach((node) => node.applyAll(fn));
      } else {
        this.applyFirst(fn);
      }
    }
    return _recursiveUpdateParentToArg(this);
  }

  applyFirst(...fns: ArgApplyFn[]): Node {
    for (const fn of fns) {
      if (this.isNested) {
        this.children[0].applyFirst(fn);
      } else {
        fn(this._arg!);
      }
    }

    return _recursiveUpdateParentToArg(this);
  }

  // apply to direct children except the first, if nested appear, apply to the first arg of the children
  applyRest(...fns: ArgApplyFn[]): Node {
    for (const fn of fns) {
      if (this.isNested) {
        this.children.slice(1).forEach((node) => node.applyFirst(fn));
      }
    }
    return _recursiveUpdateParentToArg(this);
  }

  split(): [Node, Node] {
    const [firstNode, ...restNodes] = this._children;
    const restNode = Node.fromParameters(null, restNodes, true, this.options);
    return [
      _recursiveUpdateParentToArg(firstNode.clone()),
      _recursiveUpdateParentToArg(restNode),
    ];
  }

  push(...texts: (string | Node)[]): Node {
    for (const text of texts) {
      if (typeof text === "string") {
        this._children.push(
          ...Node.fromText(text, true, this.options).children
        );
      } else if (text instanceof Node) {
        this._children.push(text);
      } else {
        throw new Error("input should be either string or Node");
      }
    }
    return _recursiveUpdateParentToArg(this);
  }

  unshift(...texts: (string | Node)[]): Node {
    for (const text of texts.reverse()) {
      if (typeof text === "string") {
        this._children.unshift(
          ...Node.fromText(text, true, this.options).children
        );
      } else if (text instanceof Node) {
        this._children.unshift(text);
      } else {
        throw new Error("input should be either string or Node");
      }
    }
    return _recursiveUpdateParentToArg(this);
  }

  remove(...selectors: ArgSelector[]) {
    this.apply(
      ...selectors.map((selector) => (arg: Arg) => {
        let _selector: ArgSelectorFn =
          typeof selector === "string"
            ? (arg: Arg) => arg.equals(selector)
            : selector;
        if (_selector(arg)) {
          const index = arg.parent._children.findIndex(
            (node) => node._arg === arg
          );
          if (index !== -1) {
            arg.parent._children.splice(index, 1);
          }
        }
      })
    );
  }

  removeAll(...selectors: ArgSelector[]) {
    this.applyAll(
      ...selectors.map((selector) => (arg: Arg) => {
        let _selector: ArgSelectorFn =
          typeof selector === "string"
            ? (arg: Arg) => arg.equals(selector)
            : selector;
        if (_selector(arg)) {
          const index = arg.parent._children.findIndex(
            (node) => node._arg === arg
          );
          if (index !== -1) {
            arg.parent._children.splice(index, 1);
          }
        }
      })
    );
  }


  selectAll(selector: ArgSelector): Node {
    const nodes: Node[] = [];
    this.applyAll((arg) => {
      if (arg.contains(selector)) {
        // TODO: bad implementation here (find the arg each time from parent) for performance, can improve it later
        const child = arg.parent._children.find(x=>x._arg === arg)!
        nodes.push(child);
      }
    });
    return Node.fromParameters(null, nodes, true, this.options,false);
  }


  // use this with selector
  clone(): Node {
    const node = new Node();
    return _recursiveUpdateParentToArg(
      Node.fromParameters(
        this._arg ? this._arg.clone() : null,
        this._children.map((node) => node.clone()),
        this.isNested,
        this.options
      )
    );
  }

}

class NodeParser {
  private cursor: number = 0;
  private totalLength: number = -1;
  private nodes: Node[] = [];

  get isNotEnd() {
    return this.cursor < this.totalLength;
  }

  constructor(private options: ParseOptions, private text: string) {
    this.text = text.trim();
    this.totalLength = this.text.length;
  }

  parse(): Node[] {
    while (this.isNotEnd) {
      if (this.text[this.cursor] === this.options.childrenStart) {
        this.cursor++;
        this.matchChildren();
      } else {
        this.matchLeafNode();
      }
      this.matchWhiteSpace();
    }
    return this.nodes;
  }

  matchLeafNode() {
    const startIndex = this.cursor;

    while (this.isNotEnd) {
      const char = this.text[this.cursor];
      if (this.options.quoteStart === char) {
        this.cursor++;
        this.matchString();
      } else if (WHITESPACE_CHARS.has(char)) {
        break;
      } else {
        this.cursor++;
      }
    }
    this.nodes.push(
      Node.fromText(
        this.text.substring(startIndex, this.cursor),
        false,
        this.options
      )
    );
  }
  matchChildren() {
    const startIndex = this.cursor;
    let bracketCount = 1;
    while (this.isNotEnd) {
      const char = this.text[this.cursor];
      if (char === this.options.childrenEnd) {
        bracketCount -= 1;
        if (bracketCount === 0) {
          this.nodes.push(
            Node.fromText(
              this.text.substring(startIndex, this.cursor),
              true,
              this.options
            )
          );
          this.cursor++;
          return;
        } else {
          this.cursor++;
        }
      } else if (char === this.options.childrenStart) {
        bracketCount++;
        this.cursor++;
      } else if (char === this.options.quoteStart) {
        this.cursor++;
        this.matchString();
      } else {
        this.cursor++;
      }
    }
    throw new Error("nested children starts at ${startIndex} didn't complete");
  }

  matchString() {
    const startIndex = this.cursor - 1;
    while (this.cursor < this.totalLength) {
      if (this.text[this.cursor] !== this.options.quoteEnd) {
        this.cursor++;
      } else {
        this.cursor++;
        return true;
      }
    }

    throw new Error(`string starts at ${startIndex} didn't complete`);
  }

  matchWhiteSpace() {
    while (this.cursor < this.totalLength) {
      if (WHITESPACE_CHARS.has(this.text[this.cursor])) {
        this.cursor++;
      } else {
        return;
      }
    }
  }
}

export class Arg {
  public parent!: Node;

  constructor(
    public name: string,
    public parameters: [string, string][],
    public options: ArgOptions = {
      delimiters: DEFAULT_DELIMITERS,
      quoteEnd: "`",
      quoteStart: "`",
    }
  ) {}

  public rewrite(text: string) {
    const newArg = new ArgParser(text, this.options).parse();
    this.name = newArg.name;
    this.parameters = newArg.parameters;
  }

  public clone(): Arg {
    const arg = new Arg(
      this.name,
      this.parameters.map((p) => [...p]),
      this.options
    );
    arg.parent = this.parent;
    return arg;
  }

  public add(value: string, delimiter: string = ".") {
    this.parameters.push([delimiter, value]);
  }

  public addIfNotExists(value: string, delimiter: string = ".") {
    for (const [d, v] of this.parameters) {
      if (d === delimiter && v === value) {
        return;
      }
    }
    this.parameters.push([delimiter, value]);
  }

  public setNameIfNotExists(name: string) {
    if (!this.name) {
      this.name = name;
    }
  }

  public transformName(from: string | RegExp, to: NameReplacer): void;
  public transformName(transforms: [string | RegExp, NameReplacer][]): void;
  public transformName(from: any, to?: any) {
    if (Array.isArray(from)) {
      for (const [_from, _to] of from) {
        const newValue = this._replace(this.name, _from, _to);
        if (newValue !== null) {
          this.name = newValue;
          return;
        }
      }
    } else {
      const newValue = this._replace(this.name, from, to);
      if (newValue !== null) {
        this.name = newValue;
      }
    }
  }

  private _replace(
    v: string,
    value: string | RegExp,
    to: NameReplacer
  ): string | null {
    if (
      (typeof value === "string" && v === value) ||
      ((value as any) instanceof RegExp && (value as any).exec(v))
    ) {
      if (typeof to === "function") {
        to = to(v);
      }

      return v.replace(value, to);
    }
    return null;
  }

  public pop(value: string | RegExp, delimiter: string = "."): string | null {
    let result = null;
    let toRemove = -1;
    for (let i = 0; i < this.parameters.length; i++) {
      const [d, v] = this.parameters[i];
      if (d === delimiter) {
        if (
          (typeof value === "string" && v === value) ||
          ((value as any) instanceof RegExp && (value as any).exec(v))
        ) {
          toRemove = i;
          result = v;
          break;
        }
      }
    }

    if (toRemove !== -1) {
      this.parameters.splice(toRemove, 1);
    }
    return result;
  }

  public popApply(
    value: string | RegExp,
    fn: (value: string) => void,
    delimiter: string = "."
  ) {
    const popout = this.pop(value, delimiter);
    if (popout) {
      fn(popout);
    }
  }

  public popMany(value: string | RegExp, delimiter: string = "."): string[] {
    let result = [];
    let toRemove: any = [];
    for (let i = 0; i < this.parameters.length; i++) {
      const [d, v] = this.parameters[i];
      if (d === delimiter) {
        if (
          (typeof value === "string" && v === value) ||
          ((value as any) instanceof RegExp && (value as any).exec(v))
        ) {
          toRemove.push(i);
          result.push(v);
        }
      }
    }
    const newParameters = [];
    toRemove = new Set(toRemove);
    for (let i = 0; i < this.parameters.length; i++) {
      const param = this.parameters[i];
      if (toRemove.has(i)) {
        continue;
      }
      newParameters.push(param);
    }
    this.parameters = newParameters;
    return result;
  }

  public replace(
    value: string | RegExp,
    to: Replacer,
    delimiter: string = "."
  ) {
    let newParameters: [string, string][] = [];
    for (let i = 0; i < this.parameters.length; i++) {
      const [d, v] = this.parameters[i];
      if (d === delimiter) {
        if (
          (typeof value === "string" && v === value) ||
          ((value as any) instanceof RegExp && (value as any).exec(v))
        ) {
          if (typeof to === "function") {
            to = to(v);
          }

          if (typeof to === "string") {
            newParameters.push([delimiter, v.replace(value, to)]);
          } else if (Array.isArray(to)) {
            for (const v of to) {
              newParameters.push([delimiter, v]);
            }
          }
        } else {
          newParameters.push([d, v]);
        }
      } else {
        newParameters.push([d, v]);
      }
    }

    this.parameters = newParameters;
  }

  public all(delimiter: string = "."): string[] {
    return this.parameters.filter((x) => x[0] === delimiter).map((x) => x[1]);
  }

  public one(delimiter: string = "."): string | null {
    const candidates = this.parameters
      .filter((x) => x[0] === delimiter)
      .map((x) => x[1]);
    if (candidates.length === 0) {
      return null;
    } else if (candidates.length === 1) {
      return candidates[0];
    } else {
      throw new Error(
        `'${this.toText()}' have multiple values for ${delimiter} `
      );
    }
  }

  public toText(): string {
    const result: string[] = [];
    const nameMatch = MATCH_EXPAND_NAME_PATTEN.exec(this.name);
    if (nameMatch && nameMatch[0] === this.name) {
      result.push(this.name);
    } else {
      result.push(this.options.quoteStart + this.name + this.options.quoteEnd);
    }
    for (const [d, v] of this.parameters) {
      result.push(d);
      result.push(this._wrapAsStrng(v));
    }
    return result.join("");
  }

  private _wrapAsStrng(text: string): string {
    let needsWrap = false;
    for (const delimiter of this.options.delimiters) {
      if (text.indexOf(delimiter) !== -1) {
        needsWrap = true;
        break;
      }
    }
    return needsWrap
      ? this.options.quoteStart + text + this.options.quoteEnd
      : text;
  }

  public equals(arg: string | Arg, isStrict: boolean = false): boolean {
    const targetArg: Arg =
      typeof arg === "string" ? new ArgParser(arg, this.options).parse() : arg;
    if (this.name !== targetArg.name) {
      return false;
    }

    if (this.parameters.length !== targetArg.parameters.length) {
      return false;
    }
    if (isStrict) {
      // in strict mode, all parameters need to have the same sequence
      for (let i = 0; i < this.parameters.length; i++) {
        const param = this.parameters[i];
        const targetParam = targetArg.parameters[i];
        if (param[0] !== targetParam[0] || param[1] !== targetParam[1]) {
          return false;
        }
      }
      return true;
    } else {
      // in non strict mode, all parameters don't need to have the same sequence
      for (const delimiter of this.options.delimiters) {
        const params = new Set(this.all(delimiter));
        const targetParams = targetArg.all(delimiter);
        if (params.size !== targetParams.length) {
          return false;
        }
        for (const targetParam of targetParams) {
          if (!params.has(targetParam)) {
            return false;
          }
        }
      }

      return true;
    }
  }

  public contains(arg: string | Arg | ArgSelectorFn): boolean {
    if(typeof arg === "function") {
      return arg(this)
    }

    const targetArg: Arg =
      typeof arg === "string" ? new ArgParser(arg, this.options).parse() : arg;
    if (this.name !== targetArg.name) {
      return false;
    }

    for (const delimiter of this.options.delimiters) {
      const params = new Set(this.all(delimiter));
      const targetParams = targetArg.all(delimiter);

      for (const targetParam of targetParams) {
        if (!params.has(targetParam)) {
          return false;
        }
      }
    }

    return true;
  }
}

export interface ArgOptions {
  delimiters: string[];
  quoteStart: string;
  quoteEnd: string;
}

export class ArgParser {
  cursor: number = 0;
  private totalLength: number = -1;

  name: string = "";
  parameters: [string, string][] = [];

  get isNotEnd() {
    return this.cursor < this.totalLength;
  }

  constructor(
    public text: string,
    public options: ArgOptions = {
      delimiters: DEFAULT_DELIMITERS,
      quoteStart: "`",
      quoteEnd: "`",
    }
  ) {
    this.totalLength = this.text.length;
  }

  matchName() {
    if (this.text[this.cursor] === this.options.quoteStart) {
      this.cursor++;
      this.name = this.matchString();
    } else {
      const length = this.peek(MATCH_EXPAND_NAME_PATTEN);
      this.name = this.text.substring(0, length);
      this.cursor += length;
    }
  }

  matchString(): string {
    const startIndex = this.cursor;
    while (this.cursor < this.totalLength) {
      if (this.text[this.cursor] !== this.options.quoteEnd) {
        this.cursor++;
      } else {
        const text = this.text.substring(startIndex, this.cursor);
        this.cursor++;
        return text;
      }
    }

    throw new Error(`string starts at ${startIndex} didn't complete`);
  }

  matchParameter() {
    let startIndex = this.cursor;
    if (!this.matchDelimiter()) {
      throw new Error("should have parameters after name");
    }

    const delimiter = this.text.substring(startIndex, this.cursor);
    const paramterStartIndex = this.cursor;
    let parameter: string;
    if (this.text[this.cursor] === this.options.quoteStart) {
      this.cursor++;
      parameter = this.matchString();
    } else {
      while (this.cursor < this.totalLength) {
        if (this.matchDelimiter(true)) {
          break;
        } else {
          this.cursor++;
        }
      }
      parameter = this.text.substring(paramterStartIndex, this.cursor);
    }

    this.parameters.push([delimiter, parameter]);
  }

  matchDelimiter(isPeek: boolean = false): boolean {
    for (const delimiter of this.options.delimiters) {
      const move = this.peek(delimiter);
      if (move !== -1) {
        if (!isPeek) {
          this.cursor += move;
        }
        return true;
      }
    }

    return false;
  }

  peek(pattern: string | RegExp): number {
    if (pattern instanceof RegExp) {
      const match = pattern.exec(this.text.substring(this.cursor));
      if (match) {
        return match[0].length;
      } else {
        return -1;
      }
    } else if (typeof pattern === "string") {
      if (
        this.text.substring(this.cursor, this.cursor + pattern.length) ===
        pattern
      ) {
        return pattern.length;
      } else {
        return -1;
      }
    }
    throw new Error("won't reach here, pattern should be string or regex");
  }

  public parse(): Arg {
    this.matchName();
    while (this.isNotEnd) {
      this.matchParameter();
    }
    return new Arg(this.name, this.parameters);
  }
}
