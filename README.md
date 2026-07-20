# Dialnexa Shopify App

This app integrates [Shopify](https://shopify.com) with the [Dialnexa](https://dialnexa.com) AI Voice Agent platform.

The app provisions a merchant-specific Dialnexa agent for each activated use case and runs calls from authenticated Shopify or integration events.

## Features

- **Privacy-First Database**: Stores Dialnexa API Keys and Agent IDs directly in Shopify Metafields instead of a third-party database.
- **Encrypted Queued Payloads**: Integration-triggered phone numbers and call metadata are encrypted with AES-256-GCM while queued and erased after dispatch, terminal failure, or skip.
- **Automated Call Triggers**: Maps Shopify Order variables (Customer Name, Order Number, Total Price) directly into your Dialnexa Agent's conversational variables.
- **Duplicate Protection**: Records Shopify order IDs and webhook IDs so webhook retries never create duplicate calls.
- **Merchant Safety Control**: Automatic calls remain disabled until the merchant explicitly enables them.

## Getting Started

### 1. Installation

1. Install this app on your Shopify Store.
2. In the App Dashboard, securely input your **Dialnexa API Key** and **Agent ID**.

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

The Vercel project must define `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
`SHOPIFY_APP_URL`, `SCOPES`, `DATABASE_URL`, `CRON_SECRET`, `PHONE_HASH_SECRET`,
`CALL_PAYLOAD_ENCRYPTION_KEY`, `INTEGRATION_API_SECRET`, and
`SUBSCRIPTION_PAYMENT_UPDATE_URL`. Each secret must be
independently generated; the encryption key must decode to exactly 32 bytes. Copy the
exact `SCOPES` value from `.env.example`. The database can be
Vercel Postgres, Neon, Supabase, or another PostgreSQL service accessible from the
deployment. `npm run vercel-build` generates Prisma Client and applies migrations.

After deploying, run `npm run deploy` with the production Shopify app configuration
to apply the configured scopes and webhook settings. The app registers order,
risk-assessment, fulfillment-event, inventory-level, app-owned subscription-billing,
and compliance webhooks.
Shopify separately reviews protected customer data access for public apps.

### Use-case execution

All 19 agent templates can be provisioned. Shopify-native adapters now cover new-order
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

The cron endpoint `/api/jobs/order-calls` scans eligible abandoned checkouts and opted-in
win-back segments, then drains both durable queues. Vercel invokes it once per minute using `CRON_SECRET`.
`GET /api/health` returns HTTP 200 only when the database is reachable and every required
production environment variable is present.

## Support

For issues relating to Dialnexa, visit [dialnexa.com](https://dialnexa.com).
