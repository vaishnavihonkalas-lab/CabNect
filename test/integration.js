// Destructive ONLY to a randomly named isolated database created by this test.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const fs=require('node:fs');
const {createApp}=require('../app');
test('MySQL end-to-end owner/driver workflows and access isolation',async t=>{
 const database='cabnect_test_'+Date.now();
 const settings={host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.TEST_DB_USER||process.env.DB_USER||'root',password:process.env.TEST_DB_PASSWORD??process.env.DB_PASSWORD??'',multipleStatements:true,decimalNumbers:true,timezone:'Z'};
 const admin=await mysql.createConnection(settings);let pool,server;
 try{
  const schema=fs.readFileSync(require('path').join(__dirname,'../database/schema.sql'),'utf8').replaceAll('cabnect',database);
  await admin.query(schema);
  pool=mysql.createPool({...settings,multipleStatements:false,database,connectionLimit:10});
  server=createApp(pool,{secret:'integration-test-secret-of-32-characters'}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  function client(){let cookie='',csrf='';return async function request(url,data){
   const r=await fetch(base+url,{method:data?'POST':'GET',redirect:'manual',headers:{cookie,...(data?{'content-type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams({...data,_csrf:csrf}):undefined});
   const set=r.headers.getSetCookie();if(set.length)cookie=set.map(x=>x.split(';')[0]).join('; ');
   const html=await r.text();const token=html.match(/name="_csrf" value="([^"]+)"/);if(token)csrf=token[1];return {status:r.status,html,location:r.headers.get('location')};
  };}
  const owner=client(),other=client(),driver=client(),secondDriver=client();
  const common={name:'Test',mobile_no:'9876543210',password:'test-password'};
  async function signup(c,role,email){await c('/'+role+'/signup');assert.equal((await c('/'+role+'/signup',{...common,email,company_name:'Demo',age:25,gender:'Other',license_no:email})).status,302);await c('/'+role+'/login');assert.equal((await c('/'+role+'/login',{email,password:common.password})).status,302);assert.equal((await c('/'+role+'/dashboard')).status,200);}
  await t.test('signup and login for two owners and two drivers',async()=>{await signup(owner,'owner','o@test.invalid');await signup(other,'owner','other@test.invalid');await signup(driver,'driver','d@test.invalid');await signup(secondDriver,'driver','d2@test.invalid');});
  await t.test('invalid input and duplicate account are rejected',async()=>{
   const c=client();await c('/owner/signup');assert.equal((await c('/owner/signup',{...common,email:'o@test.invalid',company_name:'Demo'})).status,409);
   assert.equal((await c('/owner/signup',{name:'A'})).status,400);
  });
  await t.test('owner adds vehicle',async()=>{assert.equal((await owner('/owner/add-vehicle',{vehicle_no:'MH12TEST',car_model:'Demo',car_type:'Sedan',fuel_type:'Petrol'})).status,302);});
  await t.test('vehicle editing/deletion enforce ownership and preserve linked history',async()=>{
   const vehicle={vehicle_id:1,vehicle_no:'MH12TEST',car_model:'Updated model',car_type:'Sedan',fuel_type:'Petrol'};
   assert.equal((await other('/owner/update-vehicle',vehicle)).status,400);
   assert.equal((await owner('/owner/update-vehicle',vehicle)).status,302);
   assert.equal((await other('/owner/delete-vehicle',{vehicle_id:1})).status,400);
   assert.equal((await owner('/owner/add-vehicle',{...vehicle,vehicle_no:'MH12DELETE'})).status,302);
   assert.equal((await owner('/owner/delete-vehicle',{vehicle_id:2})).status,302);
  });
  const trip={customer_name:'Customer',pickup_location:'Pune',drop_point:'Mumbai',mobile_no:'9876543210',distance_km:'20',vehicle_id:'1',trip_date:'2027-06-10',trip_time:'10:30'};
  await t.test('cross-owner vehicle use and invalid distance/date blocked',async()=>{
   assert.equal((await other('/owner/create-trip',trip)).status,400);
   for(const distance_km of ['-10','NaN','0','1.111'])assert.equal((await owner('/owner/create-trip',{...trip,distance_km})).status,400);
   assert.equal((await owner('/owner/create-trip',{...trip,trip_date:'2027-02-30'})).status,400);
  });
  await t.test('trip fare and UTC timestamp persisted',async()=>{
   assert.equal((await owner('/owner/create-trip',trip)).status,302);
   const [[row]]=await pool.query('SELECT fare,trip_datetime FROM trips WHERE trip_id=1');assert.equal(row.fare,300);assert.equal(row.trip_datetime.toISOString(),'2027-06-10T05:00:00.000Z');
  });
  await t.test('referenced vehicle cannot be deleted',async()=>{assert.equal((await owner('/owner/delete-vehicle',{vehicle_id:1})).status,409);});
  await t.test('cross-owner assignment blocked; valid assignment pays 60 percent',async()=>{
   assert.equal((await other('/owner/assign-trip',{trip_id:1,driver_id:1})).status,400);
   assert.equal((await owner('/owner/assign-trip',{trip_id:1,driver_id:1})).status,302);
   const [[row]]=await pool.query('SELECT driver_payment FROM assignments WHERE trip_id=1');assert.equal(row.driver_payment,180);
   assert.match((await driver('/driver/dashboard')).html,/Mark completed/);
  });
  await t.test('duplicate assignment and deletion while active blocked',async()=>{
   assert.equal((await owner('/owner/assign-trip',{trip_id:1,driver_id:2})).status,400);
   assert.equal((await driver('/driver/delete',{})).status,400);
   assert.equal((await owner('/owner/delete-all',{})).status,400);
  });
  await t.test('driver isolation, completion and availability recovery',async()=>{
   assert.equal((await secondDriver('/driver/complete-trip',{assignment_id:1})).status,400);
   assert.equal((await driver('/driver/complete-trip',{assignment_id:1})).status,302);
   assert.equal((await driver('/driver/complete-trip',{assignment_id:1})).status,400);
   const [[row]]=await pool.query('SELECT availability FROM drivers WHERE driver_id=1');assert.equal(row.availability,'available');
   assert.match((await driver('/driver/dashboard')).html,/Payment Earned/);
  });
  await t.test('cancellation releases assigned driver',async()=>{
   assert.equal((await owner('/owner/create-trip',trip)).status,302);
   assert.equal((await owner('/owner/assign-trip',{trip_id:2,driver_id:1})).status,302);
   assert.equal((await other('/owner/cancel-trip',{trip_id:2})).status,400);
   assert.equal((await owner('/owner/cancel-trip',{trip_id:2})).status,302);
   const [[row]]=await pool.query('SELECT availability FROM drivers WHERE driver_id=1');assert.equal(row.availability,'available');
  });
  await t.test('simultaneous assignment only succeeds once for a driver',async()=>{
   await owner('/owner/create-trip',trip);await owner('/owner/create-trip',trip);
   const results=await Promise.all([owner('/owner/assign-trip',{trip_id:3,driver_id:1}),owner('/owner/assign-trip',{trip_id:4,driver_id:1})]);
   assert.deepEqual(results.map(r=>r.status).sort(),[302,400]);
   const [[row]]=await pool.query("SELECT COUNT(*) AS n FROM assignments WHERE driver_id=1 AND status='assigned'");assert.equal(row.n,1);
   await owner('/owner/cancel-trip',{trip_id:3});await owner('/owner/cancel-trip',{trip_id:4});
  });
  await t.test('profile edits and password changes require current password',async()=>{
   const profile={...common,name:'Updated',email:'o@test.invalid',company_name:'Demo',password:''};
   assert.equal((await owner('/owner/update-profile',profile)).status,302);
   assert.equal((await owner('/owner/update-profile',{...profile,password:'new-password'})).status,400);
   assert.equal((await owner('/owner/update-profile',{...profile,password:'new-password',current_password:'test-password'})).status,302);
   await owner('/owner/logout',{});await owner('/owner/login');assert.equal((await owner('/owner/login',{email:profile.email,password:'new-password'})).status,302);await owner('/owner/dashboard');
  });
  await t.test('deactivation preserves history, removes login and blocks future access',async()=>{
   assert.equal((await driver('/driver/delete',{})).status,302);await driver('/driver/login');assert.equal((await driver('/driver/login',{email:'d@test.invalid',password:'test-password'})).status,401);
   assert.equal((await owner('/owner/delete-all',{})).status,302);
   assert.equal((await owner('/owner/dashboard')).status,302);
   const [[row]]=await pool.query('SELECT COUNT(*) AS n FROM assignments');assert.ok(row.n>0);
  });
 }finally{if(server)await new Promise(r=>server.close(r));if(pool)await pool.end();await admin.query('DROP DATABASE IF EXISTS '+database);await admin.end();}
});
