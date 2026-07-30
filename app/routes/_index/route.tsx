import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>DialNexa for Shopify</h1>
        <p className={styles.text}>
          Connect an existing DialNexa account and prepare voice-agent workflows
          from Shopify admin.
        </p>
        <p className={styles.notice}>
          Installed merchants should open DialNexa from Shopify admin. New
          installations must begin from a Shopify-owned surface.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Secure account connection.</strong> Save a DialNexa API key
            without displaying it again.
          </li>
          <li>
            <strong>Voice-agent templates.</strong> Prepare dedicated agents
            using your store name, domain, currency, and timezone.
          </li>
          <li>
            <strong>Controlled rollout.</strong> Customer-data workflows remain
            unavailable until Shopify permissions and production automation are
            enabled.
          </li>
        </ul>
        <nav className={styles.links} aria-label="Legal and support">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:support@dialnexa.com">Support</a>
        </nav>
      </div>
    </div>
  );
}
