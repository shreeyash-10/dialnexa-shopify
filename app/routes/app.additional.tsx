export default function AdditionalPage() {
  return (
    <s-page heading="Help and app status">
      <s-section heading="Current release">
        <s-paragraph>
          This version connects your Shopify store to an existing DialNexa
          account and lets you review voice-agent templates.
        </s-paragraph>
        <s-paragraph>
          Customer-data workflows and automatic calls remain disabled while
          Shopify reviews the requested customer-data access and until
          production automation is explicitly enabled.
        </s-paragraph>
      </s-section>
      <s-section heading="Support">
        <s-paragraph>
          For setup help or questions about DialNexa, email{" "}
          <s-link href="mailto:support@dialnexa.com">
            support@dialnexa.com
          </s-link>
          .
        </s-paragraph>
      </s-section>
      <s-section slot="aside" heading="Policies">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/privacy" target="_blank">
              Privacy policy
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/terms" target="_blank">
              Terms and conditions
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
