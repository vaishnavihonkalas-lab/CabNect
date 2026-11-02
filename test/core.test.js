const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ejs=require('ejs');
const v=require('../utils/validation');
const auth=require('../utils/auth');
const transaction=require('../utils/transaction');
const {createApp}=require('../app');
test('input validation rejects missing fields, bad IDs, email and password boundaries',()=>{
 for(const x of [undefined,null,'']) assert.throws(()=>v.text(x,'Name'));
 for(const x of [0,-1,'abc',1.5]) assert.throws(()=>v.id(x));
 assert.equal(v.id('2'),2);
 for(const x of [undefined,'short','é'.repeat(37)]) assert.throws(()=>v.password(x));
 assert.throws(()=>v.account({name:'A',mobile_no:'1234567890',email:'bad',company_name:'C'}));
});
test('calendar dates are validated and IST form values become UTC',()=>{
 assert.equal(v.dateTime('2027-06-10','10:30'),'2027-06-10 05:00:00');
 for(const [d,t] of [['2027-02-29','10:00'],['2027-02-30','10:00'],['bad','10:00'],['2027-01-01','25:00']])assert.throws(()=>v.dateTime(d,t));
});
test('bcrypt hashes are salted and verify only matching passwords',async()=>{
 const a=await auth.hashPassword('example-password'),b=await auth.hashPassword('example-password');
 assert.notEqual(a,b);assert.equal(await auth.comparePassword('example-password',a),true);assert.equal(await auth.comparePassword('wrong',a),false);
});
test('transactions commit success and roll back failure, always releasing',async()=>{
 for(const fail of [false,true]){
  const log=[];const connection={beginTransaction:async()=>log.push('begin'),commit:async()=>log.push('commit'),rollback:async()=>log.push('rollback'),release:()=>log.push('release')};
  const promise=transaction({getConnection:async()=>connection},async()=>{if(fail)throw Error('failure');return 7;});
  if(fail)await assert.rejects(promise);else assert.equal(await promise,7);
  assert.deepEqual(log,['begin',fail?'rollback':'commit','release']);
 }
});
test('all pages render with populated data and CSRF fields',()=>{
 const profile={name:'Test',email:'test@example.invalid',company_name:'Demo',mobile_no:'1234567890',license_no:'TEST'};
 const data={profile,csrf:'test-token',notice:'Done',msg:[],logoutPath:'/owner/logout',message:'Invalid',
 vehicles:[{vehicle_id:1,vehicle_no:'TEST'}],trips:[{trip_id:1,status:'assigned',customer_name:'T',pickup_location:'A',drop_point:'B',fare:300}],
 drivers:[{driver_id:1,name:'Driver',availability:'available',is_deleted:0}],
 assignments:[{assignment_id:1,trip_id:1,driver_name:'Driver',driver_payment:180,status:'assigned',pickup_location:'A',drop_point:'B',trip_datetime:'2027-06-10',vehicle_no:'TEST'}],
 completedTrips:[{pickup_location:'A',drop_point:'B',completed_at:'2027-06-10',driver_payment:180}]};
 for(const f of fs.readdirSync(path.join(__dirname,'../views'))){
  const html=ejs.render(fs.readFileSync(path.join(__dirname,'../views',f),'utf8'),data);
  for(const form of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi))assert.match(form[0],/name="_csrf"/,f);
 }
});
test('anonymous dashboard access redirects and POST without CSRF is blocked',async()=>{
 const db={query:async()=>{throw Error('No database query expected');}};
 const server=createApp(db,{secret:'test-secret-at-least-32-characters'}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const r=await fetch(url+'/owner/dashboard',{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/owner/login');
  const csrf=await fetch(url+'/owner/add-vehicle',{method:'POST',body:new URLSearchParams({vehicle_no:'X'})});assert.equal(csrf.status,403);
 }finally{await new Promise(r=>server.close(r));}
});
