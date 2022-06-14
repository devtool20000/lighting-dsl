import { Arg, parse, parseOne } from "../lib/Parser"

describe('Test on tailwind parsing', ()=> { 

  function expandClassFamily(arg:Arg,prefix:string,values:[string,string][]){
    for (const [suffix, to] of values) {
      arg.replace(`${prefix}${suffix}`,to)
    }
  }

  function expandCommonTailWindClassName(arg:Arg) {
    // replace all margin and padding
    arg.replace(/(p|m|px|py|pl|pr|pt|pb|mx|my|ml|mr|mt|mb)(\d+)/,"$1-$2")
    // text weight
    arg.replace("ib","inline-block")

    expandClassFamily(arg,"tw",[
      ["---","font-thin"],
      ["--","font-extralight"],
      ["-","font-light"],
      ["+","font-medium"],
      ["++","font-semibold"],
      ["+++","font-bold"],
      ["++++","font-extrabold"],
      ["+++++","font-black"],
    ])
    // text size
    expandClassFamily(arg,"ts",[
      ["--","text-xs"],
      ["-","text-sm"],
      ["+","text-lg"],
      ["++","text-xl"],
      ["+++","text-2xl"],
      ["++++","text-3xl"],
      ["+++++","text-4xl"],
      ["++++++","text-5xl"]
    ])

    // corner radius
    expandClassFamily(arg,"rd",[
      ["-","rounded-sm"],
      ["","rounded"],
      ["+","rounded-md"],
      ["++","rounded-lg"],
      ["+++","rounded-xl"],
      ["++++","rounded-2xl"],
      ["+++++","rounded-3xl"],
      ["f","rounded-full"]
    ])

    // shadow
    expandClassFamily(arg,"sd",[
      ["-","drop-shadow-sm"],
      ["","drop-shadow"],
      ["+","drop-shadow-md"],
      ["++","drop-shadow-lg"],
      ["+++","drop-shadow-xl"],
      ["++++","drop-shadow-2xl"]
    ])

    // TODO: text-color
    // TODO: bg-color
  }

  describe('expand Common Tailwind ClassName', ()=> { 
    test('expand font weight', ()=> { 
      const text = "t.tw++"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.font-semibold")
    })

    test('expand font weight', ()=> { 
      const text = "t.tw--"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.font-extralight")
    })

    test('expand font size', ()=> { 
      const text = "t.ts++"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.text-xl")
    })

    test('expand round corner', ()=> { 
      const text = "t.rdf"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.rounded-full")
    })

    test('expand round corner small', ()=> { 
      const text = "t.rd-"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.rounded-sm")
    })
    
    test('expand shadow', ()=> { 
      const text = "t.sd"
      const arg = parseOne(text).parseArg()
      expandCommonTailWindClassName(arg)
      expect(arg.toText()).toBe("t.drop-shadow")
    })
  })

  function parseFlexContianer(text:string) : {tag:string,classNames:string[],children:string[]} {
    const [container, ...children] = parse(text)
    const containerArg = container.parseArg()
    let classNames = ["flex"]

    if(containerArg.name === "r") {
      classNames.push("flex-row")
      // items alignment
      if(containerArg.pop("t")) {
        classNames.push("items-start")
      }
      else if(containerArg.pop("b")) {
        classNames.push("items-end")
      }
      else {
        classNames.push("items-center")
      }

      // items space
      containerArg.popApply(/s(\d+(\.\d+)?)/,(value)=>{
        classNames.push(`space-x-${value.substring(1)}`)
      })

      // divide
      containerArg.popApply("d",(value)=>{
        classNames.push(`divide-x`)
      })
    }
    else if(containerArg.name === "c") {
      classNames.push("flex-col")
      if(containerArg.pop("l")) {
        classNames.push("items-start")
      }
      else if(containerArg.pop("r")) {
        classNames.push("items-end")
      }
      else {
        classNames.push("items-center")
      }

      // items space
      containerArg.popApply(/s(\d+(\.\d+)?)/,(value)=>{
        classNames.push(`space-y-${value.substring(1)}`)
      })

      // divide
      containerArg.popApply("d",(value)=>{
        classNames.push(`divide-y`)
      })
    }

    expandCommonTailWindClassName(containerArg)
    classNames = [...classNames,...containerArg.all(".")]
    
   
    return {
      tag:"div",
      children:children.map(x=>x.text),
      classNames
    }
  }

  test('prase row', ()=> { 
    const text = "r.t.s1 a b c"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-row","items-start","space-x-1"],
      children:["a","b","c"]
    })
  })

  test('prase row space with quote', ()=> { 
    const text = "r.`s1.5`"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-row","items-center","space-x-1.5"],
      children:[]
    })
  })

  test('prase col space with quote', ()=> { 
    const text = "c.s1"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-col","items-center","space-y-1"],
      children:[]
    })
  })

  test('parse col', ()=> { 
    const text = "c.r a b c"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-col","items-end"],
      children:["a","b","c"]
    })
    
  })

  test('parse row divide', ()=> { 
    const text = "r.d"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-row","items-center","divide-x"],
      children:[]
    })
  })

  test('parse col divide', ()=> { 
    const text = "c.d"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-col","items-center","divide-y"],
      children:[]
    })
  })

  test('expand tailwind common classNames', ()=> { 
    const text = "c.r.p4.m5.pr5.mr-[12px]"
    expect(parseFlexContianer(text)).toStrictEqual({
      tag:"div",
      classNames:["flex","flex-col","items-end","p-4","m-5","pr-5","mr-[12px]"],
      children:[]
    })
  })

  test('space in row', ()=> { 
    const text = "r -- t"
    expect(parse(text)[1].parseArg().name).toStrictEqual("--")
  })

  
})