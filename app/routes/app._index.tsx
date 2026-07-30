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
import { automationWorkflowsEnabled } from "../services/automation-mode.server";

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

  return {
    automationEnabled: automationWorkflowsEnabled(),
    config: { agentId, hasApiKey, callingEnabled },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const apiKey = String(formData.get("apiKey") || "").trim();
  const agentId = String(formData.get("agentId") || "").trim();
  const automationEnabled = automationWorkflowsEnabled();
  const callingEnabled =
    automationEnabled && formData.get("callingEnabled") === "on";

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
  const { automationEnabled, config } = useLoaderData<typeof loader>();
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
    <s-page heading="DialNexa account connection">
      <s-section heading="Connect your DialNexa account">
        <s-paragraph>
          Save your DialNexa API key and default Agent ID for this store. Your
          API key is never displayed after it is saved.
        </s-paragraph>
        {!automationEnabled && (
          <s-banner tone="warning" heading="Workflow activation is pending">
            <s-paragraph>
              Shopify customer-data access has been requested. Automatic
              customer calls stay disabled until that access is approved and the
              production workflows are enabled.
            </s-paragraph>
          </s-banner>
        )}

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

              {automationEnabled && (
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
              )}
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

      {automationEnabled ? (
        <s-section heading="How automatic calling works">
          <s-unordered-list>
            <s-list-item>
              Shopify sends supported workflow events to the app.
            </s-list-item>
            <s-list-item>
              When calling is enabled and an event contains a valid
              international phone number, the app starts one DialNexa call.
            </s-list-item>
            <s-list-item>
              Duplicate event deliveries are ignored, and raw customer phone
              numbers are removed after processing.
            </s-list-item>
          </s-unordered-list>
        </s-section>
      ) : (
        <s-section heading="Current release">
          <s-unordered-list>
            <s-list-item>
              Connect an existing DialNexa account to this Shopify store.
            </s-list-item>
            <s-list-item>
              Save a default agent for future workflow configuration.
            </s-list-item>
            <s-list-item>
              No customer/order data is accessed and no automatic call is
              initiated while workflow activation is pending.
            </s-list-item>
          </s-unordered-list>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
