import { parse } from "../lib/Parser";

describe("test parse tree", () => {
  test("single leaf", () => {
    const nodes = parse("name");
    expect(nodes[0].text).toBe("name");
    expect(nodes[0].isNested).toBe(false);
  });

  test("multiple leaf", () => {
    const nodes = parse("name age");
    expect(nodes[0].text).toBe("name");
    expect(nodes[0].isNested).toBe(false);
    expect(nodes[1].text).toBe("age");
    expect(nodes[1].isNested).toBe(false);
  });

  test("single leaf with string", () => {
    const nodes = parse("name:`some`");
    expect(nodes[0].text).toBe("name:`some`");
    expect(nodes[0].isNested).toBe(false);
  });

  describe("string not complete", () => {
    test("string not compelete at end", () => {
      const stringNotComplete = () => {
        parse("name:`some age.`some`");
      };
      expect(stringNotComplete).toThrow(Error);
    });

    test("string not compelete in middle", () => {
      const stringNotComplete = () => {
        parse("name:`some age. some");
      };
      expect(stringNotComplete).toThrow(Error);
    });
  });

  test("single nested children", () => {
    const nodes = parse("{a b c}");

    expect(nodes[0].text).toBe("a b c");
    expect(nodes[0].isNested).toBe(true);
  });

  test("leaf and nested children", () => {
    const nodes = parse("{a b c}  name");

    expect(nodes[0].text).toBe("a b c");
    expect(nodes[0].isNested).toBe(true);
    expect(nodes[1].text).toBe("name");
    expect(nodes[1].isNested).toBe(false);
  });

  test("leaf and nested children", () => {
    const nodes = parse("name {a b c}");

    expect(nodes[0].text).toBe("name");
    expect(nodes[0].isNested).toBe(false);
    expect(nodes[1].text).toBe("a b c");
    expect(nodes[1].isNested).toBe(true);
  });

  test("nested children with string", () => {
    const nodes = parse("{a b:`some{` c}");

    expect(nodes[0].text).toBe("a b:`some{` c");
    expect(nodes[0].isNested).toBe(true);
  });

  test("nested children with nested children", () => {
    const nodes = parse("{a b {nested a b c} c}");

    expect(nodes[0].text).toBe("a b {nested a b c} c");
    expect(nodes[0].isNested).toBe(true);
  });

  test("nested children with nested children at end", () => {
    const nodes = parse("{a {n b}}");

    expect(nodes[0].text).toBe("a {n b}");
    expect(nodes[0].isNested).toBe(true);
  });

  test("nested children with nested x 2 children", () => {
    const nodes = parse("{a b {nested a b c {n2 a} d} c}");

    expect(nodes[0].text).toBe("a b {nested a b c {n2 a} d} c");
    expect(nodes[0].isNested).toBe(true);
  });

  test("nested children missing close bracket", () => {
    
    const MissingCloseBracket = ()=>{
      parse("{a b {nested a b c {n2 a} d} c");
    }
    expect(MissingCloseBracket).toThrow(Error)
  
  });

  describe("test parse node children", () => {
    test("access children",()=>{
      const nodes = parse("a b {nested a b c} c");
      const children = nodes[2].children
      expect(children[0].text).toBe("nested")
    })

    test("access leaf children, should throw errors",()=>{
      
      expect(()=>{
        const nodes = parse("a b {nested a b c} c");
        const children = nodes[1].children
      }).toThrow(Error)
    })
  });
  
});
