const accounts=require('./accounts');
const v=require('../utils/validation');
const transaction=require('../utils/transaction');
module.exports=db=>{
 const router=accounts(db,'owner');
 router.get('/dashboard',async(req,res)=>{
  const ownerId=req.session.owner.owner_id;
  const [vehicles]=await db.query('SELECT * FROM vehicles WHERE owner_id = ?',[ownerId]);
  const [trips]=await db.query('SELECT * FROM trips WHERE owner_id = ?',[ownerId]);
  const [assignments]=await db.query(`SELECT a.assignment_id,a.trip_id,d.name AS driver_name,a.driver_payment,a.status
   FROM assignments a JOIN drivers d ON a.driver_id=d.driver_id JOIN trips t ON a.trip_id=t.trip_id WHERE t.owner_id = ?`,[ownerId]);
  const [drivers]=await db.query("SELECT driver_id,name,availability,is_deleted FROM drivers WHERE is_deleted = 0");
  const [profiles]=await db.query('SELECT owner_id,name,company_name,mobile_no,email FROM owners WHERE owner_id = ?',[ownerId]);
  res.render('ownerDashboard',{profile:profiles[0],vehicles,trips,assignments,drivers});
 });
 router.post('/add-vehicle',async(req,res)=>{
  const b=req.body;
  await db.query('INSERT INTO vehicles (owner_id,vehicle_no,car_model,car_type,fuel_type) VALUES (?,?,?,?,?)',[req.session.owner.owner_id,v.text(b.vehicle_no,'Vehicle number',30).toUpperCase(),v.text(b.car_model,'Model',80),v.text(b.car_type,'Car type',40),v.text(b.fuel_type,'Fuel type',40)]);
  req.session.notice='Vehicle added.';res.redirect('/owner/dashboard');
 });
 router.post('/update-vehicle',async(req,res)=>{
  const b=req.body,vehicleId=v.id(b.vehicle_id),ownerId=req.session.owner.owner_id;
  const [result]=await db.query('UPDATE vehicles SET vehicle_no=?,car_model=?,car_type=?,fuel_type=? WHERE vehicle_id=? AND owner_id=?',[v.text(b.vehicle_no,'Vehicle number',30).toUpperCase(),v.text(b.car_model,'Model',80),v.text(b.car_type,'Car type',40),v.text(b.fuel_type,'Fuel type',40),vehicleId,ownerId]);
  if(!result.affectedRows) v.bad('Vehicle not found in your fleet.');
  req.session.notice='Vehicle updated.';res.redirect('/owner/dashboard');
 });
 router.post('/delete-vehicle',async(req,res)=>{
  const [result]=await db.query('DELETE FROM vehicles WHERE vehicle_id=? AND owner_id=?',[v.id(req.body.vehicle_id),req.session.owner.owner_id]);
  if(!result.affectedRows) v.bad('Vehicle not found in your fleet.');
  req.session.notice='Unused vehicle deleted.';res.redirect('/owner/dashboard');
 });
 router.post('/create-trip' ,async(req,res)=>{
  const b=req.body,ownerId=req.session.owner.owner_id,vehicleId=v.id(b.vehicle_id);
  const distance=Number(b.distance_km);
  if(!Number.isFinite(distance)||distance<=0||distance>10000||!/^\d+(\.\d{1,2})?$/.test(String(b.distance_km))) v.bad('Distance must be positive, at most 10000 km, with at most two decimals.');
  const mobile=v.text(b.mobile_no,'Customer mobile',10);if(!/^\d{10}$/.test(mobile)) v.bad('Customer mobile must be 10 digits.');
  const datetime=v.dateTime(b.trip_date,b.trip_time);
  const [vehicles]=await db.query('SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? AND owner_id = ?',[vehicleId,ownerId]);
  if(!vehicles.length) v.bad('Select one of your own vehicles.');
  const fare=Math.round(distance*1500)/100;
  await db.query('INSERT INTO trips (owner_id,customer_name,pickup_location,drop_point,mobile_no,distance_km,fare,vehicle_id,trip_datetime) VALUES (?,?,?,?,?,?,?,?,?)',[ownerId,v.text(b.customer_name,'Customer'),v.text(b.pickup_location,'Pickup',255),v.text(b.drop_point,'Destination',255),mobile,distance,fare,vehicleId,datetime]);
  req.session.notice='Trip created.';res.redirect('/owner/dashboard');
 });
 router.post('/assign-trip',async(req,res)=>{
  const tripId=v.id(req.body.trip_id),driverId=v.id(req.body.driver_id),ownerId=req.session.owner.owner_id;
  await transaction(db,async c=>{
   // Consistent lock order: owner -> trip -> driver. Account deletion uses the same parent lock.
   await c.query('SELECT owner_id FROM owners WHERE owner_id = ? FOR UPDATE',[ownerId]);
   const [trips]=await c.query('SELECT * FROM trips WHERE trip_id = ? AND owner_id = ? FOR UPDATE',[tripId,ownerId]);
   if(!trips.length || trips[0].status!=='pending') v.bad('Only your pending trips can be assigned.');
   const [drivers]=await c.query('SELECT driver_id,availability FROM drivers WHERE driver_id = ? AND is_deleted = 0 FOR UPDATE',[driverId]);
   if(!drivers.length || drivers[0].availability!=='available') v.bad('Driver is not available.');
   const payment=Math.round(Number(trips[0].fare)*60)/100;
   await c.query('INSERT INTO assignments (trip_id,driver_id,driver_payment) VALUES (?,?,?)',[tripId,driverId,payment]);
   await c.query("UPDATE trips SET status='assigned' WHERE trip_id = ?",[tripId]);
   await c.query("UPDATE drivers SET availability='unavailable' WHERE driver_id = ?",[driverId]);
  });
  req.session.notice='Driver assigned.';res.redirect('/owner/dashboard');
 });
 router.post('/cancel-trip',async(req,res)=>{
  const tripId=v.id(req.body.trip_id),ownerId=req.session.owner.owner_id;
  await transaction(db,async c=>{
   await c.query('SELECT owner_id FROM owners WHERE owner_id = ? FOR UPDATE',[ownerId]);
   const [trips]=await c.query('SELECT * FROM trips WHERE trip_id = ? AND owner_id = ? FOR UPDATE',[tripId,ownerId]);
   if(!trips.length || !['pending','assigned'].includes(trips[0].status)) v.bad('Only your pending or assigned trips can be cancelled.');
   const [assignments]=await c.query('SELECT * FROM assignments WHERE trip_id = ?',[tripId]);
   if(assignments.length){
    await c.query('SELECT driver_id FROM drivers WHERE driver_id = ? FOR UPDATE',[assignments[0].driver_id]);
    await c.query("UPDATE assignments SET status='cancelled' WHERE trip_id = ?",[tripId]);
    await c.query("UPDATE drivers SET availability='available' WHERE driver_id = ?",[assignments[0].driver_id]);
   }
   await c.query("UPDATE trips SET status='cancelled' WHERE trip_id = ?",[tripId]);
  });
  req.session.notice='Trip cancelled.';res.redirect('/owner/dashboard');
 });
 return router;
};
