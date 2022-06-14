"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgParser = exports.Arg = exports.Node = exports.parseOne = exports.parse = void 0;
const WHITESPACE_CHARS = new Set([" ", "\t"]);
const MATCH_EXPAND_NAME_PATTEN = /^([a-zA-Z0-9\-]+)?/;
function parse(text, options = {}) {
    options.childrenStart = options.childrenStart || "{";
    options.childrenEnd = options.childrenEnd || "}";
    options.quoteStart = options.quoteStart || "`";
    options.quoteEnd = options.quoteEnd || "`";
    return new NodeParser(options, text).prase();
}
exports.parse = parse;
function parseOne(text, options = {}) {
    return parse(text, options)[0];
}
exports.parseOne = parseOne;
class Node {
    constructor(text, isNested, options) {
        this.text = text;
        this.isNested = isNested;
        this.options = options;
    }
    get children() {
        if (!this.isNested) {
            throw new Error(`'${this.text}' has no children`);
        }
        return parse(this.text, this.options);
    }
    parseArg(delimiters = [".", ":"]) {
        if (this.isNested) {
            throw new Error(`'${this.text}' has children`);
        }
        return new ArgParser(this.text, Object.assign({ delimiters }, this.options)).parse();
    }
}
exports.Node = Node;
class Arg {
    constructor(name, parameters, options = {
        delimiters: [".", ":"],
        quoteEnd: "`",
        quoteStart: "`",
    }) {
        this.name = name;
        this.parameters = parameters;
        this.options = options;
    }
    clone() {
        return new Arg(this.name, this.parameters.map(p => [...p]), this.options);
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
}
exports.Arg = Arg;
class ArgParser {
    constructor(text, options = {
        delimiters: [".", ":"],
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
        this.parameters.push([
            delimiter,
            parameter,
        ]);
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
    prase() {
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
        this.nodes.push(new Node(this.text.substring(startIndex, this.cursor), false, this.options));
    }
    matchChildren() {
        const startIndex = this.cursor;
        let bracketCount = 1;
        while (this.isNotEnd) {
            const char = this.text[this.cursor];
            if (char === this.options.childrenEnd) {
                bracketCount -= 1;
                if (bracketCount === 0) {
                    this.nodes.push(new Node(this.text.substring(startIndex, this.cursor), true, this.options));
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
//# sourceMappingURL=Parser.js.map