module.exports = async function transaction(db, action) {
 const connection = await db.getConnection();
 try { await connection.beginTransaction(); const result = await action(connection); await connection.commit(); return result; }
 catch (error) { await connection.rollback(); throw error; }
 finally { connection.release(); }
};
