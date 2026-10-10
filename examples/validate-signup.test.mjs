import http from "node:http";
import assert from "node:assert";
import { checkEmail } from "./validate-signup.mjs";
const cases = {
  ok:        [200, {allowed:true,disposable:false,risk_score:"LOW"}],
  inconcl:   [200, {allowed:true,disposable:false,reason:"DNS_INCONCLUSIVE",risk_score:"MEDIUM"}],
  disp:      [400, {allowed:false,disposable:true,reason:"DISPOSABLE_DOMAIN",risk_score:"HIGH"}],
  nodomain:  [400, {allowed:false,disposable:false,reason:"DOMAIN_NOT_FOUND",risk_score:"HIGH"}],
  invalid:   [400, {error:"bad",code:"INVALID_EMAIL"}],
  unauth:    [401, {error:"Invalid customer API key."}],
  rate:      [429, {error:"x",code:"RATE_LIMITED",retry_after:1}],
  down:      [503, {error:"x"}],
  garbage:   [502, null],
};
const srv = http.createServer((req,res)=>{
  let b=""; req.on("data",d=>b+=d); req.on("end",()=>{
    const email=JSON.parse(b).email; const k=email.split("@")[0];
    assert.equal(req.headers.authorization,"Bearer KEY");
    if(k==="slow") return setTimeout(()=>res.end("{}"),3000);
    const [s,body]=cases[k]; res.statusCode=s; res.setHeader("content-type","application/json"); res.end(body===null?"<html>":JSON.stringify(body));
  });
}).listen(0, async ()=>{
  const baseUrl=`http://127.0.0.1:${srv.address().port}/api/v1`; const o={apiKey:"KEY",baseUrl,timeoutMs:300};
  const r=async k=>checkEmail(`${k}@example.com`,o);
  assert.equal((await r("ok")).ok,true);
  assert.equal((await r("inconcl")).ok,true);
  assert.deepEqual(await r("disp"),{ok:false,reason:"DISPOSABLE_DOMAIN"});
  assert.deepEqual(await r("nodomain"),{ok:false,reason:"DOMAIN_NOT_FOUND"});
  assert.deepEqual(await r("invalid"),{ok:false,reason:"INVALID_EMAIL"});
  for (const k of ["unauth","rate","down","garbage","slow"]) assert.equal((await r(k)).ok,true,k);
  assert.equal((await checkEmail("a@b.com",{apiKey:"KEY",baseUrl:"http://127.0.0.1:1/x",timeoutMs:300})).ok,true);
  console.log("all mock tests passed"); srv.close();
});
