# Personal Health Copilot

> **Understand your health records in plain language.**

Personal Health Copilot is a hackathon prototype of a patient-facing health records assistant. Patients (or caregivers managing family profiles) upload a lab report, prescription, or doctor's visit note. The app reads it, shows the extracted values for review, explains the results in plain language, tracks trends, manages medicines, and answers questions **only from the records that were saved**, with citations.

> ⚠️ This is not medical advice. Always consult a qualified doctor or pharmacist.

All patient data in this repository is **fictional demo data**. Demo login uses a simulated ABHA number. It is not connected to ABDM.

---

## Features

- **Demo sign-in** with ABHA number, name, and email, plus a one-click *Try Demo Patient* and an *Interactive Demo* tour.
- **Dashboard** with latest values, reference-range flags, and a shortcut to the Caregiver View.
- **Upload** (PDF, JPEG, PNG; up to 10 MB) with streamed processing stages: uploading, reading the document, extracting information, understanding medical terms, and preparing a summary.
- **OCR review** with per-field *Edit* and a *Looks incorrect?* mode that opens every field. Nothing is saved until you confirm.
- **AI summary** generated on demand ("Generate Summary"), with a plain-language explanation, terms, and questions to discuss with a doctor.
- **AI assistant** grounded only in your saved records. Every answer lists the records it used. When the answer isn't in the records, it says *"I couldn't find that information in your records."* It never recommends starting, stopping, or changing a medicine.
- **Health trends** (Recharts) for hemoglobin, glucose, blood pressure, heart rate, weight, vitamin D, and cholesterol. Each card shows the change *compared with the previous report* and *since the first report*, with reference-range bands.
- **Medications**: manual add, status (active, upcoming, completed), and today's morning / afternoon / night schedule with taken / not-taken toggles.
- **Drug-interaction checker** (mock provider) for pairs that may need review.
- **Timeline** with search, type filter, and newest / oldest sort.
- **Family profiles** with profile switching and a **Caregiver View** (linked from Family and the Dashboard).
- **Accessibility**: Easy Read Mode, large text, high contrast, and read-aloud (browser speech synthesis).
- **English and Hindi** with a language toggle in the header.
- **Medical disclaimer** in a global bar on every page. It can be collapsed to a short line, and the choice is remembered on that browser. The short line stays visible.
- **Privacy and security basics**: Zod validation on every input, ownership checks on every record, file-type checks by magic bytes, uploads stored outside `public/`, no record content in logs, and no provider keys sent to the browser.
- **FHIR R4 export** of saved records (`/api/account/export`), and account deletion.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · shadcn-style UI primitives · Lucide icons · Recharts · Prisma 7 with SQLite (libsql driver adapter) · Zod.

---

## Setup

Requirements: **Node.js 20 or newer** (developed on Node 22) and npm.

```bash
npm install          # also runs `prisma generate` (postinstall)
cp .env.example .env # then set SESSION_SECRET to a long random value
npm run dev          # runs migrations and demo seed if needed, then starts http://localhost:3000
```

Open http://localhost:3000 and choose **Try Demo Patient** (or **Try Interactive Demo** for a guided tour).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Applies pending migrations, seeds demo data if missing, starts the dev server on `0.0.0.0:3000`. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run typecheck` | `tsc --noEmit` (strict). |
| `npm run db:migrate` | Applies SQL migrations in `prisma/migrations` (tracked in `_prisma_migrations`). |
| `npm run db:seed` | Seeds the fictional demo data (idempotent). |
| `npm run db:reset` | Deletes `prisma/dev.db`, then migrates and seeds. |

### Environment variables

See `.env.example`. None of these are required for the demo. The mock providers need no credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file (default `file:./prisma/dev.db`). |
| `SESSION_SECRET` | Signs the session cookie. **Set a long random value outside local demos.** |
| `UPLOAD_DIR` | Where uploaded originals are stored (default `./storage/uploads`, git-ignored). |
| `OCR_PROVIDER`, `AI_PROVIDER`, `INTERACTION_PROVIDER` | Provider selection. `mock` is the default. |
| `OCR_API_KEY`, `AI_API_KEY`, `AI_MODEL` | Reserved for production providers. Server-side only. |

