# DialNexa Shopify App Store listing draft

> Connector-only v3 draft. Do not advertise automatic calling in this version.
> Before submission, resolve the Shopify Billing requirement and provide the
> real media and review credentials listed at the end.

## Basic app information

**App name**

DialNexa

**Primary category**

Store management > Support > Support - Other

**Category explanation**

DialNexa helps merchants connect an existing voice-agent account and review
available agent templates from Shopify admin.

**Languages**

English

## App Store listing content

**App introduction — 92/100 characters**

Connect your DialNexa account and review voice-agent templates from Shopify.

**App details — 489/500 characters**

DialNexa connects an existing Voice AI account to your store. Save an API key and default agent without revealing the saved key, then review voice-agent templates from Shopify admin. This connector release does not access Shopify customer or order data and does not initiate automatic calls. Customer-data workflows remain unavailable until Shopify permissions and production activation are complete.

**Features**

1. Connect an existing DialNexa account from the Shopify admin
2. Choose and save a default voice agent
3. Review available voice-agent workflow templates
4. Keep saved DialNexa credentials out of the app database
5. See workflow approval and activation status in the app

**Demo store URL**

Leave blank unless a Shopify demo store owned by DialNexa is available. Do not
enter a general DialNexa website URL.

**Integrations**

DialNexa Voice AI

## Feature media and screenshots

These must show the real app UI. Do not generate or mock functionality that a
reviewer cannot test.

**Feature image required**

- Size: 1600 x 900 px, JPG or PNG
- Suggested composition: a clean crop of the real connector dashboard with the
  heading “Connect DialNexa to your store”
- Do not use the Shopify logo, browser chrome, a desktop background, customer
  data, or a text-heavy layout.

**Desktop screenshot 1**

- View: DialNexa account and default agent settings
- Use fictional values and redact the API key.
- Alt text: `DialNexa account and default voice agent settings`

**Desktop screenshot 2**

- View: Voice workflow or use-case catalog
- Alt text: `Voice workflow template catalog in the store admin`

**Desktop screenshot 3**

- View: Help and app-status page
- Alt text: `DialNexa connector status and support information`

## Support and resources

**Preferred support channel**

Email

**Support email**

support@dialnexa.com

**Support portal**

Leave blank until a dedicated, working support portal is available.

**Support phone**

Leave blank.

**Privacy policy**

https://dialedin-pi.vercel.app/privacy

**Developer website**

https://dialnexa.com

**FAQ**

https://dialnexa.com/faq

**Pricing information**

Leave blank until Shopify confirms the approved billing path for the connected
DialNexa service.

**Additional documentation**

https://dialnexa.com/docs

**Changelog and tutorial**

Leave blank until app-specific pages are published.

## Pricing details

**Decision required before submission**

The app currently requires an existing DialNexa account but does not implement
Shopify Billing. Do not enter `$0`, claim “free to install,” link to off-platform
pricing, or select the external-billing approval option unless those statements
are accurate and Shopify has confirmed the arrangement in writing. Either add
Shopify App Pricing/Billing, obtain Shopify's written exception, or make every
service required by this connector genuinely free.

## App discovery content

**App card subtitle — 54/62 characters**

Connect and review AI voice agents from Shopify admin

**Search terms**

1. voice automation
2. voice agent
3. account connector
4. customer support
5. workflow templates

**Web search title — 50/60 characters**

DialNexa Voice AI Connector for Shopify Stores

**Meta description — 111/160 characters**

Connect an existing DialNexa account, save a default agent, and review voice-agent templates from Shopify admin.

## Install requirements

**Sales channel requirements**

Select: `My app doesn't require the Shopify Online Store or Shopify POS`

**Geographic requirements**

Leave all options unselected unless DialNexa intentionally limits this app to
specific merchant countries, shipping destinations, or currencies.

## Tracking information

Leave Google Analytics, remarketing, and Meta Pixel fields blank unless DialNexa
has approved production tracking IDs and an applicable consent/privacy setup.

## Contact information

**Merchant review email**

support@dialnexa.com

**App submission email**

support@dialnexa.com

Use a different monitored address here only if `support@dialnexa.com` does not
reach the team responsible for Shopify review questions.

## App testing information

**Test account selection**

Choose `Login details`. Do not choose “My app doesn't require an account,”
because reviewers need a working DialNexa account, API key, and published test
agent.

**Username**

`[DEDICATED SHOPIFY REVIEW ACCOUNT EMAIL]`

**Password**

`[DEDICATED SHOPIFY REVIEW ACCOUNT PASSWORD]`

**Account description**

Dedicated DialNexa account for Shopify App Review. It has no two-factor
authentication, contains a published test voice agent, and provides the API key
and Agent ID used in the embedded app. Do not use production customer data.

**Screencast URL**

`[UNLISTED YOUTUBE OR LOOM URL]`

Record a short English video showing installation from Shopify, initial embedded
app load, account connection, the saved-key state, the template catalog, and the
help/status page. Do not show an automatic call in the connector-only v3 video.

**Testing instructions**

```text
To test DialNexa:

1. Install the app and approve the requested permissions. The embedded app opens in the Shopify admin.
2. Sign in to the dedicated DialNexa review account using the credentials above. No two-factor authentication is required.
3. In the DialNexa dashboard, copy the review API key and the Agent ID of the published test agent.
4. Return to the embedded app. Enter the API key and Agent ID, then click Save Settings.
5. Reload the app. Confirm that the Agent ID remains visible and the API key is shown as saved without revealing its value.
6. Open Use cases. Confirm that the voice-agent templates are visible and clearly marked preview-only while workflow activation is pending.
7. Open Help. Confirm that support, privacy, terms, and the current release status are available.

The connector-only v3 does not access customer/order data or initiate calls. The
reviewer can use [REVIEW SUPPORT EMAIL] for immediate assistance.
```

## Items still required before submission

1. Three real desktop screenshots and one 1600 x 900 feature image
2. A dedicated DialNexa review account with no 2FA, a working API key, and a
   published test agent
3. An unlisted connector-flow screencast
4. Confirmation that separate DialNexa usage billing is permitted, or migration
   of app charges to Shopify App Pricing/Billing

Protected customer-data approval and workflow webhooks are still required for a
later version that advertises or enables automatic customer calls; they are not
part of this connector-only v3 listing.
