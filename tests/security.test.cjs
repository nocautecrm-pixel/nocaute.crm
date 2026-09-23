const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { deflateRawSync } = require("node:zlib");
const root = path.resolve(__dirname,"..");

function loader(mocks={}) {
  const cache=new Map();
  function load(name) {
    if (Object.hasOwn(mocks,name)) return mocks[name];
    if (!name.startsWith("@/")) return require(name);
    const file=path.join(root,"src",name.slice(2)+".ts");
    if(cache.has(file)) return cache.get(file);
    const out={}; cache.set(file,out);
    const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(js,{exports:out,require:load,Buffer,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,AbortSignal,ReadableStream,fetch:global.fetch,process,console,setTimeout,clearTimeout},{filename:file});
    return out;
  }
  return load;
}

function zip(entries) {
  const locals=[],directory=[];let offset=0;
  for(const entry of entries) {
    const name=Buffer.from(entry.name), raw=Buffer.from(entry.content);
    const compressed=deflateRawSync(raw);const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt16LE(name.length,26);
    local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(entry.declared??raw.length,22);
    locals.push(local,name,compressed);const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);
    central.writeUInt32LE(entry.declared??raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    directory.push(central,name);offset+=local.length+name.length+compressed.length;
  }
  const cd=Buffer.concat(directory),eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50);
  eocd.writeUInt16LE(entries.length,10);eocd.writeUInt32LE(cd.length,12);eocd.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,cd,eocd]);
}

test("XLSX legitimate input, lying ZIP sizes, sparse columns and truncated input",()=>{
  const {xlsxBytesToGrid}=loader()("@/lib/customers/xlsx-grid");
  const entry=content=>({name:"xl/worksheets/sheet1.xml",content});
  const sheet='<worksheet><row><c r="A1" t="inlineStr"><is><t>Nome</t></is></c><c r="B1" t="inlineStr"><is><t>Telefone</t></is></c></row></worksheet>';
  assert.equal(xlsxBytesToGrid(zip([entry(sheet)]))[0][0],"Nome");
  assert.throws(()=>xlsxBytesToGrid(zip([{...entry("x".repeat(8_000_001)),declared:1}])));
  assert.throws(()=>xlsxBytesToGrid(zip([entry(sheet.replace('r="A1"','r="ZZZ1"'))])),/colunas/);
  assert.throws(()=>xlsxBytesToGrid(zip([entry(sheet)]).subarray(0,40)));
  assert.throws(()=>xlsxBytesToGrid(zip([entry(sheet),entry(sheet)])),/duplicadas/);
  assert.throws(()=>xlsxBytesToGrid(zip([entry('<worksheet>'+ '<row>'.repeat(100000))])));
  for (const type of ['', ' t="s"', ' t="inlineStr"']) {
    const tag = type.includes('inlineStr') ? 't' : 'v';
    assert.throws(()=>xlsxBytesToGrid(zip([entry(`<worksheet><row><c r="A1"${type}>` + `<${tag}>`.repeat(16000) + '</c></row></worksheet>')])));
  }
});

test("CSV limits reject oversized rows and preserve ordinary quoted columns",()=>{
  const {textToGrid}=loader()("@/lib/customers/parse-sheet");
  assert.equal(textToGrid('Nome;Telefone\n"Ana; Silva";+5511999999999')[1][0],"Ana; Silva");
  assert.throws(()=>textToGrid("a;".repeat(200)),/limite/);
  assert.throws(()=>textToGrid("a\n".repeat(6000)),/linhas/);
});

function deliveryDb() {
  let state=null,failSave=false; const record={calls:0};
  const db={rpc:async()=>({data:state?{state,wamid:state==="accepted"?"wamid-1":null}:{state:"claimed",phone:"+5511999999999",name:"Current name"}}),
    from:()=>({update(values){
      const chain={eq(){return chain},select(){return chain},single:async()=>{
        if(failSave)return {error:{message:"write failed"}};
        state=values.state;return {data:{campaign_job_id:"job"}};
      },then(resolve){state=values.state;return Promise.resolve({error:null}).then(resolve)}};return chain;
    }})};
  return {db,record,setState:s=>{state=s},failSave:()=>{failSave=true},state:()=>state};
}

test("accepted delivery replays its receipt; ambiguity never re-sends",async()=>{
  const fake=deliveryDb();
  const {guardedDelivery}=loader({"@/lib/supabase/admin":{createSupabaseAdminClient:()=>fake.db}})("@/server/compliance/delivery-guard");
  const ids={restaurantId:"r",campaignId:"c",campaignJobId:"j",customerId:"u"};
  const send=async customer=>{assert.equal(customer.phone,"+5511999999999");fake.record.calls++;return {wamid:"wamid-1"}};
  assert.equal(await guardedDelivery(ids,"initial",send),"wamid-1");
  assert.equal(await guardedDelivery(ids,"initial",send),"wamid-1");
  assert.equal(fake.record.calls,1);
  fake.setState(null);fake.failSave();
  await assert.rejects(guardedDelivery(ids,"offer_cta",send),/conciliação/);
  assert.equal(fake.state(),"uncertain");
  await assert.rejects(guardedDelivery(ids,"offer_cta",send),/bloqueado/);
  assert.equal(fake.record.calls,2);
  for(const state of ["started","suppressed","held"]) {
    fake.setState(state);await assert.rejects(guardedDelivery(ids,"initial",send));
  }
  assert.equal(fake.record.calls,2);
});

