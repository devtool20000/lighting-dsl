const WHITESPACE_CHARS = new Set([" ", "\t"]);
const MATCH_EXPAND_NAME_PATTEN = /^([a-zA-Z0-9\-]+)?/;

export type Replacer =
  | string
  | string[]
  | ((value: string) => string | string[]);

export type NameReplacer = string | ((value: string) => string);

export function parse(
  text: string,
  options: Partial<ParseOptions> = {}
): Node[] {
  options.childrenStart = options.childrenStart || "{";
  options.childrenEnd = options.childrenEnd || "}";
  options.quoteStart = options.quoteStart || "`";
  options.quoteEnd = options.quoteEnd || "`";
  return new NodeParser(options as ParseOptions, text).prase();
}

export function parseOne(text: string, options: Partial<ParseOptions> = {}) : Node {
  return parse(text,options)[0]
}

export interface ParseOptions {
  childrenStart: string;
  childrenEnd: string;
  quoteStart: string;
  quoteEnd: string;
}

export class Node {
  constructor(
    public text: string,
    public isNested: boolean,
    private options: ParseOptions
  ) {}

  get children(): Node[] {
    if (!this.isNested) {
      throw new Error(`'${this.text}' has no children`);
    }
    return parse(this.text, this.options);
  }

  parseArg(delimiters: string[] = [".",":"]): Arg {
    if (this.isNested) {
      throw new Error(`'${this.text}' has children`);
    }
    return new ArgParser(this.text, {
      delimiters,
      ...this.options,
    }).parse();
  }
}

export class Arg {
  constructor(
    public name: string,
    public parameters: [string, string][],
    public options: ArgOptions = {
      delimiters: [".", ":"],
      quoteEnd: "`",
      quoteStart: "`",
    }
  ) {}

  public clone():Arg {
    return new Arg(
      this.name,
      this.parameters.map(p=>[...p]),
      this.options
    )
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

  public popApply(value: string | RegExp, fn:(value:string)=>void, delimiter: string = ".") {
    const popout = this.pop(value,delimiter)
    if(popout) {
      fn(popout)
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
      delimiters: [".", ":"],
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
    let parameter:string
    if(this.text[this.cursor] === this.options.quoteStart) {
      this.cursor++
      parameter = this.matchString()
    }
    else {
      while (this.cursor < this.totalLength) {
        if (this.matchDelimiter(true)) {
          break;
        } else {
          this.cursor++;
        }
      }
      parameter = this.text.substring(paramterStartIndex, this.cursor)
    }

   

    this.parameters.push([
      delimiter,
      parameter,
    ]);
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

  prase(): Node[] {
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
      new Node(
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
            new Node(
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
