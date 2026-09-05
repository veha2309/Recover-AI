import {describe,expect,it} from "vitest";import {createRunSchema,decisionSchema} from "../src/lib/domain";
describe("strict public contracts",()=>{it("rejects unknown run fields",()=>expect(createRunSchema.safeParse({seed:1,mode:"SIMULATION",production:true}).success).toBe(false));it("rejects hallucinated actions and extra fields",()=>expect(decisionSchema.safeParse({diagnosisCode:"X",confidenceBps:9000,evidenceIds:["E1"],action:"CHARGE_CARD",rationale:"x",tool:"shell"}).success).toBe(false));});

