# DialNexa Shopify App

This app connects [Shopify](https://shopify.com) with the [DialNexa](https://dialnexa.com) AI Voice Agent platform.

The production app currently runs in connector mode: merchants can save an
existing DialNexa account and default agent, and review the available
voice-agent templates. Protected customer-data workflows remain disabled until
Shopify approval and an explicit production rollout.

## Features

- **Privacy-First Configuration**: Stores DialNexa API Keys and Agent IDs directly in Shopify Metafields instead of the app database.
- **Encrypted Queued Payloads**: Integration-triggered phone numbers and call metadata are encrypted with AES-256-GCM while queued and erased after dispatch, terminal failure, or skip.
- **Protected Automation Gate**: Automatic jobs, customer-data webhooks, and integration-triggered calls cannot run unless `ENABLE_AUTOMATION_WORKFLOWS=true`.
- **Duplicate Protection**: Records Shopify order IDs and webhook IDs so webhook retries never create duplicate calls.
- **Merchant Safety Control**: Automatic calls remain disabled until the merchant explicitly enables them.

## Getting Started

### 1. Installation

1. Install this app on your Shopify Store.
2. In the App Dashboard, securely input your **DialNexa API Key** and **Agent ID**.

### 2. Legal / Requirements

You must obtain consent from your customers to contact them via automated voice calls in accordance with local telemarketing laws (e.g. TCPA/GDPR).

- [Terms and Conditions](/terms)
- [Privacy Policy](/privacy)

### 3. Development

This app was built using the Shopify App Remix (React Router) template.

- Use `npm run dev` to start the local development server.
- Uses Prisma and PostgreSQL for durable Shopify OAuth sessions and non-PII call delivery status.

Copy `.env.example` to `.env`, fill in the Shopify credentials and a PostgreSQL
`DATABASE_URL`, then run:

```sh
npm install
npm run setup
npm run dev
```

### 4. Production deployment

Connector mode requires `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
`SHOPIFY_APP_URL`, `SCOPES`, and `DATABASE_URL`.
Keep `ENABLE_AUTOMATION_WORKFLOWS=false` until Shopify has approved the
requested customer-data access and the matching webhook subscriptions have been
deployed and tested.

Automation mode additionally requires `CRON_SECRET`, `PHONE_HASH_SECRET`,
`CALL_PAYLOAD_ENCRYPTION_KEY`, `INTEGRATION_API_SECRET`, and
`SUBSCRIPTION_PAYMENT_UPDATE_URL`. Each secret must be independently generated;
the encryption key must decode to exactly 32 bytes. The database can be
Vercel Postgres, Neon, Supabase, or another PostgreSQL service accessible from the
deployment. `npm run vercel-build` generates Prisma Client and applies migrations.

After deploying, run `npm run deploy` with the production Shopify app configuration
to apply only the scopes and webhook settings approved for that release. The
current connector configuration registers lifecycle and compliance webhooks.
Workflow webhooks must be added only after Shopify approves the corresponding
protected customer-data access.

### Future automation mode

The codebase includes 19 agent templates. When automation is approved and
explicitly enabled, Shopify-native adapters can cover new-order
confirmation, COD verification, high-risk verification, failed delivery, shipping delay,
delivery feedback, abandoned checkout, back-in-stock opt-ins, customer-segment win-back,
and app-owned subscription payment failures. Other workflows accept authenticated events at `POST /api/use-case-calls` from
merchant, carrier, fraud, returns, support, or subscription integrations. The request must
use `Authorization: Bearer $INTEGRATION_API_SECRET`, a stable `dedupe_key`, E.164
`phone_number`, one of the runtime catalog's allowed `source` values, and the template's
required metadata. Post-call results can be written idempotently through
`POST /api/use-case-call-outcomes` using the same bearer secret.
`GET /api/use-case-calls` returns the complete authenticated runtime contract for all
templates, including allowed triggers, scopes, and required/allowed metadata fields.

Back-in-stock opt-ins are registered or cancelled through
`POST /api/back-in-stock-subscriptions`; registration requires an inventory item ID,
E.164 phone, product context, stable dedupe key, and explicit consent timestamp.

When automation is enabled, the cron endpoint `/api/jobs/order-calls` scans eligible abandoned checkouts and opted-in
win-back segments, then drains both durable queues. Vercel invokes it once per minute using `CRON_SECRET`.
`GET /api/health` reports connector or automation mode and requires only the
environment variables needed for that mode.

## Support

For issues relating to DialNexa, visit [dialnexa.com](https://dialnexa.com).
