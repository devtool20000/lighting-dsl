export declare type Replacer = string | string[] | ((value: string) => string | string[]);
export declare type NameReplacer = string | ((value: string) => string);
export declare function parse(text: string, options?: Partial<ParseOptions>): Node[];
export declare function parseOne(text: string, options?: Partial<ParseOptions>): Node;
export interface ParseOptions {
    childrenStart: string;
    childrenEnd: string;
    quoteStart: string;
    quoteEnd: string;
}
export declare class Node {
    text: string;
    isNested: boolean;
    private options;
    constructor(text: string, isNested: boolean, options: ParseOptions);
    get children(): Node[];
    parseArg(delimiters?: string[]): Arg;
}
export declare class Arg {
    name: string;
    parameters: [string, string][];
    options: ArgOptions;
    constructor(name: string, parameters: [string, string][], options?: ArgOptions);
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
