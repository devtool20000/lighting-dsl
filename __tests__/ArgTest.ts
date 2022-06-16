import { Arg, parse } from "../lib/Parser";

describe("test Arg", () => {

  test("set name when empty",()=>{
    const arg = new Arg("",[[".","a"]])
    arg.setNameIfNotExists("set")
    expect(arg.name).toBe("set")

  })

  test("set name when name not empty should change nothing",()=>{
    const arg = new Arg("name",[[".","a"]])
    arg.setNameIfNotExists("set")
    expect(arg.name).toBe("name")
  })

  test("add",()=>{
    const arg = new Arg("name",[[".","a"]])
    arg.add("nice")
    expect(arg.parameters).toStrictEqual([[".","a"],[".","nice"]])

  })

  test("addIfNotExists",()=>{
    const arg = new Arg("name",[[".","a"]])
    arg.addIfNotExists("nice")
    arg.addIfNotExists("a")
    expect(arg.parameters).toStrictEqual([[".","a"],[".","nice"]])

  })

  test("pop string",()=>{
    const arg = new Arg("name",[[".","a"]])
    const value = arg.pop("a",".")
    expect(value).toBe("a")
    expect(arg.parameters).toStrictEqual([])
  }) 

  test("pop regex",()=>{
    const arg = new Arg("name",[[".","a"],[".","-"]])
    const value = arg.pop(/\w+/)
    expect(value).toBe("a")
    expect(arg.parameters).toStrictEqual([[".","-"]])
  }) 

  test("popMany regex",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"],[".","-"]])
    const value = arg.popMany(/\w+/)
    expect(value).toStrictEqual(["a","b"])
    expect(arg.parameters).toStrictEqual([[".","-"]])
  }) 

  test("popApply",()=>{
    const arg = new Arg("name",[[".","a"]])
    arg.popApply("a",()=>{
      arg.add("b")
    })
    expect(arg.parameters).toStrictEqual([[".","b"]])
  }) 

  test("replace with string",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"]])
    arg.replace("a","x")
    expect(arg.parameters).toStrictEqual([[".","x"],[".","b"]])
  }) 

  test("replace with multi delimiter",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"],[":","content"]])
    arg.replace("a","x")
    expect(arg.parameters).toStrictEqual([[".","x"],[".","b"],[":","content"]])
  }) 

  test("replace with string[]",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"]])
    arg.replace("a",["c","d"])
    expect(arg.parameters).toStrictEqual([[".","c"],[".","d"],[".","b"]])
  })
  
  test("replace with fn return string",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"]])
    arg.replace("a",(x)=>x+"b")
    expect(arg.parameters).toStrictEqual([[".","ab"],[".","b"]])
  })

  test("replace with fn return string[]",()=>{
    const arg = new Arg("name",[[".","a"],[".","b"]])
    arg.replace("a",(x)=>[x+"b","c"])
    expect(arg.parameters).toStrictEqual([[".","ab"],[".","c"],[".","b"]])
  })

  test("replace regex",()=>{
    const arg = new Arg("name",[[".","p6"],[".","m4"]])
    arg.replace(/[a-z]\d+/,"changed")
    expect(arg.parameters).toStrictEqual([[".","changed"],[".","changed"]])
  })

  test("replace regex with placeholder",()=>{
    const arg = new Arg("name",[[".","p6"],[".","m4"]])
    arg.replace(/([a-z])(\d+)/,"$1-$2")
    expect(arg.parameters).toStrictEqual([[".","p-6"],[".","m-4"]])
  })

  test("get all",()=>{
    const arg = new Arg("name",[[".","p6"],[".","m4"],[":","content"]])
    arg.pop("p6")
    expect(arg.all()).toStrictEqual(["m4"])
    expect(arg.all(":")).toStrictEqual(["content"])
  })

  test("get one",()=>{
    const arg = new Arg("name",[[".","p6"],[".","m4"],[":","content"]])
    expect(arg.one(":")).toStrictEqual("content")
    expect(arg.one("?")).toStrictEqual(null)
    expect(()=>arg.one(".")).toThrow(Error)
  })

  describe("toText",()=>{
    test("normal ",()=>{
      const arg = new Arg("name",[[".","p6"],[".","m4"],[":","content"]])
      expect(arg.toText()).toBe("name.p6.m4:content")
    })

    test("escape name",()=>{
      const arg = new Arg("name different",[[".","p6"],[".","m4"],[":","content"]])
      expect(arg.toText()).toBe("`name different`.p6.m4:content")
    })

    test("escape parameters",()=>{
      const arg = new Arg("name",[[".","p6.test"],[".","m4"],[":","content"]])
      expect(arg.toText()).toBe("name.`p6.test`.m4:content")
    })
  })

  describe("transform name",()=>{
    test("single string transform ",()=>{
      const arg = new Arg("name",[])
      arg.transformName("name","changed")
      expect(arg.name).toBe("changed")
    })

    test("single regex transform ",()=>{
      const arg = new Arg("name",[])
      arg.transformName(/n(.*)/,"k$1")
      expect(arg.name).toBe("kame")
    })

    test("single fn transform ",()=>{
      const arg = new Arg("name",[])
      arg.transformName(/n(.*)/,()=>"new")
      expect(arg.name).toBe("new")
    })

    test("multiple transform ",()=>{
      const arg1 = new Arg("name",[])
      const arg2 = new Arg("t",[])
      const arg3 = new Arg("a",[])
      const transforms = [
        ["a","article"],
        ["t","test"],
        [/n(.*)/,()=>"new"],
      ] as any
      arg1.transformName(transforms)
      arg2.transformName(transforms)
      arg3.transformName(transforms)
      expect(arg1.name).toBe("new")
      expect(arg2.name).toBe("test")
      expect(arg3.name).toBe("article")
    })
  })

  describe('rewrite', ()=> { 
    test('rewrite whole arg', ()=> { 
      const arg = new Arg("name.class",[])
      arg.rewrite("changed.changed")
      expect(arg.toText()).toBe("changed.changed")
    })
  })
  
});
