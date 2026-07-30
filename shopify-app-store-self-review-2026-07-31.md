# Shopify App Store AI self-review

Review date: 2026-07-31  
App: DialNexa  
Reviewed code commit: `9c46bda`, plus this review report  
Toolkit: Shopify AI Toolkit `shopify-app-store-review` v1.9.1  
Canonical checklist: fetched live from Shopify on 2026-07-31

## Summary

✅ **Likely passing:** 28  
❌ **Likely failing:** 0  
⚠️ **Needs review:** 3  
⏭️ **Groups skipped:** 10 _(see below)_

**Note:** The agent reviewed the subset of requirements Shopify selected as
checkable against a local codebase without browser context. Shopify will still
review these and additional requirements when the app is submitted.

**Submission verdict:** The code-side failures found in the previous review are
fixed. Do not mark “all App Store Requirements are met” or submit until the
billing decision and the external submission items below are resolved.

## ⚠️ Requirements that need review

⚠️ **1.2.1 Use Shopify App Pricing or the Shopify Billing API**

**Why this needs attention:** No Shopify billing implementation is required only
if every service required to use the app is genuinely free, or Shopify has
approved an exception in writing.

**What was detected:** The app connects to an existing DialNexa account and
requires an API key. No Shopify App Pricing, Billing API, or off-platform payment
code is present. The listing draft intentionally leaves pricing undecided
instead of making a false free or external-billing claim.

⚠️ **1.2.2 Implement Shopify App Pricing or the Shopify Billing API correctly**

**Why this needs attention:** If merchants must pay for the required DialNexa
service, the app needs a compliant charge approval, decline, reinstall, and
resubscription flow.

**What was detected:** No billing mutation or managed-pricing configuration is
present. This is acceptable only if the app and required service are truly free
or Shopify has granted a written exception.

⚠️ **1.2.3 Allow pricing plan changes**

**Why this needs attention:** If more than one paid plan is offered, merchants
must be able to upgrade or downgrade within Shopify without contacting support
or reinstalling.

**What was detected:** No in-app plan selection or plan-switching flow exists.
Whether one is required depends on the unresolved billing model.

## ❌ Requirements that are likely failing

None detected in the local codebase.

## Skipped groups

The following groups weren't evaluated because they don't apply to this
codebase or are opt-in:

- **5.1 Online store** — No theme app extension detected.
- **5.2 Payment** — No payment extension and no `write_payment_gateway` scope.
- **5.3 Payment facilitator** — Opt-in only; not requested.
- **5.4 Purchase option** — Required customer-payment/subscription/deferred-payment scopes aren't configured.
- **5.5 Product sourcing** — Opt-in only; not requested.
- **5.6 Checkout customization** — No checkout UI extension detected.
- **5.7 Sales channel** — No `channel_config` extension detected.
- **5.8 Post purchase** — No `checkout_post_purchase` extension detected.
- **5.9 Mobile app builders** — Opt-in only; not requested.
- **5.10 Donation** — Opt-in only; not requested.

## Fixed since the previous review

- Removed both manual shop-domain installation forms. Installation now begins
  on a Shopify-owned surface.
- Replaced unavailable automatic-call claims with accurate connector-only
  wording in the public page, embedded UI, listing draft, privacy policy, terms,
  and documentation.
- Added an explicit `ENABLE_AUTOMATION_WORKFLOWS` server gate. Pending
  customer-data webhooks, external triggers, worker jobs, workflow activation,
  and back-in-stock subscriptions cannot run in connector mode.
- Kept the customer-data workflow code and requested future scopes intact.
- Made health checks mode-aware so connector mode doesn't require inactive
  automation secrets.
- Moved the two iCloud conflict copies out of React Router and Prisma discovery
  while preserving them locally.
- Replaced boilerplate UI with a real Help and app-status page.

## Validation evidence

- ESLint: passed.
- Vitest: 7 files, 55 tests passed.
- TypeScript and React Router type generation: passed.
- React Router production build: passed.
- Shopify app build validation: passed.
- App Bridge: embedded `AppProvider` injects
  `https://cdn.shopify.com/shopifycloud/app-bridge.js`.
- Authentication: embedded routes use `authenticate.admin`, App Bridge session
  tokens, and Prisma session storage.
- Shopify Admin API: GraphQL calls only; no general REST Admin API usage found.
- Compliance webhooks: configured and authenticated.

## External items still required

1. Decide the billing model: Shopify App Pricing/Billing, written Shopify
   exception, or a genuinely free required DialNexa service.
2. Confirm whether the currently active `read_products` scope is necessary for
   connector-only v3; remove it from this version if it isn't required.
3. Add three real desktop screenshots, one 1600 × 900 feature image, a dedicated
   review account/API key/Agent ID, and a connector-flow screencast.
4. Open the production app from a development store and interact with Home, Use
   cases, and Help so Shopify's two-hour App Bridge and session-token checks
   receive fresh session data.
5. Keep automatic workflow activation disabled until Shopify approves the
   protected customer-data request and the matching production webhooks and
   secrets are deployed and tested.

## Resources

- [App Store requirements documentation](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Best practices for apps](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [About billing for your app](https://shopify.dev/docs/apps/launch/billing)
- [Submitting your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
