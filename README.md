# Takshashila: student empowerment platform

**React front end + Node.js back end.** Takshashila finds students in need, scores them fairly, pays their fees, and supports them until their first job. It follows the same flow as the Women Entrepreneurship (WE) project, with students instead of entrepreneurs.

## Run it

You need **Node.js 22.13 or newer** and **PostgreSQL** (Docker is the easiest way to get it).

```bash
npm install        # React and Vite for the front end, pg for the server
npm run db:up      # starts PostgreSQL in Docker (or point DATABASE_URL at your own, see .env.example)
npm run seed       # creates the tables and fills them with demo data
npm run dev        # API on :4000 + React on :5173 → open http://localhost:5173
```

The server applies database migrations (`server/migrations/*.sql`) by itself when it starts.

Demo mode shows the login code on screen instead of sending an SMS. Students sign in at `/sign-in`; staff sign in at **`/staff/sign-in`** ("Staff login" in the header), where demo mode also lists the test staff accounts:

| Role | Phone |
| --- | --- |
| Student (fees paid) | 9876500001 |
| Field executive, Belagavi | 9000000003 |
| Program manager | 9000000002 |
| Admin / finance | 9000000001 |
| School (Govt High School, Aland) | 9100000003 at `/school/sign-in` |

Any other valid mobile number creates a new student account and opens the application form.

## What it does

| WE project step | Takshashila |
| --- | --- |
| Aadhaar + phone registration | Phone OTP sign-in, Aadhaar duplicate check (stored as a salted hash + last 4 digits) |
| Weighted profile questions (5%, 10%…) | 17 bilingual questions → Need Score /100, drawn live as an arch gauge |
| Profile story | Student's story, minimum 150 characters |
| Aadhaar / consent uploads, green/red checklist | 12 documents; caste, disability and death certificates appear only when they apply |
| 3-minute video with question script | Video step with the 9 interview questions; private streaming with seek support |
| Submit to Manager / Reject | Field executive → Program manager (approve with amount / send back / reject) |
| EDP training request | Training sessions, student roster, attendance |
| Vendor payment, quotation, invoice, courier | Scholarship / vendor / training payments: request → approve (maker-checker) → paid with bank UTR |
| Shop opening, monthly income statement | Semester renewal: marks, attendance, fee receipt; auto-flags below 50% / 75% |

### School infrastructure

Schools request what their classrooms need; the trust verifies, approves and pays the vendor directly.

| Step | Who | What happens |
| --- | --- | --- |
| Register | School (headmaster or SDMC member) | Signs in at `/school/sign-in`, fills a one-time profile: UDISE code, type, enrolment, teachers |
| Request | School | Picks items from a catalogue of 29 (dual desk-benches, teacher tables, fans, LED lights, RO purifiers, toilet repairs, ramps, books, computers…) or adds custom ones, sets urgency, explains the need, adds photos |
| Site verified | Field executive (same district) | Visits the school, records notes and photos |
| Approved | Program manager / admin | Sanctions an amount up to the estimate, or sends back / rejects with a reason the school sees |
| Order placed | Finance | Pays the vendor through the normal maker-checker payments (type "School infra"), capped at the sanctioned amount |
| Delivered | School (or field executive) | Uploads delivery photos and confirms |

Each request gets a **priority score out of 100** (category of need 30, school type 25, urgency 20, enrolment 15, pupils per teacher 10) so water, sanitation and safety in crowded government schools are seen first. Item costs and weights live in `server/infrastructure.js`. A school can have at most 3 requests waiting for review.

Plus: internships and jobs matched to each student's level, a government scholarship finder (NSP, AICTE, Karnataka SSP), a staff dashboard, and an audit log.

## Tech stack

| Layer | Choice |
| --- | --- |
| Front end | React 19, Vite, plain CSS design system (no UI kit), small built-in router |
| Back end | Node.js 22+, built-in `http` server and router, no framework |
| Database | PostgreSQL through `pg`, versioned SQL migrations, transactions for every multi-step change |
| Auth | Phone + OTP by SMS (MSG91), HMAC-signed HttpOnly session cookie, role checks on every route |
| Security | CSRF header check, OTP rate limits per phone and per IP, field staff scoped to their district, maker-checker payments, file access checks, security headers, HSTS in production |
| Files | Streamed to disk (`UPLOAD_DIR`), on a persistent disk in production |

The back end's only dependency is `pg`. Swapping in Express later is straightforward; each route is a small function.

## Project layout

