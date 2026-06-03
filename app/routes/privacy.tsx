import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Privacy Policy | Dialnexa App" }];
};

export default function Privacy() {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2em', marginBottom: '10px' }}>Privacy Policy for Dialnexa Shopify App</h1>
      <p style={{ color: '#666' }}><strong>Last Updated:</strong> June 3, 2026</p>

      <p>At Dialnexa ("we", "our", or "us"), we prioritize your privacy and data security. This Privacy Policy outlines how we collect, use, and protect your information when you use the Dialnexa App ("App") for Shopify.</p>

      <h2>1. Information We Collect</h2>
      <p>Due to our decentralized architectural design, we collect the bare minimum information required for the App to function:</p>
      <ul>
        <li><strong>Shopify OAuth Data:</strong> When you install the App, we collect your store URL and store a Shopify-issued offline access token. This token is required by Shopify to authenticate webhooks and API requests on your behalf.</li>
      </ul>

      <h2>2. Information We DO NOT Collect or Store</h2>
      <p>We have intentionally designed the App so that sensitive information never resides on our databases:</p>
      <ul>
        <li><strong>Dialnexa API Keys:</strong> Your Dialnexa credentials are saved directly to your Shopify store's internal database (Shopify App Metafields). We do not store them on our servers.</li>
        <li><strong>Customer Personal Information (PII):</strong> When an order is placed on your store, Shopify sends a webhook containing customer data (such as names and phone numbers) to our servers so we can trigger the automated phone call. <strong>This data is processed in-memory and discarded immediately.</strong> We do not log, save, or store your customers' phone numbers, names, or addresses.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <p>The minimal information we do collect is used exclusively for:</p>
      <ul>
        <li>Authenticating your Shopify store's requests.</li>
        <li>Routing the automated webhook triggers to the Dialnexa API.</li>
        <li>Ensuring the security and integrity of the App's integration.</li>
      </ul>

      <h2>4. Data Sharing and Third Parties</h2>
      <p>We do not sell, rent, or trade any of your information to third parties. The App solely shares the necessary customer phone number and order details directly with the <strong>Dialnexa AI Voice API</strong> at the exact moment a call needs to be triggered, according to your configurations.</p>

      <h2>5. Data Retention and Deletion</h2>
      <p>If you uninstall the App from your Shopify store, we automatically delete your Shopify OAuth tokens from our database upon receiving the <code>app/uninstalled</code> webhook from Shopify. Since your Dialnexa configuration was saved in Shopify Metafields, that configuration is inherently tied to your Shopify store and is governed by Shopify's data retention policies.</p>

      <h2>6. Changes to This Privacy Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>

      <h2>7. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy or our data practices, please contact us at support@dialnexa.com.</p>
    </div>
  );
}
