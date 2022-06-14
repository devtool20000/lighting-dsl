import {ArgParser} from '../lib/Parser'

describe("ArgParser",()=>{
  test("parse simple name",()=>{
    const arg = new ArgParser("name").parse()
    expect(arg.name).toBe("name")
  })

  test("parse name with parameters",()=>{
    const arg = new ArgParser("name.some").parse()
    expect(arg.name).toBe("name")
  })

  test("parse name with dash",()=>{
    const arg = new ArgParser("name-it.some").parse()
    expect(arg.name).toBe("name-it")
  })

  test("parse string name",()=>{
    const arg = new ArgParser("`test`").parse() 
    expect(arg.name).toBe("test")
  })

  test("parse string name with parameters",()=>{
    const arg = new ArgParser("`test`.test").parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".","test"]]) 
  })

  test("parse string name with 2 x parameters",()=>{
    const arg = new ArgParser("`test`.1.2").parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".","1"],[".","2"]]) 
  })

  test("parse quoted parameters",()=>{
    const arg = new ArgParser("test.`1.5`.2").parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".","1.5"],[".","2"]]) 
  })

  test("parse string name with 2 types of parameters",()=>{
    const arg = new ArgParser("`test`.1:2").parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".","1"],[":","2"]]) 
  })

  test("parse string with custom delimiter",()=>{
    const arg = new ArgParser("test.1#2",{delimiters:["#","."],quoteStart:"`",quoteEnd:"`"}).parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".","1"],["#","2"]]) 
  })

  test("tail delimiter",()=>{
    const arg = new ArgParser("test.").parse() 
    expect(arg.name).toBe("test")
    expect(arg.parameters).toStrictEqual([[".",""]]) 
  })

  test("missing name and tail delimiter",()=>{
    const arg = new ArgParser(".").parse() 
    expect(arg.name).toBe("")
    expect(arg.parameters).toStrictEqual([[".",""]]) 
  })
})