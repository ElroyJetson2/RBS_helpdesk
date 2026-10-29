# RBS Helpdesk

Simple, mobile-friendly incident reporting & job tracking system for **Require Building Solutions**.

Customers log an issue → receive a reference number → track progress.  
Staff update jobs and manage verified properties in the admin panel.

**Stack:** Cloudflare Pages + Pages Functions + D1 (SQLite)  
**Brand:** RBS Helpdesk  
**Staff email:** helpdesk@requirebuilding.com.au

---

## Features

- **Customer form** – select property, describe issue, attach photos (up to 5), get reference instantly
- **Public tracking page** – enter reference → status + timeline
- **Staff admin** – login, filter incidents, update status + notes
- **Manage Properties** – add/edit properties with **Google Places** address verification (Australian addresses only)
- **Email notifications** via Resend on new job / status change
- Statuses: Open / Closed only

---

## Quick Start

### 1. Prerequisites
- Cloudflare account
- This repo connected to Cloudflare Pages project `rbs-helpdesk`
- D1 database `rbs-help-db` already created and bound as `DB`

### 2. Initialise the database
```bash
npx wrangler d1 execute rbs-help-db --remote --file=./schema.sql
```

### 3. Environment variables (Cloudflare Pages → Settings → Environment variables)
- `RESEND_API_KEY` – for email notifications
- `STAFF_EMAIL` – optional override (default: helpdesk@requirebuilding.com.au)
- `EMAIL_FROM` – optional (default: RBS Helpdesk <onboarding@resend.dev>)

### 4. Google Places API key
The admin property form uses Google Places Autocomplete.  
The key is currently in `public/admin.html`. **Restrict it** in Google Cloud Console:
- Application restriction → Websites
- Allow: `https://rbs-helpdesk.pages.dev/*` and your final domain
- API restriction → Places API + Maps JavaScript API

### 5. Default staff login
- Username: `admin`
- Password: `RBS@rbs1`

Change the password later by updating the `staff` table in D1.

---

## Adding properties

1. Log in to Staff → **Properties**
2. Click **+ Add Property**
3. Type the property name
4. Start typing the address – select a suggestion from Google
5. Only addresses selected from Google (with a `place_id`) can be saved

---

## File Structure
```
RBS_helpdesk/
├── public/
│   ├── index.html      # Customer report form
│   ├── track.html      # Public tracking
│   ├── admin.html      # Staff dashboard + Manage Properties
│   └── howto.html
├── functions/
│   ├── _middleware.js
│   ├── api/
│   │   ├── developments.js
│   │   ├── report.js
│   │   ├── track.js
│   │   ├── admin/
│   │   │   ├── login.js
│   │   │   ├── incidents.js
│   │   │   ├── update.js
│   │   │   └── properties.js   # NEW – CRUD for properties
│   │   └── cron/
│   └── lib/email.js
├── schema.sql
├── wrangler.toml
└── package.json
```

---

## Licence
Internal use – Require Building Solutions