### Demo data

`npm run db:seed` creates the fictional demo patient **Demo User** (email `demo.patient@example.com`, demo ABHA `99-0000-0000-0001`):

- Blood reports on **12 Jan, 13 Apr, 14 Aug, and 12 Sep 2026**: hemoglobin 14.5 → 13.8 → 12.6 → 11.0 g/dL; glucose 101 → 108 mg/dL; blood pressure 126/84 → 122/82 → 120/80 mmHg.
- A doctor visit (2 Sep 2026) and a prescription dated **6 Oct 2026**: Paracetamol 500 mg (2 times a day, 5 days), Amoxicillin 500 mg (3 times a day, 7 days), and Vitamin D3.
- Family profiles: a child (*Aarav, demo child*) and an elder (*Savitri Devi, demo elder*), each with their own visits and reports.

The mock OCR and AI providers are deterministic. They read the sample text that matches the filename (for example `lab`, `blood`, or `cbc` for a lab report, `visit` or `doctor` for a visit note, and anything else for a prescription). Reference ranges are only used when they are printed on the document. Otherwise the value is shown as *Outside the reference range*, not flagged as normal or abnormal.

---

## Architecture

```
app/                      Routes (App Router): landing, login, (app)/* signed-in pages, api/* route handlers
components/               UI primitives (components/ui), feature components, client prefs provider
lib/
  actions/                Server actions ("use server"). Validate with Zod, check ownership, return ActionResult.
  auth/                   Signed session cookie (HMAC), request context loader
  database/               Ownership-scoped data access (Prisma), demo data, seed
  ocr/ ai/ interactions/  Provider abstractions + mock implementations (selected by env)
  health/                 Pure logic: metric definitions, trend comparison, medication schedule, AI context builder
  records/ medications/   Pure view models (safe for client components)
  storage/                Upload storage with magic-byte detection
  fhir/                   FHIR R4 mappers and bundle builder
  i18n/                   English and Hindi dictionaries (en is the key source; hi is type-checked against it)
prisma/                   schema.prisma, SQL migrations, seed script
scripts/                  migrate.ts (applies SQL migrations), setup-db.ts (predev)
```

Medication status (active / upcoming / completed) is **derived from dates**, not stored. Each dose is logged once per medicine, day, and slot.

---

## Replacing the mock providers

The app is wired so every external capability sits behind a small interface. Keep the same output types so the UI does not change.

### 1. Production OCR

**Interface:** `OcrProvider` in `lib/ocr/types.ts`: `readText({ buffer, mimeType, fileName }) → { provider, text, pages[], averageConfidence }`.

1. Create `lib/ocr/<vendor>-provider.ts` implementing `OcrProvider`. Examples: Google Document AI, Azure AI Document Intelligence, AWS Textract, or a self-hosted engine such as Tesseract.
2. Read credentials from server-only variables (for example `OCR_API_KEY`). Never use `NEXT_PUBLIC_*` names for secrets.
3. Register it in `OCR_PROVIDERS` in `lib/ocr/provider.ts`: `vendor: () => new VendorOcrProvider()`.
4. Set `OCR_PROVIDER=vendor`.
5. The existing parsers (`lib/ocr/parsers.ts`) turn the text into lab values, medicines, and document type. Improve them, or have your provider return structured output and map it into `extractedRecordSchema` (`types/health.ts`), which the upload route validates before saving.
6. Do not log the OCR text or the file. Keep uploads in private storage and keep the ownership check on the file route.

### 2. Production AI

**Interface:** `HealthAIProvider` in `lib/ai/types.ts`. It produces `AssistantAnswer` (answer, found, sources) and `HealthSummary`.

