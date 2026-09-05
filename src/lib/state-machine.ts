import { CaseState } from "./domain";
const transitions:Record<CaseState,CaseState[]>={INGESTED:["VALIDATING"],VALIDATING:["DIAGNOSING","ABSTAINED"],DIAGNOSING:["PLANNING","ABSTAINED","ESCALATED"],PLANNING:["POLICY_CHECK"],POLICY_CHECK:["ACTION_SCHEDULED","ABSTAINED","ESCALATED","CLOSED"],ACTION_SCHEDULED:["WAITING_FOR_OUTCOME"],WAITING_FOR_OUTCOME:["RECOVERED","PROMISE_PENDING","DIAGNOSING","ESCALATED","CLOSED"],PROMISE_PENDING:["RECOVERED","DIAGNOSING","ESCALATED"],RECOVERED:[],ABSTAINED:[],ESCALATED:[],CLOSED:[]};
export function transition(from:CaseState,to:CaseState,reason:string){if(!reason.trim())throw new Error("A state transition requires a reason code");if(!transitions[from].includes(to))throw new Error(`Invalid recovery transition: ${from} -> ${to}`);return to}

