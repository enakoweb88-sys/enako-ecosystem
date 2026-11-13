const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('src/common/sentry-privacy.ts','utf8');
const context={exports:{},URL};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {privateDataCollection,scrubSentryError,scrubSentrySpan}=context.exports;
for(const key of ['userInfo','cookies','httpHeaders','urlQueryParams','databaseQueryData','queues','stackFrameVariables'])assert.equal(privateDataCollection[key],false,key);
assert.equal(privateDataCollection.httpBodies.length,0);
const privateValue='fixture-sensitive-value';
const event={type:undefined,event_id:'fixture-event',platform:'javascript',release:'fixture-release',environment:'verification',
 user:{email:privateValue,ip_address:privateValue},request:{headers:{Authorization:privateValue},data:privateValue,url:privateValue},
 extra:{document:privateValue},message:privateValue,breadcrumbs:[{message:privateValue}],contexts:{trace:{trace_id:'fixture-trace',span_id:'fixture-span',data:{password:privateValue}},customer:{name:privateValue}},
 tags:{customer:privateValue},exception:{values:[{type:'Error',value:privateValue,stacktrace:{frames:[{filename:'https://fixture.invalid/assets/index.js?secret='+privateValue,function:'fixtureFunction',lineno:12,colno:3,vars:{password:privateValue},context_line:privateValue}]}}]},
 debug_meta:{images:[{type:'sourcemap',debug_id:'fixture-debug',code_file:'https://fixture.invalid/assets/index.js?secret='+privateValue}]}};
const clean=scrubSentryError(event,'fixture-app');assert.ok(!JSON.stringify(clean).includes(privateValue));
assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno,12);assert.equal(clean.debug_meta.images[0].debug_id,'fixture-debug');
assert.equal(clean.request,undefined);assert.equal(clean.user,undefined);assert.equal(clean.extra,undefined);assert.equal(clean.breadcrumbs,undefined);
assert.equal(clean.tags.application,'fixture-app');
const marker='ENAKO Sentry verification fixture-123';event.exception.values[0].value=marker;assert.equal(scrubSentryError(event,'fixture-app').exception.values[0].value,marker);
const span=scrubSentrySpan({trace_id:'trace',span_id:'span',name:privateValue,start_timestamp:1,end_timestamp:2,status:'error',is_segment:true,
 attributes:{'db.query.text':privateValue,'gen_ai.input.messages':privateValue,'http.request.header.authorization':privateValue,'url.full':privateValue,'sentry.op':'http.server','http.response.status_code':500},links:[{data:privateValue}]});
assert.ok(!JSON.stringify(span).includes(privateValue));assert.equal(span.attributes['http.response.status_code'],500);
console.log('PASS Sentry collection settings, error/span privacy, source-map identity and safe verification markers');
