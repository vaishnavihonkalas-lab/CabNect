const express = require('express');
const crypto = require('crypto');
const {hashPassword,comparePassword}=require('../utils/auth');
const v=require('../utils/validation');
const transaction=require('../utils/transaction');
module.exports=function accounts(db,role) {
 const router=express.Router(), table=role==='owner'?'owners':'drivers', key=role+'_id', driver=role==='driver';
 const loginView=driver?'driverLogin':'ownerLogin', signupView=driver?'driverSignup':'ownerSignup';
 router.get('/signup',(req,res)=>res.render(signupView));
 router.post('/signup',async(req,res)=>{
  const a=v.account(req.body,driver), hash=await hashPassword(v.password(req.body.password));
  if(driver) {
   const age=Number(req.body.age); if(!Number.isInteger(age)||age<18||age>100) v.bad('Driver age must be between 18 and 100.');
   await db.query('INSERT INTO drivers (name,age,gender,license_no,mobile_no,email,password) VALUES (?,?,?,?,?,?,?)',[a.name,age,v.text(req.body.gender,'Gender',30),a.license_no,a.mobile_no,a.email,hash]);
  } else await db.query('INSERT INTO owners (name,company_name,mobile_no,email,password) VALUES (?,?,?,?,?)',[a.name,a.company_name,a.mobile_no,a.email,hash]);
  req.session.notice='Account created. Please log in.';res.redirect(`/${role}/login`);
 });
 router.get('/login',(req,res)=>res.render(loginView,{msg:[]}));
 router.post('/login',async(req,res)=>{
  const email=v.text(req.body.email,'Email',254).toLowerCase();
  if(typeof req.body.password!=='string') v.bad('Password is required.');
  const [rows]=await db.query(`SELECT * FROM ${table} WHERE email = ? AND is_deleted = 0`,[email]);
  if(!rows.length || !await comparePassword(req.body.password,rows[0].password)) return res.status(401).render('error',{message:'Invalid email or password.'});
  await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
  const {password,...profile}=rows[0];req.session[role]=profile;
  req.session.csrf=crypto.randomBytes(32).toString('hex');
  await new Promise((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));
  res.redirect(`/${role}/dashboard`);
 });
 router.use(async(req,res,next)=>{
  if(!req.session[role]) return res.redirect(`/${role}/login`);
  const [rows]=await db.query(`SELECT ${key} FROM ${table} WHERE ${key} = ? AND is_deleted = 0`,[req.session[role][key]]);
  if(!rows.length) return req.session.destroy(()=>res.redirect(`/${role}/login`));
  next();
 });
 router.post('/update-profile',async(req,res)=>{
  const a=v.account(req.body,driver), currentId=req.session[role][key];
  // Password changes require the old password; profile-only changes do not.
  let hash;
  if(req.body.password) {
   const [rows]=await db.query(`SELECT password FROM ${table} WHERE ${key} = ?`,[currentId]);
   if(typeof req.body.current_password!=='string' || !await comparePassword(req.body.current_password,rows[0].password)) v.bad('Current password is incorrect.');
   hash=await hashPassword(v.password(req.body.password));
  }
  const fields=driver?['name','mobile_no','license_no','email']:['name','company_name','mobile_no','email'];
  const values=fields.map(f=>a[f]);
  if(hash){fields.push('password');values.push(hash);}
  await db.query(`UPDATE ${table} SET ${fields.map(f=>f+' = ?').join(',')} WHERE ${key} = ?`,[...values,currentId]);
  req.session[role]={...req.session[role],...a};req.session.notice='Profile updated.';res.redirect(`/${role}/dashboard`);
 });
 router.post(driver?'/delete':'/delete-all',async(req,res)=>{
  const currentId=req.session[role][key];
  await transaction(db,async c=>{
   await c.query(`SELECT ${key} FROM ${table} WHERE ${key} = ? FOR UPDATE`,[currentId]);
   const [active]=driver?await c.query("SELECT assignment_id FROM assignments WHERE driver_id = ? AND status = 'assigned'",[currentId]):await c.query("SELECT a.assignment_id FROM assignments a JOIN trips t ON t.trip_id = a.trip_id WHERE t.owner_id = ? AND a.status = 'assigned'",[currentId]);
   if(active.length) v.bad('Finish or cancel active assignments before deleting this account.');
   const fields=driver?"name='Deleted driver', email=NULL, mobile_no=NULL, license_no=NULL":"name='Deleted owner', email=NULL, mobile_no=NULL, company_name=''";
   await c.query(`UPDATE ${table} SET ${fields}, password='', is_deleted=1 WHERE ${key} = ?`,[currentId]);
  });
  req.session.destroy(err=>{if(err) return res.status(500).send('Could not clear session.');res.clearCookie('cabnect.sid');res.redirect(`/${role}/login`);});
 });
 router.post('/logout',(req,res,next)=>req.session.destroy(err=>{if(err)return next(err);res.clearCookie('cabnect.sid');res.redirect(`/${role}/login`);}));
 return router;
};
