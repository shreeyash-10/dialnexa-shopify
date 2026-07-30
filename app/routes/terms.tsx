import type { MetaFunction } from "react-router";

/* eslint-disable react/no-unescaped-entities -- Legal prose is intentionally rendered verbatim. */

export const meta: MetaFunction = () => {
  return [{ title: "Terms and Conditions | DialNexa App" }];
};

export default function Terms() {
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
        Terms and Conditions for DialNexa Shopify App
      </h1>
      <p style={{ color: "#666" }}>
        <strong>Last Updated:</strong> July 31, 2026
      </p>

      <p>
        Welcome to the DialNexa App for Shopify ("we", "our", or "us"). By
        installing and using the DialNexa App ("App") in your Shopify store, you
        agree to comply with and be bound by the following Terms and Conditions.
        Please review them carefully.
      </p>

      <h2>1. App Functionality and Service</h2>
      <p>
        The App connects your Shopify store to an existing DialNexa account. The
        current release saves account configuration and displays available
        voice-agent templates. Customer-data workflows and automatic calls are
        unavailable until Shopify grants the required access and DialNexa
        explicitly enables production automation. DialNexa provides the separate
        voice-agent service.
      </p>

      <h2>2. Data Storage and Privacy</h2>
      <p>
        We have designed this App with a privacy-first, decentralized
        architecture. By using this App, you acknowledge and agree to the
        following data handling practices:
      </p>

      <h3>2.1 Your DialNexa Credentials</h3>
      <p>
        <strong>We do not store your DialNexa API keys on our servers.</strong>
        <br />
        When you enter your DialNexa API credentials into the App's dashboard,
        this information is saved directly to your Shopify store's secure
        internal database using <strong>Shopify App Metafields</strong>. The App
        retrieves these credentials only for requested App functions. If
        workflow automation is later enabled, we retain the non-secret DialNexa
        agent and call identifiers needed to provision agents, route calls,
        prevent duplicate work, and troubleshoot delivery.
      </p>

      <h3>2.2 Customer Data and PII (Protected Customer Data)</h3>
      <p>
        <strong>
          We do not log customer names, phone numbers, email addresses, mailing
          addresses, transcripts, or recordings, and we do not retain plaintext
          call payloads.
        </strong>
        <br />
        The current connector release does not activate customer-data workflows.
        If a merchant later enables an approved workflow, the App may use the
        Shopify scopes and webhooks required for that workflow. Those events and
        API queries can contain Protected Customer Data. Shopify data is fetched
        and processed in memory when a job runs. Authenticated integration
        payloads are encrypted while queued and deleted after dispatch, terminal
        failure, or skip. Pending stock-alert opt-ins are encrypted until
        notification or cancellation. We retain operational identifiers, keyed
        phone hashes, statuses, and post-call outcomes needed for suppression,
        duplicate prevention, and troubleshooting.
      </p>

      <h3>2.3 OAuth and Session Data</h3>
      <p>
        To maintain the authorization between the App and your Shopify store, we
        store standard OAuth access tokens and session identifiers in our
        database. This is required by Shopify to verify the authenticity of
        webhooks and API requests.
      </p>

      <h2>3. Your Responsibilities</h2>
      <ul>
        <li>
          <strong>Account Maintenance:</strong> You are responsible for
          maintaining an active DialNexa account and providing valid API
          credentials. We are not responsible for failed automated calls due to
          invalid DialNexa API keys, insufficient funds on your DialNexa
          account, or misconfigured Agent IDs.
        </li>
        <li>
          <strong>Compliance with Telecommunication Laws:</strong> You are
          solely responsible for ensuring that any automated outbound calls
          triggered by this App comply with all applicable local, state,
          national, and international laws, including but not limited to the
          Telephone Consumer Protection Act (TCPA) in the United States, GDPR in
          Europe, and any other telemarketing or privacy regulations. You must
          ensure you have the explicit consent of your customers to contact them
          via automated voice calls before enabling this App's functionality.
        </li>
      </ul>

      <h2>4. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, in no event shall we
        be liable for any indirect, punitive, incidental, special,
        consequential, or exemplary damages, including without limitation,
        damages for loss of profits, goodwill, use, data, or other intangible
        losses, arising out of or relating to the use of, or inability to use,
        the App. We are not responsible for any actions taken by the DialNexa AI
        Voice Agent during calls.
      </p>

      <h2>5. Changes to Terms</h2>
      <p>
        We reserve the right to modify these Terms and Conditions at any time.
        If we make material changes, we will notify you by updating the "Last
        Updated" date at the top of this document and through notifications
        within the App dashboard. Your continued use of the App following the
        posting of changes constitutes your acceptance of such changes.
      </p>

      <h2>6. Contact Information</h2>
      <p>
        If you have any questions or concerns regarding these Terms and
        Conditions, please contact us at support@dialnexa.com.
      </p>
    </div>
  );
}