1. Create `lib/ai/<vendor>-provider.ts` implementing `HealthAIProvider`, using a hosted model (OpenAI, Gemini, Azure OpenAI, and so on) or a self-hosted model.
2. Send **only the `HealthContext`** built by `lib/health/context.ts` for the active profile. Never send other profiles or user account data.
3. Keep the grounding rules: answers must come only from the supplied records, must cite record IDs, and must return the "couldn't find" response when the answer is missing. Keep the unsafe-question guard (dose, stop, start, diagnosis) **before** the model call.
4. Validate model output with Zod before it reaches the UI. Reject free-form text that does not match the schema.
5. Keep the system prompt in code. Forbid diagnoses, prescription advice, and "stop/take X instead" language. Add an evaluation set for these before launch.
6. Register it in `AI_PROVIDERS` in `lib/ai/provider.ts`, set `AI_PROVIDER=vendor`, and add the key (`AI_API_KEY`, `AI_MODEL`) to the server environment only.
7. Check your provider's data-processing terms. Health data needs a data processing agreement, and the vendor must not train on it.

### 3. Official ABHA / ABDM integration

**Current state:** demo sign-in only. The ABHA number is stored as a label. **No ABHA authentication takes place and nothing is sent to ABDM.** The app does not claim ABDM connectivity.

To go live you need an approved integration with the National Health Authority / ABDM sandbox and production programme (HIP/HIU/PHR-app onboarding, a registered client ID and secret, and the required data-privacy and security reviews). The ABDM Sandbox is the usual starting point.

1. Replace the demo login in `lib/actions/auth.ts` with the approved ABHA authentication flow (OTP or the approved method). Use the official endpoints and credentials, kept server-side.
2. Store the ABHA address and number only in encrypted form, and only if your approval requires it. Do not write them to logs.
3. For record exchange, implement the ABDM consent and health-information flows (HIU/HIP, FHIR bundles) through the approved gateway. The FHIR mappers in `lib/fhir/mappers.ts` are a starting point for the R4 bundle format.
4. Remove the "demo" labels and the demo ABHA only after the integration is approved, and show the official consent screens to the user.

### 4. Deployment

The app uses SQLite and local file storage, which suits a single-instance demo. For a shared environment:

1. **Database:** switch to PostgreSQL. Change the `datasource` provider in `prisma/schema.prisma` and the adapter in `lib/database/prisma.ts` (for example `@prisma/adapter-pg`). Convert the SQL migrations to Postgres syntax, or regenerate them with a Prisma migration engine that you can run in CI.
2. **Uploads:** replace `lib/storage/uploads.ts` with encrypted object storage (for example S3 or Azure Blob) using private buckets and short-lived signed URLs. Keep the ownership check on every read.
3. **Secrets:** set `SESSION_SECRET` (`openssl rand -hex 32`) and all provider keys in your host's secret manager. Never place them in `NEXT_PUBLIC_*` variables.
4. **Cookies and HTTPS:** the session and preference cookies are `secure` in production. Serve the app only over HTTPS.
5. **Build:** `npm ci && npm run build && npm start`. Set `NODE_ENV=production`. Run `npm run db:migrate` as a release step and seed only non-production environments.
6. **Headers:** `next.config.ts` sets `nosniff`, `X-Frame-Options: DENY`, a referrer policy, and `private, no-store` for `/api/*`. Add a Content-Security-Policy that matches your deployment.
7. **Logging and monitoring:** logs record error names only. Keep it that way. Do not add request bodies, record text, or file names to logs.
8. **Privacy and compliance:** add a privacy notice, consent capture, data retention rules, and a process for deletion and export requests. Review them against the regulations that apply to you (for example India's DPDP Act 2023 and your health-data policy).
9. **Hosting:** any Node.js 20+ host works (for example a container on Azure, GCP, AWS, or Render). Mount persistent storage for the SQLite file and uploads if you keep SQLite.

---

## Safety and content rules

- The app never diagnoses. Results say "outside the reference range", "may indicate", or "discuss with your doctor".
- Values are only flagged when the reference range is printed on the source document.
- The assistant and the summary never tell a person to start, stop, or change a medicine, or to take a different one.
- The drug-interaction checker reports pairs that *may need review*. It does not advise changing a prescription.

## Known limitations (prototype)

- Demo authentication only. See "Official ABHA / ABDM integration".
- OCR and AI are deterministic mocks. They read sample text, not the uploaded image.
- Interaction data is a small fictional dataset. It is not a clinical reference.
- Single-instance SQLite and local file storage.

## License

Hackathon prototype. Add a license before any reuse.
