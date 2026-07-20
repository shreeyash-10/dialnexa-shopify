import { USE_CASES } from "./use-cases.server";

export type UseCaseTrigger =
  | "orders/create"
  | "orders/risk_assessment_changed"
  | "fulfillment_events/create"
  | "inventory_levels/update"
  | "subscription_billing_attempts/failure"
  | "shopify-scheduled"
  | "merchant-request"
  | "external-integration";

export interface RuntimeUseCaseDefinition {
  id: string;
  triggers: UseCaseTrigger[];
  requiredScopes: string[];
  requiredMetadata: string[];
  allowedMetadata: string[];
  automatic: boolean;
  integrationNote?: string;
}

const ORDER_CREATED = ["orders/create"] satisfies UseCaseTrigger[];
const SCHEDULED_OR_EXTERNAL = [
  "shopify-scheduled",
  "external-integration",
] satisfies UseCaseTrigger[];
const MERCHANT_OR_EXTERNAL = [
  "merchant-request",
  "external-integration",
] satisfies UseCaseTrigger[];

const RUNTIME_INPUTS: Array<Omit<RuntimeUseCaseDefinition, "allowedMetadata">> =
  [
    {
      id: "new_order_confirmation",
      triggers: ORDER_CREATED,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "order_number"],
      automatic: true,
    },
    {
      id: "cod_verification",
      triggers: ORDER_CREATED,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "order_number", "order_total"],
      automatic: true,
    },
    {
      id: "high_risk_verification",
      triggers: [
        "orders/risk_assessment_changed",
        ...MERCHANT_OR_EXTERNAL,
      ],
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "order_number"],
      automatic: true,
    },
    {
      id: "address_confirmation",
      triggers: MERCHANT_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "order_number", "delivery_address"],
      automatic: false,
      integrationNote: "Requires an address-quality or merchant-review signal.",
    },
    {
      id: "abandoned_checkout",
      triggers: SCHEDULED_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "recovery_url"],
      automatic: true,
    },
    {
      id: "failed_delivery",
      triggers: ["fulfillment_events/create", "external-integration"],
      requiredScopes: ["read_orders", "read_fulfillments"],
      requiredMetadata: [
        "customer_name",
        "order_number",
        "delivery_failure_reason",
      ],
      automatic: true,
    },
    {
      id: "shipping_delay",
      triggers: ["fulfillment_events/create", "external-integration"],
      requiredScopes: ["read_orders", "read_fulfillments"],
      requiredMetadata: ["customer_name", "order_number", "shipping_status"],
      automatic: true,
    },
    {
      id: "delivery_feedback",
      triggers: ["fulfillment_events/create", "external-integration"],
      requiredScopes: ["read_orders", "read_fulfillments"],
      requiredMetadata: ["customer_name", "order_number"],
      automatic: true,
    },
    {
      id: "cancellation_save",
      triggers: MERCHANT_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: [
        "customer_name",
        "order_number",
        "cancellation_reason",
      ],
      automatic: false,
      integrationNote:
        "Requires an explicit cancellation request and authorized remedy.",
    },
    {
      id: "return_refund_support",
      triggers: MERCHANT_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: [
        "customer_name",
        "order_number",
        "available_next_steps",
      ],
      automatic: false,
      integrationNote: "Requires a return request or returns-platform event.",
    },
    {
      id: "post_purchase_cross_sell",
      triggers: SCHEDULED_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "recommended_product"],
      automatic: false,
      integrationNote:
        "Requires a merchant-approved recommendation and offer source.",
    },
    {
      id: "payment_pending",
      triggers: MERCHANT_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "order_number", "payment_url"],
      automatic: false,
      integrationNote:
        "Requires a confirmed pending-payment event and secure payment URL.",
    },
    {
      id: "customer_win_back",
      triggers: SCHEDULED_OR_EXTERNAL,
      requiredScopes: ["read_customers"],
      requiredMetadata: ["customer_name", "approved_offer"],
      automatic: false,
      integrationNote:
        "Requires an opted-in Shopify customer segment and merchant-approved offer.",
    },
    {
      id: "replenishment_reminder",
      triggers: SCHEDULED_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: ["customer_name", "product_name", "reorder_url"],
      automatic: false,
      integrationNote:
        "Requires merchant-approved replenishment timing and reorder links.",
    },
    {
      id: "back_in_stock",
      triggers: ["inventory_levels/update", "external-integration"],
      requiredScopes: ["read_products", "read_inventory"],
      requiredMetadata: ["customer_name", "product_name", "product_url"],
      automatic: true,
      integrationNote: "Requires an explicit shopper stock-alert opt-in.",
    },
    {
      id: "draft_order_follow_up",
      triggers: SCHEDULED_OR_EXTERNAL,
      requiredScopes: ["read_draft_orders"],
      requiredMetadata: ["customer_name", "quote_number", "completion_url"],
      automatic: false,
      integrationNote:
        "Requires read_draft_orders approval before the built-in scheduler can run.",
    },
    {
      id: "subscription_payment_recovery",
      triggers: [
        "subscription_billing_attempts/failure",
        "external-integration",
      ],
      requiredScopes: ["read_own_subscription_contracts"],
      requiredMetadata: [
        "customer_name",
        "subscription_name",
        "payment_update_url",
      ],
      automatic: true,
      integrationNote:
        "Shopify-native automation applies only to subscription contracts owned by this app; other providers use the integration API.",
    },
    {
      id: "order_link_assistance",
      triggers: MERCHANT_OR_EXTERNAL,
      requiredScopes: ["read_orders"],
      requiredMetadata: [
        "customer_name",
        "order_number",
        "access_instructions",
      ],
      automatic: false,
      integrationNote: "Requires a customer support or merchant request.",
    },
    {
      id: "merchant_callback",
      triggers: ["merchant-request"],
      requiredScopes: [],
      requiredMetadata: ["customer_name", "callback_reason"],
      automatic: false,
    },
  ];

