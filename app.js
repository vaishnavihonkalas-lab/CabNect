const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
function createApp(db, options = {}) {
 const app = express();
 app.disable('x-powered-by');
 if (options.production) app.set('trust proxy', 1);
 app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, 'views'));
 app.use((req,res,next) => {
  res.set('X-Content-Type-Options','nosniff'); res.set('X-Frame-Options','DENY');
  res.set('Referrer-Policy','same-origin'); next();
 });
 app.use(express.static(path.join(__dirname, 'public')));
 app.use(express.urlencoded({extended:false, limit:'32kb'}));
 app.use(session({name:'cabnect.sid', secret: options.secret || crypto.randomBytes(32).toString('hex'),
  resave:false, saveUninitialized:false, cookie:{httpOnly:true, sameSite:'lax', secure:!!options.production, maxAge:7200000}}));
 app.use((req,res,next) => {
  req.session.csrf ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrf = req.session.csrf;
  res.locals.notice = req.session.notice || ''; delete req.session.notice;
  res.locals.logoutPath = req.session.owner ? '/owner/logout' : req.session.driver ? '/driver/logout' : null;
  res.set('Cache-Control','no-store');
  if (req.method === 'POST' && (typeof req.body?._csrf !== 'string' || req.body._csrf !== req.session.csrf)) return res.status(403).render('error',{message:'Your form expired. Go back, refresh the page and try again.'});
  next();
 });
 // Small single-process login throttle, keyed by IP. A shared limiter is needed for multiple instances.
 const attempts = new Map();
 const timer = setInterval(() => { const now=Date.now(); for(const [key,value] of attempts) if(value.until<=now) attempts.delete(key); },60000); timer.unref();
 app.use((req,res,next) => {
  if(req.method !== 'POST' || !/^\/(owner|driver)\/(login|signup)$/.test(req.path)) return next();
  const now=Date.now(), key=req.ip; let item=attempts.get(key);
  if(!item || item.until<=now) { item={count:0,until:now+600000}; attempts.set(key,item); }
  if(++item.count>30) return res.status(429).render('error',{message:'Too many login/signup attempts. Try again in 10 minutes.'});
  next();
 });
 app.get('/',(req,res)=>res.render('home'));
 app.get('/about',(req,res)=>res.render('about'));
 app.use('/owner',require('./routes/ownerRoutes')(db));
 app.use('/driver',require('./routes/driverRoutes')(db));
 app.use((req,res)=>res.status(404).render('error',{message:'Page not found.'}));
 app.use((err,req,res,next)=>{
  const status=err.status || (err.code === 'ER_DUP_ENTRY' ? 409 : err.code === 'ER_ROW_IS_REFERENCED_2' ? 409 : 500);
  if(status===500) console.error('Request failed:',err.code || err.message);
  const message=status===500?'Something went wrong. Please try again.':err.code==='ER_DUP_ENTRY'?'That email, license, vehicle or trip assignment already exists.':err.code==='ER_ROW_IS_REFERENCED_2'?'This record still has linked records.':err.message;
  res.status(status).render('error',{message});
 });
 return app;
}
module.exports = {createApp};
