import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  claimAgentProvisioning,
  completeAgentProvisioning,
  failAgentProvisioning,
} from "../services/agent-provisioning.server";
import { createDialnexaAgent } from "../services/dialnexa.server";
import {
  AGENT_TEMPLATE_VERSION,
  buildAgentFromTemplate,
  getUseCase,
  USE_CASES,
  type CompanyDetails,
} from "../services/use-cases.server";
import { getRuntimeUseCase } from "../services/use-case-runtime";

const APP_METAFIELD_NAMESPACE = "dialnexa";
const USE_CASES_KEY = "use_cases";

interface ActivatedUseCase {
  agentId: string;
  enabled: boolean;
  templateVersion: number;
  activatedAt: string;
  consentAttested?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxCallsPer24Hours?: number;
  segmentQuery?: string;
  approvedOffer?: string;
  offerTerms?: string;
  offerUrl?: string;
  campaignIntervalDays?: number;
}

type ActivatedUseCases = Record<string, ActivatedUseCase>;

interface GraphqlJson<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

function parseActivatedUseCases(value?: string | null): ActivatedUseCases {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function loadActivationContext(
  admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"],
) {
  const response = await admin.graphql(`
    #graphql
    query DialnexaUseCaseActivationContext {
      shop {
        name
        myshopifyDomain
        currencyCode
        ianaTimezone
        primaryDomain { url }
      }
      currentAppInstallation {
        id
        apiKeyMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "api_key") { value }
        useCasesMetafield: metafield(namespace: "${APP_METAFIELD_NAMESPACE}", key: "${USE_CASES_KEY}") { value }
      }
    }
  `);
  const json = (await response.json()) as GraphqlJson<{
    shop?: {
      name?: string;
      myshopifyDomain?: string;
      currencyCode?: string;
      ianaTimezone?: string;
      primaryDomain?: { url?: string };
    };
    currentAppInstallation?: {
      id?: string;
      apiKeyMetafield?: { value?: string };
      useCasesMetafield?: { value?: string };
    };
  }>;

  if (json.errors?.length) {
    throw new Error(
      json.errors[0]?.message || "Could not load Shopify shop details",
    );
  }

  return json.data;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const data = await loadActivationContext(admin);
  const installation = data?.currentAppInstallation;

  return {
    agentTemplateVersion: AGENT_TEMPLATE_VERSION,
    companyName: data?.shop?.name || "Your company",
    hasApiKey: Boolean(installation?.apiKeyMetafield?.value),
    activated: parseActivatedUseCases(installation?.useCasesMetafield?.value),
    useCases: USE_CASES.map(({ id, title, category, summary }) => ({
      id,
      title,
      category,
      summary,
      runtime: getRuntimeUseCase(id),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const useCaseId = String(formData.get("useCaseId") || "");
  const useCase = getUseCase(useCaseId);
  const consentAttested = formData.get("consentAttested") === "on";
  const quietHoursStart = String(formData.get("quietHoursStart") || "20:00");
  const quietHoursEnd = String(formData.get("quietHoursEnd") || "09:00");
  const maxCallsPer24Hours = Number(formData.get("maxCallsPer24Hours") || 1);
  const segmentQuery = String(formData.get("segmentQuery") || "").trim();
  const approvedOffer = String(formData.get("approvedOffer") || "").trim();
  const offerTerms = String(formData.get("offerTerms") || "").trim();
  const offerUrl = String(formData.get("offerUrl") || "").trim();
  const campaignIntervalDays = Number(formData.get("campaignIntervalDays") || 30);

  if (
    !useCase ||
    !getRuntimeUseCase(useCaseId) ||
    !["activate", "deactivate"].includes(intent)
  ) {
    return { success: false, message: "Unknown use case action." };
  }

  try {
    if (
      intent === "activate" &&
      (!/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHoursStart) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(quietHoursEnd) ||
        !Number.isInteger(maxCallsPer24Hours) ||
        maxCallsPer24Hours < 1 ||
        maxCallsPer24Hours > 3)
    ) {
      return {
        success: false,
        message: "Quiet hours must use HH:MM and the daily call cap must be 1 to 3.",
      };
    }
    if (
      intent === "activate" &&
      useCaseId === "customer_win_back" &&
      (!segmentQuery || !approvedOffer || !offerUrl ||
        !Number.isInteger(campaignIntervalDays) ||
        campaignIntervalDays < 7 || campaignIntervalDays > 365)
    ) {
      return {
        success: false,
        message:
          "Win-back requires an opted-in Shopify segment query, approved offer, offer URL, and a 7–365 day interval.",
      };
    }
    const data = await loadActivationContext(admin);
    const shop = data?.shop;
    const installation = data?.currentAppInstallation;
    const apiKey = installation?.apiKeyMetafield?.value;
    const activated = parseActivatedUseCases(
      installation?.useCasesMetafield?.value,
    );

    if (!installation?.id) {
      return {
        success: false,
        message: "Could not load the app installation.",
      };
    }

    if (intent === "activate") {
      if (!consentAttested) {
        return {
          success: false,
          message:
            "Confirm that you have a lawful basis and required customer consent before activation.",
        };
      }

      if (
        activated[useCaseId]?.enabled &&
        activated[useCaseId]?.templateVersion >= AGENT_TEMPLATE_VERSION &&
        activated[useCaseId]?.consentAttested
      ) {
        return {
          success: true,
          message: `${useCase.title} is already active.`,
        };
      }

      if (!apiKey) {
        return {
          success: false,
          message: "Save your Dialnexa API key on the Home page first.",
        };
      }

      if (
        activated[useCaseId]?.agentId &&
        activated[useCaseId]?.templateVersion >= AGENT_TEMPLATE_VERSION
      ) {
        activated[useCaseId] = {
          ...activated[useCaseId],
          enabled: true,
          consentAttested: true,
          quietHoursStart,
          quietHoursEnd,
          maxCallsPer24Hours,
          ...(useCaseId === "customer_win_back"
            ? { segmentQuery, approvedOffer, offerTerms, offerUrl, campaignIntervalDays }
            : {}),
          activatedAt: new Date().toISOString(),
        };
      } else {
        const company: CompanyDetails = {
          name: shop?.name || "Shopify merchant",
          shopDomain: shop?.myshopifyDomain || "",
          storefrontUrl: shop?.primaryDomain?.url || "",
          currency: shop?.currencyCode || "",
          timezone: shop?.ianaTimezone || "",
        };
        const agent = buildAgentFromTemplate(useCase, company);
        const claim = await claimAgentProvisioning(
          shop?.myshopifyDomain || "unknown-shop",
          useCaseId,
          AGENT_TEMPLATE_VERSION,
        );
        let agentId = claim.existingAgentId;

        if (!agentId) {
          try {
            const created = await createDialnexaAgent(apiKey, agent);
            agentId = created.agentId;
            await completeAgentProvisioning(claim.provisioningId, agentId);
          } catch (error) {
            await failAgentProvisioning(claim.provisioningId, error);
            throw error;
          }
        }

        activated[useCaseId] = {
          agentId,
          enabled: true,
          templateVersion: AGENT_TEMPLATE_VERSION,
          consentAttested: true,
          quietHoursStart,
          quietHoursEnd,
          maxCallsPer24Hours,
          ...(useCaseId === "customer_win_back"
            ? { segmentQuery, approvedOffer, offerTerms, offerUrl, campaignIntervalDays }
            : {}),
          activatedAt: new Date().toISOString(),
        };
      }
    } else if (activated[useCaseId]) {
      activated[useCaseId] = {
        ...activated[useCaseId],
        enabled: false,
      };
    }

    const saveResponse = await admin.graphql(
      `
      #graphql
      mutation SaveDialnexaUseCases($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
      `,
      {
        variables: {
          metafields: [
            {
              ownerId: installation.id,
              namespace: APP_METAFIELD_NAMESPACE,
              key: USE_CASES_KEY,
              type: "json",
              value: JSON.stringify(activated),
            },
          ],
        },
      },
    );
    const saveJson = (await saveResponse.json()) as GraphqlJson<{
      metafieldsSet?: { userErrors?: Array<{ message?: string }> };
    }>;
    const userErrors = saveJson.data?.metafieldsSet?.userErrors || [];

    if (saveJson.errors?.length || userErrors.length) {
      throw new Error(
        saveJson.errors?.[0]?.message ||
          userErrors[0]?.message ||
          "Could not save use case configuration",
      );
    }

    return {
      success: true,
      message:
        intent === "activate"
          ? `${useCase.title} agent created and activated.`
          : `${useCase.title} deactivated.`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not update the use case.",
    };
  }
};

export default function UseCasesPage() {
  const { activated, agentTemplateVersion, companyName, hasApiKey, useCases } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const pendingUseCaseId = String(fetcher.formData?.get("useCaseId") || "");

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message, {
        isError: !fetcher.data.success,
      });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Voice agent use cases">
      <s-section heading={`Agents for ${companyName}`}>
        <s-paragraph>
          Activating a use case creates a dedicated, published Dialnexa agent
          from its template. Your Shopify company name, domains, currency, and
          timezone are added to the agent prompt automatically.
        </s-paragraph>
        {!hasApiKey && (
          <s-banner tone="warning" heading="Dialnexa API key required">
            <s-paragraph>
              Save your API key on Home before activating an agent.
            </s-paragraph>
          </s-banner>
        )}
      </s-section>

      {useCases.map((useCase) => {
        const configuration = activated[useCase.id];
        const isActive = Boolean(configuration?.enabled);
        const needsUpgrade =
          isActive &&
          (configuration?.templateVersion || 0) < agentTemplateVersion;
        const needsSafetyAttestation =
          isActive && !configuration?.consentAttested;
        const isPending =
          fetcher.state !== "idle" && pendingUseCaseId === useCase.id;

        return (
          <s-section key={useCase.id} heading={useCase.title}>
            <s-stack direction="block" gap="base">
              <s-paragraph>{useCase.summary}</s-paragraph>
              <s-paragraph>
                {useCase.category} · {isActive ? "Active" : "Inactive"}
                {configuration?.agentId
                  ? ` · Agent ${configuration.agentId}`
                  : ""}
              </s-paragraph>
              <s-paragraph>
                Trigger: {useCase.runtime?.triggers.join(", ") || "Unavailable"}
                {useCase.runtime?.integrationNote
                  ? ` · ${useCase.runtime.integrationNote}`
                  : ""}
              </s-paragraph>
              <fetcher.Form method="POST">
                <input type="hidden" name="useCaseId" value={useCase.id} />
                <input
                  type="hidden"
                  name="intent"
                  value={
                    isActive && !needsUpgrade && !needsSafetyAttestation
                      ? "deactivate"
                      : "activate"
                  }
                />
                {(!isActive || needsUpgrade || needsSafetyAttestation) && (
                  <>
                    <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "12px" }}>
                      <input type="checkbox" name="consentAttested" required />
                      <span>
                        I confirm that my store has the required lawful basis and
                        customer consent for these automated calls.
                      </span>
                    </label>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                      <label>
                        Quiet hours start<br />
                        <input type="time" name="quietHoursStart" defaultValue={configuration?.quietHoursStart || "20:00"} required />
                      </label>
                      <label>
                        Quiet hours end<br />
                        <input type="time" name="quietHoursEnd" defaultValue={configuration?.quietHoursEnd || "09:00"} required />
                      </label>
                      <label>
                        Max calls per recipient / 24h<br />
                        <input type="number" name="maxCallsPer24Hours" min="1" max="3" defaultValue={configuration?.maxCallsPer24Hours || 1} required />
                      </label>
                    </div>
                    {useCase.id === "customer_win_back" && (
                      <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                        <label>
                          Opted-in Shopify segment query<br />
                          <input name="segmentQuery" defaultValue={configuration?.segmentQuery || ""} placeholder="sms_subscription_status = 'SUBSCRIBED' AND last_order_date <= -90d" required />
                        </label>
                        <label>
                          Approved offer<br />
                          <input name="approvedOffer" defaultValue={configuration?.approvedOffer || ""} required />
                        </label>
                        <label>
                          Offer terms<br />
                          <input name="offerTerms" defaultValue={configuration?.offerTerms || ""} />
                        </label>
                        <label>
                          Offer URL<br />
                          <input type="url" name="offerUrl" defaultValue={configuration?.offerUrl || ""} required />
                        </label>
                        <label>
                          Minimum days between campaign calls<br />
                          <input type="number" name="campaignIntervalDays" min="7" max="365" defaultValue={configuration?.campaignIntervalDays || 30} required />
                        </label>
                      </div>
                    )}
                  </>
                )}
                <s-button
                  type="submit"
                  variant={
                    isActive && !needsUpgrade && !needsSafetyAttestation
                      ? "secondary"
                      : "primary"
                  }
                  disabled={!isActive && !hasApiKey}
                  {...(isPending ? { loading: true } : {})}
                >
                  {needsUpgrade
                    ? "Upgrade agent template"
                    : needsSafetyAttestation
                      ? "Complete safety setup"
                      : isActive
                        ? "Deactivate"
                        : "Create & activate agent"}
                </s-button>
              </fetcher.Form>
            </s-stack>
          </s-section>
        );
      })}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
