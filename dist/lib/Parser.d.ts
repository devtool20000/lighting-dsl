export declare const DEFAULT_OPTIONS: ParseOptions;
export declare type Replacer = string | string[] | ((value: string) => string | string[]);
export declare type NameReplacer = string | ((value: string) => string);
export declare type ArgApplyFn = (arg: Arg) => void;
export declare type ArgSelectorFn = (arg: Arg) => boolean;
export declare type ArgSelector = ArgSelectorFn | string;
export declare function parse(text: string, options?: Partial<ParseOptions>): Node;
export declare function _recursiveUpdateParentToArg(node: Node): Node;
export declare function parseOne(text: string, options?: Partial<ParseOptions>): Node;
export interface ParseOptions {
    childrenStart: string;
    childrenEnd: string;
    quoteStart: string;
    quoteEnd: string;
    delimiters: string[];
}
export declare function concat(...nodes: (string | Node)[]): Node;
export declare class Node {
    private _children;
    private _arg;
    isNested: boolean;
    options: ParseOptions;
    get text(): string;
    constructor();
    static fromText(text: string, isNested: boolean, options: ParseOptions): Node;
    static fromParameters(arg: Arg | null, children: Node[], isNested: boolean, options: ParseOptions, isClone?: boolean): Node;
    get children(): Node[];
    get arg(): Arg;
    private _parseArg;
    apply(...fns: ArgApplyFn[]): Node;
    applyAll(...fns: ArgApplyFn[]): Node;
    applyFirst(...fns: ArgApplyFn[]): Node;
    applyRest(...fns: ArgApplyFn[]): Node;
    split(): [Node, Node];
    push(...texts: (string | Node)[]): Node;
    unshift(...texts: (string | Node)[]): Node;
    remove(...selectors: ArgSelector[]): void;
    removeAll(...selectors: ArgSelector[]): void;
    selectAll(selector: ArgSelector): Node;
    clone(): Node;
}
export declare class Arg {
    name: string;
    parameters: [string, string][];
    options: ArgOptions;
    parent: Node;
    constructor(name: string, parameters: [string, string][], options?: ArgOptions);
    rewrite(text: string): void;
    clone(): Arg;
    add(value: string, delimiter?: string): void;
    addIfNotExists(value: string, delimiter?: string): void;
    setNameIfNotExists(name: string): void;
    transformName(from: string | RegExp, to: NameReplacer): void;
    transformName(transforms: [string | RegExp, NameReplacer][]): void;
    private _replace;
    pop(value: string | RegExp, delimiter?: string): string | null;
    popApply(value: string | RegExp, fn: (value: string) => void, delimiter?: string): void;
    popMany(value: string | RegExp, delimiter?: string): string[];
    replace(value: string | RegExp, to: Replacer, delimiter?: string): void;
    all(delimiter?: string): string[];
    one(delimiter?: string): string | null;
    toText(): string;
    private _wrapAsStrng;
    equals(arg: string | Arg, isStrict?: boolean): boolean;
    contains(arg: string | Arg | ArgSelectorFn): boolean;
}
export interface ArgOptions {
    delimiters: string[];
    quoteStart: string;
    quoteEnd: string;
}
export declare class ArgParser {
    text: string;
    options: ArgOptions;
    cursor: number;
    private totalLength;
    name: string;
    parameters: [string, string][];
    get isNotEnd(): boolean;
    constructor(text: string, options?: ArgOptions);
    matchName(): void;
    matchString(): string;
    matchParameter(): void;
    matchDelimiter(isPeek?: boolean): boolean;
    peek(pattern: string | RegExp): number;
    parse(): Arg;
}
