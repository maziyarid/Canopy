import test from "node:test";
import assert from "node:assert/strict";
import { buildTelegramRequest, publishTelegram, TelegramAdapterError } from "./telegram.server.ts";

test("builds text and single-photo Bot API requests", () => {
  assert.equal(buildTelegramRequest({chatId:"@channel",text:"hello"}).method,"sendMessage");
  const p=buildTelegramRequest({chatId:"@channel",text:"caption",media:[{kind:"image",url:"https://example.com/a.jpg"}]});
  assert.equal(p.method,"sendPhoto"); assert.equal((p.body as any).photo,"https://example.com/a.jpg");
});

test("builds media groups without claiming MTProto features", () => {
  const r=buildTelegramRequest({chatId:"-1001",media:[{kind:"image",url:"https://e/a.jpg"},{kind:"video",url:"https://e/b.mp4"}]});
  assert.equal(r.method,"sendMediaGroup"); assert.equal((r.body as any).media.length,2);
});

test("returns provider message ids from Bot API receipt", async () => {
  const fake=async () => new Response(JSON.stringify({ok:true,result:{message_id:42}}),{status:200,headers:{"content-type":"application/json"}});
  const r=await publishTelegram("token",{chatId:"@channel",text:"hi"},fake as typeof fetch);
  assert.deepEqual(r.providerMessageIds,["42"]); assert.equal(r.readBackSupported,false);
});

test("surfaces Telegram retry_after without retrying blindly", async () => {
  const fake=async () => new Response(JSON.stringify({ok:false,description:"Too Many Requests",parameters:{retry_after:9}}),{status:429,headers:{"content-type":"application/json"}});
  await assert.rejects(()=>publishTelegram("token",{chatId:"@channel",text:"hi"},fake as typeof fetch),(e:any)=>e instanceof TelegramAdapterError && e.retryAfterSeconds===9);
});
