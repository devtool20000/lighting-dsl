import { Arg, concat, parse, Node } from "../lib/Parser";

describe("Node Operation", () => {
  describe("split", () => {
    test("split simple text", () => {
      const text = "a b c";
      const root = parse(text);
      const [first, rest] = root.split();
      expect(first.text).toBe("a");
      expect(rest.text).toBe("b c");
    });

    test("split text with nested", () => {
      const text = "a {r a b} c";
      const root = parse(text);
      const [first, rest] = root.split();
      expect(first.text).toBe("a");
      expect(rest.text).toBe("{r a b} c");
    });
  });

  describe("clone", () => {
    test("clone shallow", () => {
      const text = "a b";
      const root = parse(text);
      const cloned = root.clone();
      expect(root.text).toBe(cloned.text);
      expect(root).not.toBe(cloned);
      expect(root.children).not.toBe(cloned.children);
      expect(root.children[0]).not.toBe(cloned.children[0]);
      expect(root.children[0].arg).not.toBe(cloned.children[0].arg);
      expect(root.children[1]).not.toBe(cloned.children[1]);
      expect(root.children[1].arg).not.toBe(cloned.children[1].arg);
    });

    test("clone deep", () => {
      const text = "a {r a}";
      const root = parse(text);
      const cloned = root.clone();
      expect(root.text).toBe(cloned.text);
      expect(root.children[1].children[0]).not.toBe(
        cloned.children[1].children[0]
      );
    });
  });

  describe("concat", () => {
    test("simple concat", () => {
      const node = concat("a", "b");
      expect(node.text).toBe("a b");
    });

    test("concat with nested", () => {
      const node = concat("a", "b", "c d", "e");
      expect(node.text).toBe("a b c d e");
    });

    test("concat with nested and complex one", () => {
      const node = concat("a", "b", "{c d}", "e f");
      expect(node.text).toBe("a b {c d} e f");
    });

    test("concat with node, nested node and string", () => {
      const first = parse("a").children[0];
      const second = parse("b c");
      const node = concat(first, second, "{c d}", "e f");
      expect(node.text).toBe("a b c {c d} e f");
    });
  });

  describe("push", () => {
    test("push flat string", () => {
      const node = parse("a b");
      node.push("c", "d");
      expect(node.text).toBe("a b c d");
    });

    test("push several string", () => {
      const node = parse("a b");
      node.push("c d");
      expect(node.text).toBe("a b c d");
    });

    test("push nested string", () => {
      const node = parse("a b");
      node.push("{c}", "d");
      expect(node.text).toBe("a b {c} d");
    });

    test("push node", () => {
      const node = parse("a b");
      node.push(parse("c").children[0]);
      expect(node.text).toBe("a b c");
    });
  });

  describe("unshift", () => {
    test("unshift flat string", () => {
      const node = parse("a b");
      node.unshift("c", "d");
      expect(node.text).toBe("c d a b");
    });

    test("unshift several string", () => {
      const node = parse("a b");
      node.unshift("c d");
      expect(node.text).toBe("c d a b");
    });

    test("unshift nested string", () => {
      const node = parse("a b");
      node.unshift("{c}", "d");
      expect(node.text).toBe("{c} d a b");
    });

    test("unshift node", () => {
      const node = parse("a b");
      node.unshift(parse("c").children[0]);
      expect(node.text).toBe("c a b");
    });
  });

  describe("apply test", () => {
    test("apply first in flat list", () => {
      const node = parse("a b c");
      node.applyFirst((arg) => {
        arg.add("container");
      });
      expect(node.text).toBe("a.container b c");
    });

    test("apply first in nested list", () => {
      const node = parse("a b c {d} {e}");
      node.applyFirst((arg) => {
        arg.add("container");
      });
      expect(node.text).toBe("a.container b c {d} {e}");
    });

    test("apply first in fisrt nested element", () => {
      const node = parse("{a x x} b c d e");
      node.applyFirst((arg) => {
        arg.add("container");
      });
      expect(node.text).toBe("{a.container x x} b c d e");
    });

    test("apply flat rest", () => {
      const node = parse("a b c");
      node.applyRest((arg) => {
        arg.add("child");
      });
      expect(node.text).toBe("a b.child c.child");
    });

    test("apply nested rest", () => {
      const node = parse("{a} {b x} c");
      node.applyRest((arg) => {
        arg.add("child");
      });
      expect(node.text).toBe("{a} {b.child x} c.child");
    });

    test("apply to all direct children", () => {
      const node = parse("a b c");
      node.apply((arg) => {
        arg.add("all");
      });
      expect(node.text).toBe("a.all b.all c.all");
    });

    test("apply to all direct children with nested elements", () => {
      const node = parse("a {b x x} {c y {y}}");
      node.apply((arg) => {
        arg.add("all");
      });
      expect(node.text).toBe("a.all {b.all x x} {c.all y {y}}");
    });

    test("apply to all descendants with nested elements", () => {
      const node = parse("a {b x x} {c y {y yy}}");
      node.applyAll((arg) => {
        arg.add("all");
      });
      expect(node.text).toBe(
        "a.all {b.all x.all x.all} {c.all y.all {y.all yy.all}}"
      );
    });

    test("apply multiple functions", () => {
      const node = parse("r . . {c . . -- .} -- .");
      const populateEmptyDiv = (arg: Arg) => {
        arg.setNameIfNotExists("div");
        arg.popMany("", ".");
      };

      const addPaddingForContainer = (arg: Arg) => {
        if (arg.name === "r" || arg.name === "c") {
          arg.addIfNotExists("p-6", ".");
        }
      };

      node.applyAll(populateEmptyDiv, addPaddingForContainer);

      expect(node.text).toBe("r.p-6 div div {c.p-6 div div -- div} -- div");
    });

    test("integrated with multiple apply function", () => {
      const node = parse("r . . {c . . -- .} -- .");
      const populateEmptyDiv = (arg: Arg) => {
        arg.setNameIfNotExists("div");
        arg.popMany("", ".");
      };

      const addPaddingForContainer = (arg: Arg) => {
        if (arg.name === "r" || arg.name === "c") {
          arg.addIfNotExists("p-6", ".");
        }
      };

      const expandSpacerPaddingForContainer = (arg: Arg) => {
        if (arg.name === "--") {
          arg.rewrite("div.flex-1");
        }
      };

      const addSpaceForContainer = (arg: Arg) => {
        arg.addIfNotExists("space-x-2");
      };

      const addChild = (arg: Arg) => {
        arg.addIfNotExists("child");
      };

      node.applyAll(
        populateEmptyDiv,
        addPaddingForContainer,
        expandSpacerPaddingForContainer
      );
      node.applyFirst(addSpaceForContainer);

      node.applyRest(addChild);

      expect(node.text).toBe(
        "r.p-6.space-x-2 div.child div.child {c.p-6.child div div div.flex-1 div} div.flex-1.child div.child"
      );
    });
  });

  describe("arg parent test", () => {
    test("update parent node inside apply", () => {
      const node = parse("r . {r . . -- .} .");
      const targetNodes: Node[] = [];
      node.applyAll((arg) => {
        if (arg.name === "r") {
          arg.parent.push("x");
        }
      });
      expect(node.text).toBe("r . {r . . -- . x} . x");
    });

    test("update parent node after several operations", () => {
      const node = parse("{r} . . -- .");
      const merged = concat(". b", node, ".");
      merged.applyAll(arg=>{
        if(arg.name === "r") {
          arg.parent.push(". . .")
        }
      })
      merged.applyAll((arg)=>{
        if(arg.name === "") {
          arg.pop("")
          arg.addIfNotExists("test")
        }
      })

      expect(merged.text).toBe(".test b {r .test .test .test} .test .test -- .test .test")
    });
  });

  describe('remove', ()=> { 
    test('remove', ()=> { 
      const node = parse("r . . . {r . .}")
      node.remove((arg)=>{
        return arg.name === ""
      })

      expect(node.text).toBe("r {r . .}")
    })

    test('remove by string selector', ()=> { 
      const node = parse("r . . . {r . .}")
      node.remove(".")

      expect(node.text).toBe("r {r . .}")
    })

    test('remove all', ()=> { 
      const node = parse("r . . . {r . .}")
      node.removeAll((arg)=>{
        return arg.name === ""
      })

      expect(node.text).toBe("r {r}")
    })


    test('remove all by string selector', ()=> { 
      const node = parse("r . . . {r . .}")
      node.removeAll(".")

      expect(node.text).toBe("r {r}")
    })
  })

  describe("select",()=>{
    test('select items', ()=> { 
      const node = parse("r . . . {r .test .}")
      expect(node.selectAll(".").text).toBe(". . . .")
    })

    test('select items replace items', ()=> { 
      const node = parse("r . . . {r .test .}")
      node.selectAll(".").apply((arg)=>{
        arg.rewrite("div")
      })
      expect(node.text).toBe("r div div div {r .test div}")
    })

    test('select items replace items with name', ()=> { 
      const node = parse("r . . . {r .test .}")
      node.selectAll("").apply((arg)=>{
        arg.setNameIfNotExists("div")
        arg.popMany("")
      })
      expect(node.text).toBe("r div div div {r div.test div}")
    })

    test('use select to create new Node', ()=> { 
      const node = parse("r i:name i:age")
      const fields = node.selectAll("i").clone().apply((arg)=>{
        const name = arg.pop(/.*/,":") || "field"
        arg.rewrite(name)
      })
      
      expect(node.text).toBe("r i:name i:age")
      expect(concat("us",fields).text).toBe("us name age")
    })
  })
});
