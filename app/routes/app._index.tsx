import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

const APP_METAFIELD_NAMESPACE = "dialnexa";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(`
    #graphql
    query {
      currentAppInstallation {
        id
        apiKeyMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "api_key") {
          value
        }
        agentIdMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "agent_id") {
          value
        }
      }
    }
  `);

  const { data } = await response.json();
  const appId = data?.currentAppInstallation?.id;
  const apiKey = data?.currentAppInstallation?.apiKeyMetafield?.value || "";
  const agentId = data?.currentAppInstallation?.agentIdMetafield?.value || "";

  return { appId, config: { apiKey, agentId } };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const apiKey = String(formData.get("apiKey"));
  const agentId = String(formData.get("agentId"));
  const appId = String(formData.get("appId"));

  const response = await admin.graphql(`
    #graphql
    mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafieldsSetInput) {
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      metafieldsSetInput: [
        {
          ownerId: appId,
          namespace: APP_METAFIELD_NAMESPACE,
          key: "api_key",
          value: apiKey,
          type: "single_line_text_field"
        },
        {
          ownerId: appId,
          namespace: APP_METAFIELD_NAMESPACE,
          key: "agent_id",
          value: agentId,
          type: "single_line_text_field"
        }
      ]
    }
  });

  const { data } = await response.json();
  if (data?.metafieldsSet?.userErrors?.length) {
    return { success: false, errors: data.metafieldsSet.userErrors };
  }

  return { success: true, config: { apiKey, agentId } };
};

export default function Index() {
  const { appId, config } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Dialnexa settings saved successfully");
    } else if (fetcher.data?.errors) {
      shopify.toast.show("Error saving settings");
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Dialnexa App Integration">
      <s-section heading="Connect your Dialnexa Account">
        <s-paragraph>
          Enter your Dialnexa API Key and default Agent ID to connect your store. 
          Once connected, this app will automatically trigger an outbound call whenever a new order is placed.
        </s-paragraph>
        
        <fetcher.Form method="POST" style={{ marginTop: '20px' }}>
          <input type="hidden" name="appId" value={appId} />
          <s-stack direction="block" gap="base">
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Dialnexa API Key</label>
              <input 
                type="password" 
                name="apiKey" 
                defaultValue={config?.apiKey || ""} 
                placeholder="sk_..."
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '16px'}}
                required
              />
              
              <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Default Agent ID</label>
              <input 
                type="text" 
                name="agentId" 
                defaultValue={config?.agentId || ""} 
                placeholder="agent_..."
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                required
              />
            </s-box>

            <s-button
              type="submit"
              {...(isLoading ? { loading: true } : {})}
              variant="primary"
            >
              Save Settings
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>
            We have registered an `ORDERS_CREATE` webhook on your Shopify store.
          </s-list-item>
          <s-list-item>
            When a customer completes a checkout, Shopify notifies this app.
          </s-list-item>
          <s-list-item>
            This app uses the API Key and Agent ID above to trigger an outbound call to the customer via Dialnexa.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