const RUNTIME_DEFINITIONS: RuntimeUseCaseDefinition[] = RUNTIME_INPUTS.map(
  (definition) => {
    const useCase = USE_CASES.find(({ id }) => id === definition.id);
    const allowedMetadata = (useCase?.callTimeFields || []).flatMap(
      ([, placeholder]) => {
        const match = placeholder.match(/^\{\{([a-z0-9_]+)\}\}$/i);
        return match ? [match[1]] : [];
      },
    );
    return { ...definition, allowedMetadata };
  },
);

export const USE_CASE_RUNTIME = Object.fromEntries(
  RUNTIME_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<string, RuntimeUseCaseDefinition>;

export const RUNTIME_USE_CASE_IDS = RUNTIME_DEFINITIONS.map(({ id }) => id);

export function getRuntimeUseCase(
  useCaseId: string,
): RuntimeUseCaseDefinition | undefined {
  return USE_CASE_RUNTIME[useCaseId];
}

export function validateRuntimeCatalog(): string[] {
  const promptIds = new Set(USE_CASES.map(({ id }) => id));
  const runtimeIds = new Set(RUNTIME_USE_CASE_IDS);
  return [
    ...[...promptIds]
      .filter((id) => !runtimeIds.has(id))
      .map((id) => `Missing runtime definition: ${id}`),
    ...[...runtimeIds]
      .filter((id) => !promptIds.has(id))
      .map((id) => `Runtime definition has no prompt: ${id}`),
  ];
}

export function validateCallMetadata(
  useCaseId: string,
  metadata: Record<string, unknown>,
): string[] {
  const definition = getRuntimeUseCase(useCaseId);
  if (!definition) return [`Unknown use case: ${useCaseId}`];

  const missing = definition.requiredMetadata.flatMap((field) => {
    const value = metadata[field];
    return typeof value === "string" && value.trim()
      ? []
      : [`Missing required metadata: ${field}`];
  });
  const invalid = Object.entries(metadata).flatMap(([field, value]) => {
    if (!definition.allowedMetadata.includes(field)) {
      return [`Unsupported metadata for ${useCaseId}: ${field}`];
    }
    return typeof value === "string" && /\{\{[^}]+\}\}/.test(value)
      ? [`Metadata contains an unresolved placeholder: ${field}`]
      : [];
  });
  return [...missing, ...invalid];
}

export function isCashOnDelivery(gateways: string[] = []): boolean {
  return gateways.some((gateway) => {
    const normalized = gateway.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "cod" || normalized.includes("cashondelivery");
  });
}

export interface ActivatedRuntimeUseCase {
  agentId?: string;
  enabled?: boolean;
  consentAttested?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxCallsPer24Hours?: number;
}

export function selectOrderWorkflow(
  gateways: string[],
  useCases: Record<string, ActivatedRuntimeUseCase>,
): {
  workflow: string;
  agentId: string;
  configuration: ActivatedRuntimeUseCase;
} | null {
  if (
    isCashOnDelivery(gateways) &&
    useCases.cod_verification?.enabled &&
    useCases.cod_verification.agentId
  ) {
    return {
      workflow: "cod_verification",
      agentId: useCases.cod_verification.agentId,
      configuration: useCases.cod_verification,
    };
  }

  if (
    useCases.new_order_confirmation?.enabled &&
    useCases.new_order_confirmation.agentId
  ) {
    return {
      workflow: "new_order_confirmation",
      agentId: useCases.new_order_confirmation.agentId,
      configuration: useCases.new_order_confirmation,
    };
  }

  return null;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid quiet-hours time: ${value}`);
  }
  return hours * 60 + minutes;
}

export function isInQuietHours(
  now: Date,
  timezone: string,
  quietHoursStart = "20:00",
  quietHoursEnd = "09:00",
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hours = Number(parts.find(({ type }) => type === "hour")?.value);
  const minutes = Number(parts.find(({ type }) => type === "minute")?.value);
  const current = hours * 60 + minutes;
  const start = timeToMinutes(quietHoursStart);
  const end = timeToMinutes(quietHoursEnd);

  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}
