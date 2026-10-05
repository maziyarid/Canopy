import test from "node:test";
import assert from "node:assert/strict";
import { publishGoogleApprovalProposal } from "./google-approval-bridge.server.ts";
import type { GoogleGovernedProposal } from "./google-governance-core.ts";

const proposal: GoogleGovernedProposal = {
  id:"p",projectId:"project-a",actorRef:"user-a",connectionProfileId:"profile",
  provider:"gsc",capability:"google.gsc.site.remove",action:"gsc.site.remove",
  resourceType:"gsc_site",resourceRef:"sc-domain:example.com",payload:{},
  payloadHash:"a".repeat(64),deterministicDiff:{operation:"delete",resourceRef:"sc-domain:example.com",fields:{}},
  snapshotHash:"",approvalPolicy:"ada",approvalRef:"",idempotencyKey:"i",status:"pending_approval",expiresAt:"2026-10-05T12:00:00Z",
};

test("approval bridge is loopback-only and sends metadata-only proposal", async () => {
  let observed:any;
  const fetchImpl=async (url:string|URL|Request,init?:RequestInit)=>{
    observed={url:String(url),init,body:JSON.parse(String(init?.body))};
    return new Response(JSON.stringify({accepted:true,duplicate:false,event_id:"event-1",state:"queued"}),{status:201,headers:{"Content-Type":"application/json"}});
  };
  const result=await publishGoogleApprovalProposal({
    proposal,siteKey:"example.com",
    env:{MSROBOT_BRIDGE_URL:"http://127.0.0.1:9110",MSROBOT_BRIDGE_TOKEN:"fixture-token"} as NodeJS.ProcessEnv,
    fetchImpl:fetchImpl as typeof fetch,
  });
  assert.equal(result.event_id,"event-1");
  assert.equal(observed.body.event_type,"ms_robot.action.proposal");
  assert.equal(observed.body.payload.payload_sha256,proposal.payloadHash);
  assert.equal("payload" in observed.body.payload,false);
  assert.equal(JSON.stringify(observed.body).includes("fixture-token"),false);
});

test("approval bridge rejects non-loopback destinations before network", async () => {
  let called=false;
  await assert.rejects(
    ()=>publishGoogleApprovalProposal({
      proposal,siteKey:"example.com",
      env:{MSROBOT_BRIDGE_URL:"https://bridge.example.com",MSROBOT_BRIDGE_TOKEN:"x"} as NodeJS.ProcessEnv,
      fetchImpl:(async()=>{called=true;return new Response("{}")}) as typeof fetch,
    }),
    /loopback/,
  );
  assert.equal(called,false);
});
