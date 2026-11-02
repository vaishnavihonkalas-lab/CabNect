const accounts=require('./accounts');
const v=require('../utils/validation');
const transaction=require('../utils/transaction');
module.exports=db=>{
 const router=accounts(db,'driver');
 router.get('/dashboard',async(req,res)=>{
  const driverId=req.session.driver.driver_id;
  const [profiles]=await db.query('SELECT driver_id,name,age,gender,license_no,mobile_no,email FROM drivers WHERE driver_id = ?',[driverId]);
  const [assignments]=await db.query(`SELECT a.assignment_id,t.pickup_location,t.drop_point,t.fare,t.vehicle_id,t.trip_datetime,o.mobile_no AS owner_mobile,v.vehicle_no,a.driver_payment
    FROM assignments a JOIN trips t ON a.trip_id=t.trip_id JOIN owners o ON t.owner_id=o.owner_id JOIN vehicles v ON t.vehicle_id=v.vehicle_id
    WHERE a.driver_id = ? AND a.status = 'assigned'`,[driverId]);
  const [completedTrips]=await db.query(`SELECT t.pickup_location,t.drop_point,a.completed_at,a.driver_payment FROM assignments a JOIN trips t ON a.trip_id=t.trip_id WHERE a.driver_id = ? AND a.status = 'completed'`,[driverId]);
  assignments.forEach(t=>{t.trip_datetime=new Date(t.trip_datetime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});});
  res.render('driverDashboard',{profile:profiles[0],assignments,completedTrips,msg:[]});
 });
 router.post('/complete-trip',async(req,res)=>{
  const assignmentId=v.id(req.body.assignment_id),driverId=req.session.driver.driver_id;
  await transaction(db,async c=>{
   const [initial]=await c.query('SELECT trip_id FROM assignments WHERE assignment_id = ? AND driver_id = ?',[assignmentId,driverId]);
   if(!initial.length) v.bad('Assignment not found.');
   await c.query('SELECT trip_id FROM trips WHERE trip_id = ? FOR UPDATE',[initial[0].trip_id]);
   await c.query('SELECT driver_id FROM drivers WHERE driver_id = ? FOR UPDATE',[driverId]);
   const [active]=await c.query("SELECT assignment_id FROM assignments WHERE assignment_id = ? AND driver_id = ? AND status = 'assigned' FOR UPDATE",[assignmentId,driverId]);
   if(!active.length) v.bad('This assignment is no longer active.');
   await c.query("UPDATE assignments SET status='completed',completed_at=UTC_TIMESTAMP() WHERE assignment_id = ?",[assignmentId]);
   await c.query("UPDATE trips SET status='completed' WHERE trip_id = ?",[initial[0].trip_id]);
   await c.query("UPDATE drivers SET availability='available' WHERE driver_id = ?",[driverId]);
  });
  req.session.notice='Trip completed. You are available for another trip.';res.redirect('/driver/dashboard');
 });
 return router;
};
