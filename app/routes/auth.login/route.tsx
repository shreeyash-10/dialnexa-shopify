import { AppProvider } from "@shopify/shopify-app-react-router/react";

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <s-page heading="Open DialNexa from Shopify admin">
        <s-section>
          <s-paragraph>
            For your security, DialNexa installations and sign-ins begin on a
            Shopify-owned surface. Open Shopify admin, select Apps, then select
            DialNexa.
          </s-paragraph>
          <s-link href="/">Return to DialNexa</s-link>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
