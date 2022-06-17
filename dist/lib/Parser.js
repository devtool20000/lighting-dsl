"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgParser = exports.Arg = exports.Node = exports.concat = exports.parseOne = exports._recursiveUpdateParentToArg = exports.parse = exports.DEFAULT_OPTIONS = void 0;
const WHITESPACE_CHARS = new Set([" ", "\t"]);
const MATCH_EXPAND_NAME_PATTEN = /^([a-zA-Z0-9\-]+)?/;
const DEFAULT_DELIMITERS = [".", ":", "@"];
exports.DEFAULT_OPTIONS = {
    childrenStart: "{",
    childrenEnd: "}",
    quoteStart: "`",
    quoteEnd: "`",
    delimiters: DEFAULT_DELIMITERS,
};
function parse(text, options = {}) {
    options.childrenStart = options.childrenStart || "{";
    options.childrenEnd = options.childrenEnd || "}";
    options.quoteStart = options.quoteStart || "`";
    options.quoteEnd = options.quoteEnd || "`";
    options.delimiters = DEFAULT_DELIMITERS;
    const result = Node.fromText(text, true, options);
    _recursiveUpdateParentToArg(result);
    return result;
}
exports.parse = parse;
function _recursiveUpdateParentToArg(node) {
    if (node.isNested) {
        for (const child of node.children) {
            if (!child.isNested) {
                child.arg.parent = node;
            }
            else {
                _recursiveUpdateParentToArg(child);
            }
        }
    }
    return node;
}
exports._recursiveUpdateParentToArg = _recursiveUpdateParentToArg;
function parseOne(text, options = {}) {
    return Node.fromText(text, false, options);
}
exports.parseOne = parseOne;
// concat nodes to merge into a new node
// for nested nodes, it will spread and merge together so concat("a", "b c", "d") will return "a b c d"
function concat(...nodes) {
    let options = exports.DEFAULT_OPTIONS;
    for (const node of nodes) {
        if (node instanceof Node) {
            options = node.options;
        }
    }
    const compiledNodes = nodes.map((node) => {
        if (typeof node === "string") {
            return parse(node, options);
        }
        else if (node instanceof Node) {
            return node;
        }
        else {
            throw new Error("node can only accept string and Node");
        }
    });
    const result = Node.fromParameters(null, [], true, options);
    for (const node of compiledNodes) {
        if (node.isNested) {
            result.push(...node.children);
        }
        else {
            result.push(node);
        }
    }
    return _recursiveUpdateParentToArg(result);
}
exports.concat = concat;
class Node {
    constructor() {
        this._children = [];
        this._arg = null;
    }
    get text() {
        if (this.isNested) {
            return this._children
                .map((child) => (child.isNested ? `{${child.text}}` : child.text))
                .join(" ");
        }
        else {
            return this._arg.toText();
        }
    }
    static fromText(text, isNested, options) {
        const node = new Node();
        node.isNested = isNested;
        node.options = options;
        if (isNested) {
            const parser = new NodeParser(options, text);
            node._children = parser.parse();
        }
        else {
            node._arg = node._parseArg(text, node.options.delimiters);
        }
        return node;
    }
    static fromParameters(arg, children, isNested, options, isClone = true) {
        const node = new Node();
        node.isNested = isNested;
        node.options = options;
        if (isNested) {
            node._children = children.map((node) => isClone ? node.clone() : node);
        }
        else {
            node._arg = arg ? (isClone ? arg.clone() : arg) : null;
        }
        return node;
    }
    get children() {
        if (!this.isNested) {
            throw new Error(`'${this.text}' has no children`);
        }
        return this._children;
    }
    get arg() {
        if (this.isNested) {
            throw new Error(`'${this.text}' has children`);
        }
        return this._arg;
    }
    _parseArg(text, delimiters = DEFAULT_DELIMITERS) {
        if (this.isNested) {
            throw new Error(`'${this.text}' has children`);
        }
        const arg = new ArgParser(text, Object.assign(Object.assign({}, this.options), { delimiters })).parse();
        return arg;
    }
    // apply to direct children, if nested appear, apply to the first arg of the children
    // if no children, then apply to self
    apply(...fns) {
        for (const fn of fns) {
            if (this.isNested) {
                [...this.children].forEach((node) => node.applyFirst(fn));
            }
            else {
                this.applyFirst(fn);
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    // recursively apply to all elements
    applyAll(...fns) {
        for (const fn of fns) {
            if (this.isNested) {
                [...this.children].forEach((node) => node.applyAll(fn));
            }
            else {
                this.applyFirst(fn);
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    applyFirst(...fns) {
        for (const fn of fns) {
            if (this.isNested) {
                this.children[0].applyFirst(fn);
            }
            else {
                fn(this._arg);
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    // apply to direct children except the first, if nested appear, apply to the first arg of the children
    applyRest(...fns) {
        for (const fn of fns) {
            if (this.isNested) {
                this.children.slice(1).forEach((node) => node.applyFirst(fn));
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    split() {
        const [firstNode, ...restNodes] = this._children;
        const restNode = Node.fromParameters(null, restNodes, true, this.options);
        return [
            _recursiveUpdateParentToArg(firstNode.clone()),
            _recursiveUpdateParentToArg(restNode),
        ];
    }
    push(...texts) {
        for (const text of texts) {
            if (typeof text === "string") {
                this._children.push(...Node.fromText(text, true, this.options).children);
            }
            else if (text instanceof Node) {
                this._children.push(text);
            }
            else {
                throw new Error("input should be either string or Node");
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    unshift(...texts) {
        for (const text of texts.reverse()) {
            if (typeof text === "string") {
                this._children.unshift(...Node.fromText(text, true, this.options).children);
            }
            else if (text instanceof Node) {
                this._children.unshift(text);
            }
            else {
                throw new Error("input should be either string or Node");
            }
        }
        return _recursiveUpdateParentToArg(this);
    }
    remove(...selectors) {
        this.apply(...selectors.map((selector) => (arg) => {
            let _selector = typeof selector === "string"
                ? (arg) => arg.equals(selector)
                : selector;
            if (_selector(arg)) {
                const index = arg.parent._children.findIndex((node) => node._arg === arg);
                if (index !== -1) {
                    arg.parent._children.splice(index, 1);
                }
            }
        }));
    }
    removeAll(...selectors) {
        this.applyAll(...selectors.map((selector) => (arg) => {
            let _selector = typeof selector === "string"
                ? (arg) => arg.equals(selector)
                : selector;
            if (_selector(arg)) {
                const index = arg.parent._children.findIndex((node) => node._arg === arg);
                if (index !== -1) {
                    arg.parent._children.splice(index, 1);
                }
            }
        }));
    }
    selectAll(selector) {
        const nodes = [];
        this.applyAll((arg) => {
            if (arg.contains(selector)) {
                // TODO: bad implementation here (find the arg each time from parent) for performance, can improve it later
                const child = arg.parent._children.find(x => x._arg === arg);
                nodes.push(child);
            }
        });
        return Node.fromParameters(null, nodes, true, this.options, false);
    }
    // use this with selector
    clone() {
        const node = new Node();
        return _recursiveUpdateParentToArg(Node.fromParameters(this._arg ? this._arg.clone() : null, this._children.map((node) => node.clone()), this.isNested, this.options));
    }
}
exports.Node = Node;
class NodeParser {
    constructor(options, text) {
        this.options = options;
        this.text = text;
        this.cursor = 0;
        this.totalLength = -1;
        this.nodes = [];
        this.text = text.trim();
        this.totalLength = this.text.length;
    }
    get isNotEnd() {
        return this.cursor < this.totalLength;
    }
    parse() {
        while (this.isNotEnd) {
            if (this.text[this.cursor] === this.options.childrenStart) {
                this.cursor++;
                this.matchChildren();
            }
            else {
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
            }
            else if (WHITESPACE_CHARS.has(char)) {
                break;
            }
            else {
                this.cursor++;
            }
        }
        this.nodes.push(Node.fromText(this.text.substring(startIndex, this.cursor), false, this.options));
    }
    matchChildren() {
        const startIndex = this.cursor;
        let bracketCount = 1;
        while (this.isNotEnd) {
            const char = this.text[this.cursor];
            if (char === this.options.childrenEnd) {
                bracketCount -= 1;
                if (bracketCount === 0) {
                    this.nodes.push(Node.fromText(this.text.substring(startIndex, this.cursor), true, this.options));
                    this.cursor++;
                    return;
                }
                else {
                    this.cursor++;
                }
            }
            else if (char === this.options.childrenStart) {
                bracketCount++;
                this.cursor++;
            }
            else if (char === this.options.quoteStart) {
                this.cursor++;
                this.matchString();
            }
            else {
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
            }
            else {
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
            }
            else {
                return;
            }
        }
    }
}
class Arg {
    constructor(name, parameters, options = {
        delimiters: DEFAULT_DELIMITERS,
        quoteEnd: "`",
        quoteStart: "`",
    }) {
        this.name = name;
        this.parameters = parameters;
        this.options = options;
    }
    rewrite(text) {
        const newArg = new ArgParser(text, this.options).parse();
        this.name = newArg.name;
        this.parameters = newArg.parameters;
    }
    clone() {
        const arg = new Arg(this.name, this.parameters.map((p) => [...p]), this.options);
        arg.parent = this.parent;
        return arg;
    }
    add(value, delimiter = ".") {
        this.parameters.push([delimiter, value]);
    }
    addIfNotExists(value, delimiter = ".") {
        for (const [d, v] of this.parameters) {
            if (d === delimiter && v === value) {
                return;
            }
        }
        this.parameters.push([delimiter, value]);
    }
    setNameIfNotExists(name) {
        if (!this.name) {
            this.name = name;
        }
    }
    transformName(from, to) {
        if (Array.isArray(from)) {
            for (const [_from, _to] of from) {
                const newValue = this._replace(this.name, _from, _to);
                if (newValue !== null) {
                    this.name = newValue;
                    return;
                }
            }
        }
        else {
            const newValue = this._replace(this.name, from, to);
            if (newValue !== null) {
                this.name = newValue;
            }
        }
    }
    _replace(v, value, to) {
        if ((typeof value === "string" && v === value) ||
            (value instanceof RegExp && value.exec(v))) {
            if (typeof to === "function") {
                to = to(v);
            }
            return v.replace(value, to);
        }
        return null;
    }
    pop(value, delimiter = ".") {
        let result = null;
        let toRemove = -1;
        for (let i = 0; i < this.parameters.length; i++) {
            const [d, v] = this.parameters[i];
            if (d === delimiter) {
                if ((typeof value === "string" && v === value) ||
                    (value instanceof RegExp && value.exec(v))) {
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
    popApply(value, fn, delimiter = ".") {
        const popout = this.pop(value, delimiter);
        if (popout) {
            fn(popout);
        }
    }
    popMany(value, delimiter = ".") {
        let result = [];
        let toRemove = [];
        for (let i = 0; i < this.parameters.length; i++) {
            const [d, v] = this.parameters[i];
            if (d === delimiter) {
                if ((typeof value === "string" && v === value) ||
                    (value instanceof RegExp && value.exec(v))) {
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
    replace(value, to, delimiter = ".") {
        let newParameters = [];
        for (let i = 0; i < this.parameters.length; i++) {
            const [d, v] = this.parameters[i];
            if (d === delimiter) {
                if ((typeof value === "string" && v === value) ||
                    (value instanceof RegExp && value.exec(v))) {
                    if (typeof to === "function") {
                        to = to(v);
                    }
                    if (typeof to === "string") {
                        newParameters.push([delimiter, v.replace(value, to)]);
                    }
                    else if (Array.isArray(to)) {
                        for (const v of to) {
                            newParameters.push([delimiter, v]);
                        }
                    }
                }
                else {
                    newParameters.push([d, v]);
                }
            }
            else {
                newParameters.push([d, v]);
            }
        }
        this.parameters = newParameters;
    }
    all(delimiter = ".") {
        return this.parameters.filter((x) => x[0] === delimiter).map((x) => x[1]);
    }
    one(delimiter = ".") {
        const candidates = this.parameters
            .filter((x) => x[0] === delimiter)
            .map((x) => x[1]);
        if (candidates.length === 0) {
            return null;
        }
        else if (candidates.length === 1) {
            return candidates[0];
        }
        else {
            throw new Error(`'${this.toText()}' have multiple values for ${delimiter} `);
        }
    }
    toText() {
        const result = [];
        const nameMatch = MATCH_EXPAND_NAME_PATTEN.exec(this.name);
        if (nameMatch && nameMatch[0] === this.name) {
            result.push(this.name);
        }
        else {
            result.push(this.options.quoteStart + this.name + this.options.quoteEnd);
        }
        for (const [d, v] of this.parameters) {
            result.push(d);
            result.push(this._wrapAsStrng(v));
        }
        return result.join("");
    }
    _wrapAsStrng(text) {
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
    equals(arg, isStrict = false) {
        const targetArg = typeof arg === "string" ? new ArgParser(arg, this.options).parse() : arg;
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
        }
        else {
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
    contains(arg) {
        if (typeof arg === "function") {
            return arg(this);
        }
        const targetArg = typeof arg === "string" ? new ArgParser(arg, this.options).parse() : arg;
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
exports.Arg = Arg;
class ArgParser {
    constructor(text, options = {
        delimiters: DEFAULT_DELIMITERS,
        quoteStart: "`",
        quoteEnd: "`",
    }) {
        this.text = text;
        this.options = options;
        this.cursor = 0;
        this.totalLength = -1;
        this.name = "";
        this.parameters = [];
        this.totalLength = this.text.length;
    }
    get isNotEnd() {
        return this.cursor < this.totalLength;
    }
    matchName() {
        if (this.text[this.cursor] === this.options.quoteStart) {
            this.cursor++;
            this.name = this.matchString();
        }
        else {
            const length = this.peek(MATCH_EXPAND_NAME_PATTEN);
            this.name = this.text.substring(0, length);
            this.cursor += length;
        }
    }
    matchString() {
        const startIndex = this.cursor;
        while (this.cursor < this.totalLength) {
            if (this.text[this.cursor] !== this.options.quoteEnd) {
                this.cursor++;
            }
            else {
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
        let parameter;
        if (this.text[this.cursor] === this.options.quoteStart) {
            this.cursor++;
            parameter = this.matchString();
        }
        else {
            while (this.cursor < this.totalLength) {
                if (this.matchDelimiter(true)) {
                    break;
                }
                else {
                    this.cursor++;
                }
            }
            parameter = this.text.substring(paramterStartIndex, this.cursor);
        }
        this.parameters.push([delimiter, parameter]);
    }
    matchDelimiter(isPeek = false) {
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
    peek(pattern) {
        if (pattern instanceof RegExp) {
            const match = pattern.exec(this.text.substring(this.cursor));
            if (match) {
                return match[0].length;
            }
            else {
                return -1;
            }
        }
        else if (typeof pattern === "string") {
            if (this.text.substring(this.cursor, this.cursor + pattern.length) ===
                pattern) {
                return pattern.length;
            }
            else {
                return -1;
            }
        }
        throw new Error("won't reach here, pattern should be string or regex");
    }
    parse() {
        this.matchName();
        while (this.isNotEnd) {
            this.matchParameter();
        }
        return new Arg(this.name, this.parameters);
    }
}
exports.ArgParser = ArgParser;
//# sourceMappingURL=Parser.js.map