import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>
          Automated Shopify order calls with Dialnexa
        </h1>
        <p className={styles.text}>
          Confirm new orders automatically with a personalized AI voice call.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Automatic order confirmation.</strong> Start a call when a
            customer completes checkout.
          </li>
          <li>
            <strong>Personalized conversations.</strong> Pass the customer name,
            order number, amount, and currency to your Dialnexa agent.
          </li>
          <li>
            <strong>Privacy-first processing.</strong> Customer phone numbers
            are used in memory and are not stored by this app.
          </li>
        </ul>
      </div>
    </div>
  );
}
