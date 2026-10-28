# Gold Coast Incident Tracker

Simple, mobile-friendly incident reporting & job tracking system for property maintenance companies.

Customers log an issue → receive a reference number → watch live progress and projected finish time.  
Staff update jobs in a clean admin panel. Reports can be filtered per development.

**Stack:** Cloudflare Pages + Pages Functions + D1 (SQLite)  
**Cost:** Free tier is more than enough for most property portfolios.

---


## Features

- **Customer form** – one page, select development, describe issue, get reference instantly
- **Public tracking page** – enter reference → status, timeline, projected finish
- **Staff admin** – login, filter by development/status, update status + notes + projected finish
- **Per-development reporting** – filter any view by development
- **Seeded Gold Coast developments** – easy to edit

---

## Quick Start (Deploy in ~10 minutes)

### 1. Prerequisites
- Cloudflare account (free)
- Node.js 18+
- GitHub account (optional but recommended)

### 2. Clone / copy this repo
```bash
cd goldcoast-incidents
npm install
```

### 3. Create the D1 database
```bash
npx wrangler login
npx wrangler d1 create goldcoast-incidents-db
```
Copy the `database_id` that is printed and paste it into `wrangler.toml` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

### 4. Initialise the schema + seed data
```bash
# Remote (production)
npx wrangler d1 execute goldcoast-incidents-db --remote --file=./schema.sql

# Or local for testing
npx wrangler d1 execute goldcoast-incidents-db --local --file=./schema.sql
```

### 5. Local development
```bash
npx wrangler pages dev public --d1=DB=goldcoast-incidents-db --local
```
Open http://localhost:8788

- Customer form: http://localhost:8788/
- Track: http://localhost:8788/track.html
- Admin: http://localhost:8788/admin.html  
  Default login: **admin** / **goldcoast2026**

### 6. Deploy to Cloudflare Pages

**Option A – via Wrangler**
```bash
npx wrangler pages project create goldcoast-incidents
npx wrangler pages deploy public --project-name=goldcoast-incidents
```

**Option B – GitHub (recommended)**
1. Push this folder to a GitHub repository
2. In Cloudflare Dashboard → Pages → Create project → Connect to Git
3. Select the repo
4. Build settings:
   - Framework preset: None
   - Build command: (leave empty)
   - Build output directory: `public`
5. After first deploy, go to Settings → Functions → D1 database bindings
   - Variable name: `DB`
   - D1 database: select `goldcoast-incidents-db`
6. Redeploy

---

## Customising

### Add / edit developments
Edit `schema.sql` or run SQL against D1:
```sql
INSERT INTO developments (name, code, address)
VALUES ('Your New Complex', 'YNC', '123 Example St, Gold Coast QLD');
```

### Change default staff password
```sql
UPDATE staff SET password_hash = 'your-new-password' WHERE username = 'admin';
```
(Or add more staff rows.)

### Production hardening suggestions
- Replace the demo password auth with **Cloudflare Access** (zero-trust)
- Add Cloudflare Turnstile to the public report form
- Hash passwords properly (bcrypt/Web Crypto) instead of plain text
- Add photo uploads via R2
- Add email/SMS notifications on status change (Workers + Resend / Twilio)

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/developments` | Public | List developments for form |
| POST | `/api/report` | Public | Create incident → returns reference |
| GET | `/api/track?ref=GC-…` | Public | Get incident + timeline |
| POST | `/api/admin/login` | Public | Staff login → token |
| GET | `/api/admin/incidents` | Bearer | List / filter incidents |
| POST | `/api/admin/update` | Bearer | Update status, note, projected finish |

---

## File Structure
```
goldcoast-incidents/
├── public/
│   ├── index.html      # Customer report form
│   ├── track.html      # Public tracking page
│   └── admin.html      # Staff dashboard
├── functions/
│   ├── _middleware.js  # CORS
│   └── api/
│       ├── developments.js
│       ├── report.js
│       ├── track.js
│       └── admin/
│           ├── login.js
│           ├── incidents.js
│           └── update.js
├── schema.sql
├── wrangler.toml
├── package.json
└── README.md
```

---

## Licence
MIT – free to use and modify for your business.
