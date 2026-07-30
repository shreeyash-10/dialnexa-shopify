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
        apiKeyMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "api_key") {
          value
        }
        agentIdMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "agent_id") {
          value
        }
        callingEnabledMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "calling_enabled") {
          value
        }
      }
    }
  `);

  const { data } = await response.json();
  const agentId = data?.currentAppInstallation?.agentIdMetafield?.value || "";
  const hasApiKey = Boolean(
    data?.currentAppInstallation?.apiKeyMetafield?.value,
  );
  const callingEnabled =
    data?.currentAppInstallation?.callingEnabledMetafield?.value === "true";

  return { config: { agentId, hasApiKey, callingEnabled } };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const apiKey = String(formData.get("apiKey") || "").trim();
  const agentId = String(formData.get("agentId") || "").trim();
  const callingEnabled = formData.get("callingEnabled") === "on";

  if (!agentId) {
    return {
      success: false,
      errors: [{ message: "Agent ID is required." }],
    };
  }

  const installationResponse = await admin.graphql(`
    #graphql
    query DialnexaInstallationForUpdate {
      currentAppInstallation {
        id
        apiKeyMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "api_key") {
          value
        }
      }
    }
  `);
  const installationJson = await installationResponse.json();
  const appId = installationJson.data?.currentAppInstallation?.id;
  const hasExistingApiKey = Boolean(
    installationJson.data?.currentAppInstallation?.apiKeyMetafield?.value,
  );

  if (!appId || (callingEnabled && !apiKey && !hasExistingApiKey)) {
    return {
      success: false,
      errors: [
        {
          message: !appId
            ? "Could not load the current app installation."
            : "An API key is required before automatic calling can be enabled.",
        },
      ],
    };
  }

  const metafieldsSetInput = [
    {
      ownerId: appId,
      namespace: APP_METAFIELD_NAMESPACE,
      key: "agent_id",
      value: agentId,
      type: "single_line_text_field",
    },
    {
      ownerId: appId,
      namespace: APP_METAFIELD_NAMESPACE,
      key: "calling_enabled",
      value: String(callingEnabled),
      type: "boolean",
    },
  ];

  if (apiKey) {
    metafieldsSetInput.push({
      ownerId: appId,
      namespace: APP_METAFIELD_NAMESPACE,
      key: "api_key",
      value: apiKey,
      type: "single_line_text_field",
    });
  }

  const response = await admin.graphql(
    `
    #graphql
    mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafieldsSetInput) {
        userErrors {
          field
          message
        }
      }
    }
  `,
    {
      variables: {
        metafieldsSetInput,
      },
    },
  );

  const { data } = await response.json();
  if (data?.metafieldsSet?.userErrors?.length) {
    return { success: false, errors: data.metafieldsSet.userErrors };
  }

  return { success: true };
};

export default function Index() {
  const { config } = useLoaderData<typeof loader>();
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
          Enter your Dialnexa API Key and default Agent ID to connect your
          store. Once connected, this app will automatically trigger an outbound
          call whenever a new order is placed.
        </s-paragraph>

        <fetcher.Form method="POST" style={{ marginTop: "20px" }}>
          <s-stack direction="block" gap="base">
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <label
                htmlFor="apiKey"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Dialnexa API Key
              </label>
              <input
                id="apiKey"
                type="password"
                name="apiKey"
                autoComplete="new-password"
                placeholder={
                  config.hasApiKey
                    ? "Saved — enter a new key to replace it"
                    : "Enter API key"
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  marginBottom: "16px",
                }}
                required={!config.hasApiKey}
              />

              <label
                htmlFor="agentId"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Default Agent ID
              </label>
              <input
                id="agentId"
                type="text"
                name="agentId"
                defaultValue={config?.agentId || ""}
                placeholder="agt_..."
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
                required
              />

              <label
                htmlFor="callingEnabled"
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  marginTop: "16px",
                }}
              >
                <input
                  id="callingEnabled"
                  type="checkbox"
                  name="callingEnabled"
                  defaultChecked={config.callingEnabled}
                />
                Enable automatic calls for new orders
              </label>
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
            If calling is enabled and the order contains a valid international
            phone number, this app starts one Dialnexa call for that order.
          </s-list-item>
          <s-list-item>
            Duplicate Shopify webhook deliveries are ignored, and no customer
            phone number is stored by this app.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