test("bounded body ignores lying/missing Content-Length and cancels overflow",async()=>{
  const {readBoundedBody}=loader()("@/lib/customers/import-limits");
  let canceled=false;
  const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(10));},cancel(){canceled=true;}});
  await assert.rejects(readBoundedBody(body,15),/limite/);
  assert.equal(canceled,true);
});

test("AI requires tenant budget and strips model-invented consent",async()=>{
  let calls=0;
  const previousFetch=global.fetch;
  const previousKey=process.env.CUSTOMER_IMPORT_AI_KEY;
  process.env.CUSTOMER_IMPORT_AI_KEY="synthetic-test-key";
  global.fetch=async(_url,options)=>{
    calls++;const body=JSON.parse(options.body);assert.equal(body.max_tokens,4096);assert.ok(options.signal);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({documentType:"customers",customers:[{name:"Ana",phone:"11999999999",optIn:true,optInSource:"delivery",optInProof:"fabricated"}]})}}]}));
  };
  try {
    const denied=loader({"@/server/compliance/import-budget":{withImportBudget:async()=>{throw new Error("budget denied")}}})("@/lib/customers/import-agent/llm");
    await assert.rejects(denied.extractCustomersWithAiText("customer list"),/budget denied/);assert.equal(calls,0);
    const allowed=loader({"@/server/compliance/import-budget":{withImportBudget:async(_kind,work)=>work()}})("@/lib/customers/import-agent/llm");
    const parsed=await allowed.extractCustomersWithAiText("customer list");
    assert.equal(parsed.rows[0].optIn,false);assert.equal(parsed.rows[0].optInProof,null);
    await assert.rejects(allowed.extractCustomersWithAiText("x".repeat(60001)),/grande/);
    assert.equal(calls,1);
  } finally { global.fetch=previousFetch;if(previousKey===undefined)delete process.env.CUSTOMER_IMPORT_AI_KEY;else process.env.CUSTOMER_IMPORT_AI_KEY=previousKey; }
});

test("checkout serializes requests, reuses completion, and holds uncertain creation",async()=>{
  let attempt=null,providerCalls=0,failProvider=false;
  const db={rpc:()=>({throwOnError:async()=>({data:null,error:null})}),from(table){
    let op="select",values;let result;
    function execute(){
      if(result)return result;
      if(table==="checkout_attempts") {
        if(op==="insert") {
          if(attempt)return result={error:{code:"23505"}};
          attempt={...values,state:"started"};return result={error:null};
        }
        if(op==="update"){attempt={...attempt,...values};return result={data:{restaurant_id:"tenant"},error:null}}
        return result={data:attempt,error:null};
      }
      if(table==="restaurants")return result={data:{id:"tenant",owner_user_id:"owner",name:"Test",asaas_customer_id:"known-customer",billing_cpf_cnpj:"synthetic"},error:null};
      return result={data:null,error:null};
    }
    const chain={select(){return chain},eq(){return chain},insert(v){op="insert";values=v;return chain},update(v){op="update";values=v;return chain},
      maybeSingle:async()=>execute(),single:async()=>execute(),throwOnError:async()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}};
    return chain;
  }};
  const mocks={
    "@/lib/config":{isDemoMode:()=>false,requireLiveBackend(){},BackendUnavailableError:class extends Error{}},
    "@/lib/supabase/admin":{createSupabaseAdminClient:()=>db},
    "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:"owner",email:"test@example.invalid"}}})}})},
    "@/lib/billing/asaas-config":{isAsaasConfigured:()=>true},
    "@/server/billing/asaas-client":{AsaasApiError:class extends Error{},AsaasNotConfiguredError:class extends Error{},
      createAsaasSubscription:async()=>{providerCalls++;await new Promise(resolve=>setTimeout(resolve,10));if(failProvider)throw new Error("response lost");return {id:"sub-one"}},
      listSubscriptionPayments:async()=>[{id:"pay-one",invoiceUrl:"https://example.invalid/invoice"}]},
  };
  const {startPlanCheckout}=loader(mocks)("@/server/billing/asaas-gateway");
  const input={restaurantId:"tenant",planSlug:"basico",billingType:"PIX",cpfCnpj:"12345678901"};
  const concurrent=await Promise.allSettled([startPlanCheckout(input),startPlanCheckout(input)]);
  assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(providerCalls,1);
  assert.equal((await startPlanCheckout(input)).subscriptionId,"sub-one");
  assert.equal(providerCalls,1);
  attempt=null;failProvider=true;
  await assert.rejects(startPlanCheckout(input),/response lost/);
  assert.equal(attempt.state,"uncertain");
  await assert.rejects(startPlanCheckout(input),/pendente/);
  assert.equal(providerCalls,2);
});

