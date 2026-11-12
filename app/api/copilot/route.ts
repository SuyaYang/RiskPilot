import { NextResponse } from "next/server";
import { answerCopilot } from "@/lib/ai";
import { copilotFacts } from "@/lib/copilot";
import { currentPersonaId, inputHash, snapshot } from "@/lib/state";
import { load } from "@/lib/store";
export async function POST(req:Request) {
  const body=await req.json().catch(()=>null);
  if(!body || typeof body.question!=="string" || !body.question.trim() || body.question.length>800 || typeof body.page!=="string" || body.page.length>80 || (body.decisionId!==undefined&&typeof body.decisionId!=="string"))return NextResponse.json({error:"Please enter a question of up to 800 characters."},{status:400});
  if(!process.env.GEMINI_API_KEY)return NextResponse.json({error:"Gemini is not configured yet. Add GEMINI_API_KEY to the server's .env file, then restart the app."},{status:503});
  const personaId=await currentPersonaId(),store=load(),hash=inputHash(personaId,store);
  const decision=body.decisionId?store.decisions[body.decisionId]:undefined;
  if(body.decisionId&&(!decision||decision.personaId!==personaId))return NextResponse.json({error:"Purchase assessment not found."},{status:404});
  if(decision&&decision.inputHash!==hash)return NextResponse.json({error:"Your financial inputs changed. Assess the purchase again before asking about it."},{status:409});
  try {
    const result=await answerCopilot(body.question.trim(),body.page,copilotFacts(snapshot(personaId,store),decision));
    if(inputHash(personaId)!==hash)return NextResponse.json({error:"Your financial inputs changed. Please ask again using the refreshed page."},{status:409});
    return NextResponse.json({...result,asOf:snapshot(personaId,store).asOf});
  }catch{return NextResponse.json({error:"Gemini could not provide a verified answer. Check the key, model access or quota, then retry."},{status:502});}
}
