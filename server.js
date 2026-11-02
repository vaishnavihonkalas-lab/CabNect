const {createApp} = require('./app');
const db = require('./db');
const production = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
 console.error('Set SESSION_SECRET to at least 32 random characters in .env.'); process.exit(1);
}
if (production) { console.error('This release uses an in-memory session store. Configure a persistent store before production deployment.'); process.exit(1); }
async function start() {
 await db.query('SELECT 1');
 const app=createApp(db,{secret:process.env.SESSION_SECRET,production});
 const server=app.listen(Number(process.env.PORT || 3000),()=>console.log('CabNect: http://localhost:'+(process.env.PORT || 3000)));
 for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await db.end();process.exit(0);}));
}
start().catch(error=>{console.error('Startup failed. Check database setup and .env:',error.code || error.message);process.exit(1);});
