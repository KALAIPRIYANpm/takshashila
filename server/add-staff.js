// Create or update a staff account: npm run add-staff -- <phone> "<name>" <admin|manager|field> ["<district>"]
// Staff sign in with this phone number and an OTP, like students.
import { STAFF_ROLES } from './constants.js';
import { audit, get, migrate, pool, run } from './db.js';

const [rawPhone, name, role, district] = process.argv.slice(2);
const phone = String(rawPhone || '').replace(/\D/g, '').slice(-10);

const usage = (problem) => {
  console.error(`${problem}\n\nUsage: npm run add-staff -- <phone> "<name>" <${STAFF_ROLES.join('|')}> ["<district>"]`);
  process.exit(1);
};
if (!/^[6-9]\d{9}$/.test(phone)) usage('Phone must be a 10-digit Indian mobile number.');
if (!name?.trim()) usage('Name is required.');
if (!STAFF_ROLES.includes(role)) usage(`Role must be one of: ${STAFF_ROLES.join(', ')}.`);
if (role === 'field' && !district?.trim()) usage('Field executives need a district: they only see applications from it.');

await migrate();
const existing = await get('SELECT id, role FROM users WHERE phone = ?', phone);
if (existing?.role === 'student' && await get('SELECT 1 AS x FROM applications WHERE student_id = ?', existing.id)) {
  usage('This number belongs to a student who has applied. Use a different number for the staff account.');
}
await run(`INSERT INTO users (phone, name, role, district) VALUES (?,?,?,?)
           ON CONFLICT (phone) DO UPDATE SET name = excluded.name, role = excluded.role, district = excluded.district`,
  phone, name.trim(), role, district?.trim() || null);
const user = await get('SELECT id FROM users WHERE phone = ?', phone);
await audit(null, existing ? 'update_staff' : 'add_staff', 'user', user.id, { role, district: district || null });
console.log(`${existing ? 'Updated' : 'Added'} ${role} ${name.trim()} (${phone}).`);
await pool.end();