test("import analysis authenticates before reading the body or invoking a parser",async()=>{
  class AuthRequiredError extends Error {}
  let reads=0,parses=0;
  const load=loader({
    "next/cache":{revalidatePath(){}},
    "next/server":{NextResponse:{json:(data,options={})=>({data,status:options.status??200})}},
    "@/lib/customers/import-agent/normalize-rows":{},
    "@/lib/customers/import-agent/llm":{isImportAiReady:()=>true},
    "@/lib/customers/import-file":{parseCustomerImportFile:async()=>{parses++}},
    "@/server/customer-board":{},"@/server/customers":{},
    "@/server/tenant":{AuthRequiredError,StoreRequiredError:class extends Error{},getCurrentRestaurantId:async()=>{throw new AuthRequiredError()}},
    "@/server/compliance/import-budget":{ImportBudgetError:class extends Error{},withImportTenant:(_tenant,work)=>work(),withImportBudget:(_kind,work)=>work()},
  });
  const {POST}=load("@/app/api/customers/import/route");
  const result=await POST({get body(){reads++;return null}});
  assert.equal(result.status,401);assert.equal(reads,0);assert.equal(parses,0);
});

test("stale customer edit cannot invoke consent restoration",async()=>{
  let restores=0;
  const row={id:"u",name:"Ana",phone:"+5511999999999",opt_in:false,opt_in_source:"recusa_whatsapp",opt_in_proof:"supressao-persistida",opt_in_at:"2026-09-15T12:00:00Z",last_purchase_at:null,order_count:0};
  const db={rpc:async(_name,args)=>{restores++;assert.equal(args.p_expected_revoked_at,row.opt_in_at);return {data:{...row,opt_in:true},error:null}},from(){
    const chain={select(){return chain},eq(){return chain},update(){return chain},maybeSingle:async()=>({data:row,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
    return chain;
  }};
  const {updateCustomer}=loader({"next/headers":{},"@/lib/config":{isDemoMode:()=>false},"@/lib/supabase/admin":{createSupabaseAdminClient:()=>db}})("@/server/customers");
  const input={name:"Ana edited",phone:row.phone,optIn:true,optInSource:"balcao",optInProof:"old proof"};
  await assert.rejects(updateCustomer("r","u",input),/consentimento foi revogado/);
  assert.equal(restores,0);
  await updateCustomer("r","u",{...input,optInProof:"new explicit authorization",restoreConsentRevokedAt:row.opt_in_at});
  assert.equal(restores,1);
});

test("send worker retries quota persistence without another provider request",async()=>{
  const fake=deliveryDb();let settlements=0;
  const attemptFrom=fake.db.from;
  fake.db.from=table=>{
    if(table==="delivery_attempts")return attemptFrom(table);
    const chain={select(){return chain},eq(){return chain},in(){return chain},update(){return chain},maybeSingle:async()=>({data:{status:"running",template_name:"optin_confirmacao",template_language:"pt_BR",establishment_name:"Test"},error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve)}};
    return chain;
  };
  const send=async()=>{fake.record.calls++;return {wamid:"wamid-1"}};
  const {processCampaignSend}=loader({
    "@/lib/supabase/admin":{createSupabaseAdminClient:()=>fake.db},
    "@/server/whatsapp-account":{getConnectedWhatsAppAccount:async()=>({})},
    "@/lib/whatsapp/service":{sendOptInTemplate:send,sendReturnTemplate:send},
    "@/server/billing/quota-rpc":{consumeCampaignLead:async()=>{if(++settlements===1)throw new Error("settlement unavailable")},refundCampaignLead:async()=>{throw new Error("unexpected refund")}},
  })("@/workers/send-campaign");
  const job={data:{restaurantId:"r",campaignId:"c",campaignJobId:"j",customerId:"u"}};
  await assert.rejects(processCampaignSend(job),/settlement unavailable/);
  await processCampaignSend(job);
  assert.equal(fake.record.calls,1);assert.equal(settlements,2);
});

test("unconfigured worker reports readiness 503 and liveness 200",()=>{
  let handler;
  const previous=process.env.PORT;process.env.PORT="12345";
  try {
    loader({
      "http":{createServer:fn=>{handler=fn;return {listen(){}}}},
      "bullmq":{Worker:class {constructor(){throw new Error("unexpected worker start")}}},
      "@/lib/config":{missingWorkerEnv:()=>["REDIS_URL"],isRedisConfigured:()=>false},
      "@/lib/queue/connection":{},"@/lib/queue/queues":{},
      "@/workers/send-offer":{},"@/workers/send-campaign":{},"@/workers/ingest-webhook":{},"@/lib/supabase/admin":{},
    })("@/workers/index");
    for(const [url,expected] of [["/",503],["/ready",503],["/live",200]]){
      let status,payload;handler({url},{writeHead:s=>{status=s},end:s=>{payload=JSON.parse(s)}});
      assert.equal(status,expected);assert.equal(payload.ready,false);
    }
  }finally{if(previous===undefined)delete process.env.PORT;else process.env.PORT=previous;}
});
