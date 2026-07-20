# Dialnexa Shopify App — Project Summary

**Status date:** 20 July 2026  
**Repository reviewed:** `dialnexa` (the separate `dialnexa-icloud-backup-20260715` directory is a historical backup and is not included in this status)

## Executive summary

Dialnexa is an embedded Shopify app that connects a merchant's store to the Dialnexa AI voice platform. It now supports Shopify-native automation for order assurance, delivery rescue, stock alerts, win-back campaigns, and app-owned subscription payment recovery, alongside a generic integration API for the remaining templates.

The repo now contains the full foundation needed for reliable outbound calling: Shopify authentication and webhooks, merchant configuration, merchant-specific Dialnexa agent creation, durable PostgreSQL job queues, duplicate prevention, retries, calling safeguards, result ingestion, privacy/compliance handlers, automated tests, and Vercel deployment configuration.

The implementation is technically healthy: all 53 automated tests pass, TypeScript type-checking passes, lint passes, and a production build completes successfully.

## Work completed

### Shopify app foundation

- Built as an embedded Shopify app using React Router, React, Shopify App Bridge, Prisma, and PostgreSQL.
- Shopify OAuth sessions are persisted in PostgreSQL, including support for rotating offline access tokens.
- App configuration declares the order, customer, fulfillment, inventory, product, and app-owned subscription scopes required by the connected workflows.
- Registered webhooks for new orders, risk assessments, fulfillment events, inventory updates, subscription billing failures, app uninstall, scope changes, and Shopify's mandatory compliance topics.
- Added merchant-facing Terms and Conditions and Privacy Policy pages.

### Merchant configuration and agent management

- Added an in-app settings page for securely saving the Dialnexa API key in Shopify app-owned metafields.
- Added a Use Cases page where merchants can create, activate, upgrade, and deactivate dedicated Dialnexa agents.
- Agent prompts are generated from reusable templates and automatically customized with the merchant's company name, domain, currency, and timezone.
- Added idempotent agent provisioning so duplicate requests do not create multiple agents for the same shop/use-case/template version.
- Activation requires the merchant to attest that the necessary lawful basis and customer consent are in place.
- Default safeguards are configured per activated use case: quiet hours from 8:00 PM to 9:00 AM and a one-call-per-recipient-per-24-hours limit.

### Voice use-case catalog

Nineteen structured voice-agent templates have been defined, each with its own goal, conversation flow, privacy instructions, required inputs, allowed outcomes, success criteria, and human follow-up rules:

1. New-order confirmation
2. COD order verification
3. High-risk order verification
4. Address confirmation
5. Abandoned checkout recovery
6. Failed delivery / NDR recovery
7. Shipping delay communication
8. Delivered-order feedback
9. Cancellation save
10. Return or refund support
11. Post-purchase cross-sell
12. Payment-pending reminder
13. Customer win-back
14. Replenishment reminder
15. Back-in-stock call
16. Draft-order / quote follow-up
17. Subscription payment recovery
18. Order-link assistance
19. Merchant-requested callback

The templates and runtime catalog are complete. Shopify-native trigger adapters now cover new orders, COD, high-risk orders, fulfillment failures/delays/delivery, abandoned checkouts, inventory-backed stock alerts, opted-in customer win-back segments, and app-owned subscription payment failures. Other workflows continue to use the authenticated generic integration API until a native or third-party adapter is configured.

### Reliable order-call workflow

- The `orders/create` webhook returns quickly after adding a durable job to PostgreSQL instead of making a Dialnexa API call inside the webhook request.
- Duplicate calls are prevented using unique shop/order and shop/webhook identifiers.
- A scheduled Vercel worker processes queued calls every minute.
- COD orders are routed to the COD verification agent when enabled; other eligible orders use the standard confirmation agent.
- The worker re-fetches the latest Shopify order data immediately before calling.
- Customer phone numbers must be valid E.164 numbers before a call can be made.
- Failed calls are retried with exponential backoff, with permanent client errors stopped immediately and transient failures capped at five attempts.
- Stale processing locks can be reclaimed, protecting the queue from interrupted workers.

### Generic workflow infrastructure

- Added an authenticated API for external integrations or merchant actions to enqueue any supported use case.
- Added validation for trigger type, Shopify domain, required metadata, payload size, phone format, scheduling time, and deduplication key.
- Sensitive generic call payloads are encrypted at rest and cleared after completion or terminal failure.
- Added a scheduled abandoned-checkout scanner and delayed-call flow as the first broader workflow implementation; it still needs the corresponding production Shopify access and rollout approval.
- Added `orders/risk_assessment_changed` routing for high-risk verification.
- Added `fulfillment_events/create` routing for failed delivery, shipping delay, and delayed post-delivery feedback.
- Added an encrypted, consent-recorded stock-alert waitlist that is released by `inventory_levels/update` only while the workflow is active.
- Added scheduled Shopify customer-segment scans for merchant-configured win-back campaigns.
- Added app-owned `subscription_billing_attempts/failure` handling with an approved secure payment-update URL.

### Safety, privacy, and compliance

