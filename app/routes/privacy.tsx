import type { MetaFunction } from "react-router";

/* eslint-disable react/no-unescaped-entities -- Legal prose is intentionally rendered verbatim. */

export const meta: MetaFunction = () => {
  return [{ title: "Privacy Policy | DialNexa App" }];
};

export default function Privacy() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui, sans-serif",
        lineHeight: "1.6",
      }}
    >
      <h1 style={{ fontSize: "2em", marginBottom: "10px" }}>
        Privacy Policy for DialNexa Shopify App
      </h1>
      <p style={{ color: "#666" }}>
        <strong>Last Updated:</strong> July 31, 2026
      </p>

      <p>
        At DialNexa ("we", "our", or "us"), we prioritize your privacy and data
        security. This Privacy Policy outlines how we collect, use, and protect
        your information when you use the DialNexa App ("App") for Shopify.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        Due to our decentralized architectural design, we collect the bare
        minimum information required for the App to function:
      </p>
      <ul>
        <li>
          <strong>Shopify OAuth Data:</strong> When you install the App, we
          collect your store URL and store a Shopify-issued offline access
          token. This token is required by Shopify to authenticate webhooks and
          API requests on your behalf.
        </li>
        <li>
          <strong>Operational Call Data:</strong> Customer-data workflows are
          disabled in the current connector release. If an approved workflow is
          later enabled, we store Shopify resource and webhook identifiers,
          use-case identifiers, call status, retry count, timestamps, a one-way
          keyed phone hash, post-call outcome, and the DialNexa call identifier
          when available. Integration-triggered phone numbers and call metadata
          are encrypted while queued and deleted after dispatch, terminal
          failure, or skip. Back-in-stock opt-in details are encrypted while the
          alert is pending and deleted after notification, cancellation,
          customer redaction, shop redaction, or uninstall.
        </li>
      </ul>

      <h2>2. Information We Limit or Do Not Store</h2>
      <p>
        We have intentionally designed the App so that sensitive information is
        never stored in plaintext in our operational databases:
      </p>
      <ul>
        <li>
          <strong>DialNexa API Keys:</strong> Your DialNexa credentials are
          saved directly to your Shopify store's internal database (Shopify App
          Metafields). We do not store them on our servers.
        </li>
        <li>
          <strong>Plaintext Customer Information:</strong> Shopify-triggered
          order details are fetched only when a queued job runs and processed in
          memory. For authenticated integration events, customer phone numbers
          and call metadata are stored only as an AES-256-GCM encrypted queue
          payload, never logged, and erased as soon as the job reaches a
          terminal state. Pending stock-alert opt-ins use the same encryption
          until fulfilled or cancelled. We do not store call recordings or
          transcripts.
        </li>
      </ul>

      <h2>3. How We Use Information</h2>
      <p>The minimal information we collect is used exclusively for:</p>
      <ul>
        <li>Authenticating your Shopify store's requests.</li>
        <li>
          Routing approved automated workflow triggers to the DialNexa API when
          automation is enabled.
        </li>
        <li>Ensuring the security and integrity of the App's integration.</li>
        <li>Preventing duplicate calls and diagnosing failed call requests.</li>
      </ul>

      <h2>4. Data Sharing and Third Parties</h2>
      <p>
        We do not sell, rent, or trade any of your information to third parties.
        The App solely shares the necessary customer phone number and order
        details directly with the <strong>DialNexa AI Voice API</strong> only
        when an approved workflow is enabled and a call is triggered according
        to your configuration.
      </p>

      <h2>5. Data Retention and Deletion</h2>
      <p>
        If you uninstall the App from your Shopify store, we automatically
        delete your Shopify OAuth tokens and operational call records from our
        database upon receiving the <code>app/uninstalled</code> webhook from
        Shopify. We also process Shopify's mandatory customer and shop redaction
        webhooks. Since your DialNexa configuration is saved in Shopify
        Metafields, that configuration is tied to your Shopify store and
        governed by Shopify's data retention policies.
      </p>

      <h2>6. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of any significant changes by posting the new Privacy Policy on this
        page and updating the "Last Updated" date.
      </p>

      <h2>7. Contact Us</h2>
      <p>
        If you have any questions about this Privacy Policy or our data
        practices, please contact us at support@dialnexa.com.
      </p>
    </div>
  );
}
