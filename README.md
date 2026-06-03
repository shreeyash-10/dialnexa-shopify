# Dialnexa Shopify App

This app integrates [Shopify](https://shopify.com) with the [Dialnexa](https://dialnexa.com) AI Voice Agent platform.

Whenever a customer places an order on your Shopify store, this app automatically triggers an outbound AI voice call to the customer via Dialnexa. 

## Features
- **Privacy-First Database**: Stores Dialnexa API Keys and Agent IDs directly in Shopify Metafields instead of a third-party database.
- **Zero-Storage PII**: Listens to Shopify `orders/create` webhooks and processes customer phone numbers entirely in-memory without ever saving them to disk.
- **Automated Call Triggers**: Maps Shopify Order variables (Customer Name, Order Number, Total Price) directly into your Dialnexa Agent's conversational variables.

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
- Uses Prisma and SQLite (or PostgreSQL in production) exclusively for Shopify OAuth session management.

## Support
For issues relating to Dialnexa, visit [dialnexa.com](https://dialnexa.com).