- Dialnexa API keys and agent configuration are stored in Shopify app-owned metafields rather than the app database.
- The order queue does not persist raw customer names, phone numbers, email addresses, physical addresses, call recordings, or transcripts.
- Recipient phone numbers are represented operationally by a keyed hash, using a dedicated secret.
- Generic queued payloads are encrypted using a separate encryption key and deleted after processing.
- Added quiet-hours enforcement using the merchant's Shopify timezone.
- Added a configurable frequency cap, limited to a maximum of three successful calls per recipient in 24 hours.
- Added a suppression list. A customer `do_not_call` outcome automatically suppresses future calls to that recipient.
- Added Shopify customer-data request, customer-redaction, and shop-redaction webhook handling.
- App uninstall removes Shopify sessions and order-call operational records.
- Dialnexa-created agents opt out of sensitive data storage and enforce call duration, silence, and ring-time limits.

### Call outcomes and follow-up

- Added an authenticated endpoint for receiving structured Dialnexa call outcomes.
- Outcomes are validated against the exact allowed values for the relevant workflow.
- The app stores whether the call was resolved, its business outcome, whether human follow-up is required, and completion time.
- Both order calls and generic use-case calls can be matched using the Dialnexa call ID.

### Deployment and operations

- Migrated Prisma from SQLite to production-ready PostgreSQL.
- Added database migrations for order jobs, generic use-case jobs, call suppression, agent provisioning, and call outcomes.
- Added a Vercel production build command that generates Prisma Client, deploys migrations, and builds the app.
- Added a one-minute Vercel cron configuration for queue processing and scheduled workflow scans.
- Added `.env.example` documenting Shopify, PostgreSQL, cron authentication, hashing, encryption, and integration secrets.
- Updated Shopify production configuration to API version `2026-04`, the deployed Vercel URL, expanded workflow webhook subscriptions, and their required scopes.
- Added an agent-template export script and generated `agent-templates.json` for review or reuse outside the application.

## Current architecture

1. Shopify sends an authenticated event, or an approved external integration submits a call request.
2. The app validates the request and writes an idempotent job to PostgreSQL.
3. A bearer-authenticated Vercel cron invokes the worker every minute.
4. The worker revalidates merchant configuration, consent, quiet hours, suppression status, frequency limits, phone format, and current Shopify state.
5. The worker calls Dialnexa using the correct merchant-specific agent and records the Dialnexa call ID and delivery status.
6. Dialnexa outcomes are received separately and stored as structured operational results; do-not-call outcomes update the suppression list.

## Verification completed

The following checks were run against the current working tree on 20 July 2026:

| Check | Result |
| --- | --- |
| Automated tests (`npm test`) | Passed: 6 test files, 53 tests |
| TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed |
| Production build (`npm run build`) | Passed |

The test run emitted non-blocking React Router v8 future-flag notices and local file-watcher `EMFILE` warnings, but the suite completed successfully with no failed tests.

## Current limitations and remaining work

- **Shopify approval and reauthorization are required.** The expanded customer, fulfillment, inventory, product, and app-owned subscription scopes must be approved and existing installations must grant them before the new adapters can run.
- **External ownership boundaries remain.** Shopify's subscription webhook covers only contracts owned by this app; third-party subscription and carrier platforms must use the authenticated integration API when they do not write Shopify-native events.
- **Live rollout validation remains.** The new webhook routes, protected customer data access, cron scans, and real Dialnexa callbacks still need staging validation with approved Shopify scopes.
- **Merchant reporting is not yet built.** There is no dashboard yet for calls placed, answer rate, confirmations, recovered revenue, prevented RTO, escalations, or failures.
- **Active settings updates require reactivation.** Quiet hours, frequency caps, win-back segment rules, and offers are merchant-controlled during activation; a dedicated edit-without-reactivation experience would improve usability.
- **Legacy settings need consolidation.** The Home page retains the previous default Agent ID and calling toggle for existing installations, while the new queue uses per-use-case activation. This should be migrated or removed to avoid two configuration paths.
- **Working tree is not yet packaged for handoff.** Most of the current implementation is modified or newly added after commit `a89f402`; it should be reviewed, committed, and deployed as a controlled release.

## Recommended next steps

1. Obtain Shopify approval for the expanded scopes/protected customer data and reauthorize the staging store.
2. Run a full staging test with a Shopify development store, production-like PostgreSQL, Vercel cron, all new webhooks, and Dialnexa callbacks.
3. Consolidate the legacy settings into the per-use-case configuration and add edit-in-place workflow settings.
4. Commit the current working tree, tag a release, deploy it, and verify database migrations and webhook registration.
5. Add merchant-visible call history, outcomes, follow-up queues, and basic KPI reporting.
6. Add further native adapters one at a time for the remaining generic workflows, with their required consent rules and tests.

## Overall assessment

The project has progressed from a synchronous single-call Shopify integration into a tested, queue-based multi-workflow voice automation platform with Shopify-native adapters for the priority event families. The implementation builds cleanly. The main work remaining is external rollout work: Shopify scope/protected-data approval, store reauthorization, live end-to-end testing, and packaging the uncommitted implementation into a controlled deployment.
