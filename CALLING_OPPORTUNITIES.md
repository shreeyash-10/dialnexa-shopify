# Shopify Calling Opportunities

## Current baseline

The repository now has a durable multi-workflow foundation. Shopify-native adapters cover
new orders, high-risk assessments, fulfillment failures/delays/delivery, abandoned
checkouts, inventory-backed stock alerts, opted-in win-back segments, and app-owned
subscription billing failures. The baseline includes the current Dialnexa `/v1/calls`
contract, PostgreSQL-backed sessions and queues, duplicate protection, transient retries,
E.164 validation, outcome ingestion, quiet hours, frequency caps, suppression, and an
explicit merchant activation and consent switch.

The app configuration now includes the scopes and webhook adapters for order risk,
fulfillment events, inventory-driven stock alerts, opted-in customer segments, and
app-owned subscription billing failures. Shopify protected customer data approval is
still required for customer name and phone fields. Each workflow remains disabled until
the merchant activates it and attests consent.

## Prioritized opportunities

| Priority | Calling workflow               | Shopify signal                                                                                                             | Call goal                                                                         | Why it matters                                                      |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| P0       | COD order verification         | `orders/create`; check payment gateway and pending payment status                                                          | Confirm order, address, and delivery intent                                       | Reduces fake COD orders and RTO before fulfillment cost is incurred |
| P0       | High-risk order verification   | `orders/risk_assessment_changed`                                                                                           | Verify buyer and flag suspicious orders for review                                | Reduces fraud and chargeback exposure                               |
| P0       | Abandoned checkout recovery    | `checkouts/create` / `checkouts/update`, followed by a delay and completion check; or scheduled `abandonedCheckouts` query | Resolve checkout objections and guide the buyer back to the recovery URL          | Direct revenue recovery from high-intent shoppers                   |
| P0       | Failed delivery / NDR recovery | `fulfillment_events/create`; filter for failed attempt, address issue, or delayed delivery states                          | Confirm availability, correct directions/address, or arrange reattempt            | Reduces RTO and support load                                        |
| P1       | Shipping delay communication   | `fulfillment_events/create` or fulfillment updates                                                                         | Proactively explain delay and set expectations                                    | Prevents WISMO contacts and cancellations                           |
| P1       | Delivered-order feedback       | Delivery event, delayed by a configurable interval                                                                         | Collect CSAT/NPS, detect complaints, request review only after a positive outcome | Improves retention and catches problems early                       |
| P1       | Cancellation save              | `orders/cancelled` or a merchant-triggered call before cancellation is finalized                                           | Learn the reason and offer an allowed remedy or alternate item                    | Recovers some cancellations and captures structured reasons         |
| P1       | Return or refund support       | Return/refund webhook topics                                                                                               | Confirm pickup/details, offer exchange where appropriate, explain timeline        | Reduces refund anxiety and can shift refunds to exchanges           |
| P1       | Post-purchase cross-sell       | `orders/fulfilled` or delivered event plus delay                                                                           | Recommend compatible/replenishment products                                       | Generates repeat revenue from known customers                       |
| P2       | Payment-pending reminder       | `orders/updated`; detect transition or prolonged pending state                                                             | Help the buyer complete payment or choose another method                          | Recovers unpaid orders                                              |
| P2       | Customer win-back              | Scheduled customer/order segment query                                                                                     | Re-engage lapsed opted-in customers with a relevant offer                         | Creates recurring campaign revenue                                  |
| P2       | Replenishment reminder         | Scheduled job based on product-specific reorder interval                                                                   | Remind customers when a consumable is likely to run out                           | Strong fit for beauty, supplements, pet care, and groceries         |
| P2       | Back-in-stock call             | `inventory_levels/update` plus an app-owned opt-in/waitlist                                                                | Notify opted-in shoppers that an item is available                                | Converts demand faster than passive notifications                   |
| P2       | Draft-order / quote follow-up  | `draft_orders/create` / `draft_orders/update`                                                                              | Answer questions and help complete high-value or B2B orders                       | Useful for wholesale, custom products, and assisted sales           |
| P2       | Subscription payment recovery  | Subscription billing-attempt signals where available to the installed app                                                  | Update payment method and prevent involuntary churn                               | Protects recurring revenue                                          |
| P2       | Order-link assistance          | `orders/link_requested`                                                                                                    | Help customers regain access to order details                                     | Timely support signal introduced in Shopify API 2026-01             |
| P3       | Merchant-requested callback    | Shopify Admin action/extension on an order or customer                                                                     | Let staff launch a contextual call on demand                                      | Covers VIP recovery, escalations, and edge cases without automation |

## Recommended first product bundle

### 1. Order Assurance

- New-order confirmation
- COD verification
- High-risk order verification
- Address confirmation

This is the closest extension of the current code and can share a single order-event
pipeline. Each rule should support its own agent, delay, retry policy, and eligibility
conditions.

### 2. Delivery Rescue

- Shipping delay notification
- Failed-delivery/NDR recovery
- Delivery rescheduling or human escalation

This has a clear merchant ROI story: fewer support contacts and fewer returned shipments.

### 3. Revenue Recovery

- Abandoned checkout calls
- Pending-payment recovery
- Cancellation save

Calls must be delayed and re-check current Shopify state immediately before dialing so a
buyer is never called after completing checkout, paying, or cancelling.

### 4. Retention

- Delivered-order feedback
- Complaint detection and escalation
- Replenishment and win-back campaigns
- Contextual cross-sell

Marketing calls should be strictly separated from transactional calls and require the
merchant to configure consent and suppression rules.

## Platform changes required

1. **Workflow configuration**: Replace the single default Agent ID with one configuration
   per workflow: enabled state, Agent ID, delay, retries, quiet hours, filters, and variables.
2. **Event ingestion**: Use a shared webhook handler that verifies the request, normalizes
   the topic, and enqueues work instead of placing the call inside the webhook request.
3. **Delayed jobs**: Add a durable queue for abandonment checks, post-delivery calls,
   retries, and scheduled campaigns.
4. **State revalidation**: Query Shopify immediately before delayed calls to confirm the
   order/checkout still qualifies.
5. **Idempotency**: Deduplicate using the Shopify webhook ID and a workflow + resource ID
   key. Shopify can retry webhook delivery.
6. **Outcome loop**: Receive DialNexa call-status/results webhooks and store only the
   minimum operational data needed: call ID, workflow, resource reference, status,
   disposition, timestamps, and retry count.
7. **Suppression controls**: Enforce consent, do-not-call status, quiet hours, frequency
   caps, country rules, and merchant exclusions before every call.
8. **Merchant dashboard**: Show calls placed, answered, confirmed, recovered revenue,
   prevented RTO, escalations, and failures by workflow.
9. **Protected customer data**: Request only the Shopify protected customer fields needed
   for enabled workflows and safely handle redacted phone/name/address values.
10. **Privacy lifecycle**: Implement the mandatory customer data request/redaction and shop
    redaction webhooks before public distribution.

## Suggested build order

1. ~~Make new-order calling functional and reliable.~~ Completed.
2. Add configurable COD confirmation using the existing order payload.
3. ~~Add Dialnexa call status/outcome ingestion.~~ Completed.
4. ~~Add high-risk order calls.~~ Completed for Shopify `HIGH` assessments.
5. ~~Add fulfillment-event ingestion and NDR/delay workflows.~~ Completed.
6. ~~Add a durable scheduler, then abandoned checkout recovery.~~ Completed; live rollout validation remains.
7. Add post-delivery feedback and merchant reporting.
8. Add scheduled retention campaigns only after consent and suppression controls exist.