```
client/                 React app
  src/App.jsx           routes and role guards
  src/pages/            Home, SignIn, Apply (8-step wizard), StudentHome, staff/*
  src/components/       arch gauge, lamps, form controls, layout
  src/styles.css        design system
server/
  index.js              HTTP server, static files, error handling
  routes/               auth, public, student, staff, infra (school infrastructure)
  migrations/           database schema, one numbered .sql file per change
  scoring.js            questions and weights  ← change scoring here
  infrastructure.js     school item catalogue, costs, priority score  ← change school rules here
  services.js           validation, application creation, uploads, checklist
  schemes.js            government scholarship rules
  seed.js               demo data (refuses to run in production)
  add-staff.js          create real staff accounts
scripts/dev.js          runs API and React together
```

## API (all JSON; non-GET requests need header `X-Requested-With: takshashila`)

| Method | Path | Who |
| --- | --- | --- |
| POST | /api/auth/otp, /api/auth/verify, /api/auth/logout | anyone |
| GET | /api/auth/me, /api/meta, /api/public/stats | anyone |
| POST | /api/applications | student |
| GET | /api/me/application | student |
| POST | /api/me/renewals | student |
| PUT | /api/applications/:id/documents/:type (raw file body, `X-File-Name` header) | owner or staff |
| GET | /api/files/:id | owner or staff |
| GET/POST | /api/staff/applications, /api/staff/applications/:id | staff |
| POST | /api/staff/applications/:id/decision | staff (approve: manager/admin) |
| GET/POST | /api/staff/payments, /api/staff/payments/:id/(approve, reject, paid) | staff |
| GET/POST/PUT | /api/staff/trainings, /:id, /:id/attendance | staff |
| GET/POST | /api/staff/opportunities | staff |
| GET/PUT | /api/school/me (school profile) | school |
| POST/GET | /api/school/requests, /api/school/requests/:id, /:id/delivered | school |
| PUT/GET | /api/infra/:id/documents/:kind, /api/infra/files/:id | school (own) or staff |
| GET/POST | /api/staff/infra, /api/staff/infra/:id, /:id/decision | staff (field: own district) |

## Deploy (Render or Railway)

The app ships as one Docker image (`Dockerfile`): the Node server serves the API and the built React app on one port.

### Before you start

1. **MSG91**: create an account, register your sender ID and an OTP template on the DLT portal (TRAI requires this for SMS in India), then create a Flow in MSG91 with that template. You need the **auth key**, the **flow template ID** and the name of the OTP variable in the template (default `otp`).
2. Push this folder to a GitHub repository.

### Render

1. In Render: **New → Blueprint**, pick the repository. `render.yaml` creates the web service, a 10 GB disk for uploads at `/var/data`, and a PostgreSQL database, and generates `SECRET_KEY`.
2. Fill in `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` when asked.
3. After the first deploy, open the service's **Shell** and create the first admin:
   ```bash
   node server/add-staff.js 9XXXXXXXXX "Your Name" admin
   ```
4. Add your domain under **Settings → Custom Domains**. Render provides HTTPS.

### Railway

1. **New Project → Deploy from GitHub repo**. `railway.json` tells Railway to build the Dockerfile and use `/api/health` as the health check.
2. **Add → Database → PostgreSQL**. In the app's variables set `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
3. Add a **Volume** to the app, mounted at `/var/data`.
4. Set `SECRET_KEY` (32+ random characters), `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`.
5. Create the first admin with `railway run node server/add-staff.js 9XXXXXXXXX "Your Name" admin`, or from the service shell.

### Adding staff

Admins manage staff in the app under **Settings → Team**: add, edit role or district, and deactivate people who leave (their history is kept). The staff portal only signs in active staff accounts; it never creates one. From the command line:

```bash
npm run add-staff -- 9XXXXXXXXX "Ravi Kulkarni" manager
npm run add-staff -- 9XXXXXXXXX "Deepa Patil" field "Belagavi"   # field staff need a district
```
Running it again for the same number updates the name, role or district.

### Settings

All settings are environment variables; `.env.example` lists them with explanations. In production the server **refuses to start** without `SECRET_KEY`, `DATABASE_URL` and the MSG91 keys, and demo mode is off unless you set `DEMO_MODE=1`. Never set that on a site with real students: it shows login codes on screen, so anyone could sign in as an admin.

**Keep `SECRET_KEY` safe and never change it.** It signs logins and salts the Aadhaar hashes, so changing it breaks duplicate-Aadhaar detection for every existing application.

### Running it well

- **Backups**: Render's and Railway's paid Postgres plans take daily backups. The uploads disk is separate: Render snapshots disks daily; on Railway, set up volume backups. Test a restore once.
- **One instance**: uploads live on one server's disk, so run a single instance. To run several, move uploads to an S3-compatible bucket first.
- **Schema changes**: add a new numbered file in `server/migrations/` (e.g. `002_add_notes.sql`). Never edit a migration that has already run in production.
- **Data protection (DPDP Act)**: get parental consent for students under 18 (the declaration step covers this) and limit admin accounts to people who need them.
