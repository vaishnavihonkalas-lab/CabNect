function bad(message) { const error = new Error(message); error.status = 400; throw error; }
function text(value, label, max = 120) {
 if (typeof value !== 'string' || !value.trim() || value.trim().length > max) bad(`${label} is required (maximum ${max} characters).`);
 return value.trim();
}
function id(value) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) bad('Invalid identifier.'); return n; }
function password(value) {
 if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) bad('Password must be at least 8 characters and at most 72 UTF-8 bytes.');
 return value;
}
function account(body, driver = false) {
 const out = { name: text(body.name, 'Name'), mobile_no: text(body.mobile_no, 'Mobile', 10), email: text(body.email, 'Email', 254).toLowerCase() };
 if (!/^\d{10}$/.test(out.mobile_no)) bad('Mobile number must be 10 digits.');
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) bad('Invalid email address.');
 if (driver) out.license_no = text(body.license_no, 'License', 40);
 else out.company_name = text(body.company_name, 'Company');
 return out;
}
function dateTime(date, time) {
 if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) bad('Invalid trip date or time.');
 const parsed = new Date(date + 'T00:00:00Z');
 if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || Number(date.slice(0,4)) < 1000) bad('Invalid calendar date.');
 // Browser form values are interpreted as India local time; database stores UTC.
 return new Date(`${date}T${time}:00+05:30`).toISOString().slice(0,19).replace("T"," ");
}
module.exports = { bad, text, id, password, account, dateTime };
