# Campaign — Modern Multi-Channel Marketing Dashboard

A modern, responsive campaign management web application with a premium SaaS dashboard UI built with **Next.js 14**, **TypeScript**, and **Tailwind CSS**.

---

## 1. Project Overview & Features

- **Authentication System**:
  - Connected to the verified staging backend API (`POST /api/users/login`).
  - Two-column responsive desktop & mobile login screen with marketing branding and security assurances.
  - User ID & password with show/hide password toggle.
  - Remember Me session persistence (7-day extended session).
  - Robust error handling for invalid credentials (e.g. 400 Bad Request, 404 User Not Found, 401 Unauthorized, network timeouts).
  - Protected dashboard routes with automatic redirects for unauthenticated users.

- **SaaS Dashboard**:
  - Clean SaaS aesthetic using an Indigo, Slate, Blue, and Emerald color palette.
  - Fixed desktop sidebar and mobile responsive sliding drawer.
  - Top header with welcome greetings, user avatar, and session indicators.
  - Primary campaign action cards: **Email Campaign** (subtle blue accent) and **WhatsApp Campaign** (subtle green accent).
  - Strictly honest data presentation with no fake metrics or fabricated contact numbers.

- **Email Campaign CSV Importer (`/dashboard/email`)**:
  - Drag-and-drop file upload with visual hover states and file-type validation (`.csv`).
  - Automatic column detection for `email`, `email_address`, `e-mail`, `mail`, etc.
  - RFC-5322 compliant email regex validation.
  - Detection of duplicates and malformed email addresses without silent discards.
  - Real-time summary statistics: Total Rows, Valid Contacts, Invalid Contacts, Duplicate Contacts, and Readiness Score.
  - Downloadable sample CSV for testing.
  - Downloadable Error Report CSV containing row numbers and exact validation failure reasons.
  - "Continue" workflow button enabled only when contacts are parsed and verified.

- **WhatsApp Campaign CSV Importer (`/dashboard/whatsapp`)**:
  - Automatic phone column detection (`phone`, `phone_number`, `mobile`, `whatsapp`, etc.).
  - Preserves phone numbers as strings so leading zeros and international prefixes (`+`) are never lost.
  - ITU-T E.164 compliant validation (standard international lengths between 7 and 15 digits).
  - Detection of empty, duplicate, or malformed phone entries.
  - Filterable and paginated contact preview table.
  - Downloadable sample WhatsApp contact CSV.

- **Notification & Feedback System**:
  - Custom floating toast notification system (`success`, `error`, `info`, `warning`).
  - Modal dialogues explaining contact state and backend synchronization notes.

---

## 2. Project Location

```text
F:\Web Projects\Campaign
```

---

## 3. Installation & Startup Commands

Ensure **Node.js** (v18+) is installed.

```bash
# 1. Navigate to the project directory
cd "F:\Web Projects\Campaign"

# 2. Install dependencies
npm install

# 3. Start development server (runs on http://localhost:3000)
npm run dev

# 4. Create production build
npm run build

# 5. Start production server
npm start
```

---

## 4. Environment Variables Configuration

Create or verify the `.env` file in the project root (`.env.local`, if present, overrides it):

```env
NEXT_PUBLIC_API_BASE_URL=https://gb-billing-server-on-408163079626.asia-south2.run.app
```

Restart the development server after changing this value. For Firebase Hosting, run `npm run build` and deploy the new `out` directory; Next.js embeds `NEXT_PUBLIC_*` values into the browser bundle at build time.

### Email requests in the browser Network tab

Open DevTools before entering the email module, enable recording and Preserve log, and select Fetch/XHR with the text filter cleared. With a valid login session, these actions issue requests to the configured API base URL:

| Action | Request |
| --- | --- |
| Open Email Campaign or Templates | `GET /api/email/templates` |
| Open Campaigns History | `GET /api/email/campaigns`, `GET /api/email/queue-status` |
| Open campaign details | `GET /api/email/campaigns/:id` |
| Generate an email preview | `POST /api/email/preview` |
| Launch a validated campaign | `POST /api/email/campaigns` |

CSV parsing happens locally and does not send a request. Template-loading failures appear in the wizard with a retry button.

Firebase Hosting must serve each exported page using `cleanUrls: true` in [firebase.json](./firebase.json). A catch-all rewrite to `/index.html` serves the root redirect page for direct visits to `/dashboard/email`, so the email module never mounts on that visit. Keep that rewrite removed, and deploy the hosting configuration together with the build.

---

## 5. Verified Staging Login API Details

Through empirical network verification, the staging backend configuration was determined:

- **Base URL**: `https://gb-billing-server-staging-408163079626.asia-southeast1.run.app`
- **Verified Login Route**: `POST /api/users/login`
- **Fallback Route**: `POST /users/login` (supported via automated fallback in `lib/api.ts`)
- **Request Body**:
  ```json
  {
    "user_id": "your_user_id",
    "password": "your_password"
  }
  ```
- **Observed Response Schemas**:
  - Missing parameters (HTTP 400):
    ```json
    { "success": false, "error": "user_id and password are required" }
    ```
  - Unregistered user (HTTP 404):
    ```json
    { "success": false, "error": "User not found" }
    ```
  - Successful response:
    ```json
    { "success": true, "token": "<JWT_OR_SESSION_TOKEN>", "user": { ... } }
    ```
- **CORS Support**: The staging server returns `access-control-allow-origin: http://localhost:3000` with `access-control-allow-credentials: true` and supports `Authorization: Bearer <token>`.

---

## 6. Backend API Endpoints Required for Full Campaign Dispatch

The frontend performs client-side validation and previews contact lists accurately without pretending data has been saved remotely. To support saving lists and dispatching messages, the following backend endpoints are needed:

1. **Contact List Persistence**:
   - `POST /api/campaigns/contacts/import`
   - Payload: Array of validated contacts, list name, campaign channel (`email` | `whatsapp`).
2. **Email Campaign Dispatch**:
   - `POST /api/campaigns/email/send`
   - Payload: Sender email, subject, email HTML/text body, list ID / recipient array.
3. **WhatsApp Campaign Dispatch**:
   - `POST /api/campaigns/whatsapp/send`
   - Payload: Approved WhatsApp template ID, template parameters, recipient numbers.
4. **Campaign Status & Metrics**:
   - `GET /api/campaigns/:id/analytics`
   - Delivery rates, open rates, click rates, and WhatsApp read receipts.

