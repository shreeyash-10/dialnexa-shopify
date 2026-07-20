export const DIALNEXA_API_URL = "https://api.dialnexa.com/v1";
export const DIALNEXA_CREATE_AGENT_URL = "https://api.dialnexa.com/agents2";

export interface DialnexaCallResponse {
  id?: string;
  call_id?: string;
  data?: {
    id?: string;
    call_id?: string;
  };
  [key: string]: unknown;
}

export interface DialnexaAgentInput {
  title: string;
  promptText: string;
  welcomeMessage: string;
  postCallAnalysis?: Array<{
    field_name: string;
    field_type: "BOOLEAN" | "NUMBER" | "STRING";
    field_description: string;
  }>;
}

export interface DialnexaAgentResponse {
  id?: string;
  agent_id?: string;
  current_version?: { agent_id?: string };
  [key: string]: unknown;
}

export class DialnexaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DialnexaApiError";
  }
}

export function normalizePhoneNumber(phoneNumber: string): string | null {
  const trimmed = phoneNumber.trim();
  const normalized = trimmed.startsWith("00")
    ? `+${trimmed.slice(2).replace(/\D/g, "")}`
    : trimmed.startsWith("+")
      ? `+${trimmed.slice(1).replace(/\D/g, "")}`
      : null;

  return normalized && /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

/** Create and publish a merchant-specific agent from a Shopify use-case template. */
export async function createDialnexaAgent(
  apiKey: string,
  input: DialnexaAgentInput,
): Promise<{ agentId: string; response: DialnexaAgentResponse }> {
  const response = await fetch(DIALNEXA_CREATE_AGENT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      title: input.title.slice(0, 100),
      is_published: true,
      conversation_start_type: "agent",
      allow_interruptions: true,
      prompts: {
        prompt_text: input.promptText,
        welcome_message: input.welcomeMessage,
      },
      telephony: {
        call_limits: {
          end_call_on_silence_sec: 120,
          max_call_duration_sec: 480,
          ring_duration_sec: 30,
        },
      },
      security: {
        opt_out_sensitive_data_storage: true,
        opt_in_secure_urls: false,
      },
      analysis: {
        postcall_analysis: input.postCallAnalysis || [],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new DialnexaApiError(
      `Dialnexa rejected agent creation (${response.status}): ${errorText.slice(0, 500)}`,
      response.status,
    );
  }

  const result = (await response.json()) as DialnexaAgentResponse;
  const agentId =
    result.id || result.agent_id || result.current_version?.agent_id;

  if (!agentId) {
    throw new DialnexaApiError(
      "Dialnexa created an agent but did not return an agent ID",
      502,
    );
  }

  return { agentId, response: result };
}

/**
 * Trigger an outbound call via Dialnexa API.
 */
export async function triggerOutboundCall(
  apiKey: string,
  agentId: string,
  toPhoneNumber: string,
  metadata: Record<string, string> = {},
): Promise<DialnexaCallResponse> {
  const normalizedPhoneNumber = normalizePhoneNumber(toPhoneNumber);

  if (!normalizedPhoneNumber) {
    throw new DialnexaApiError(
      "The customer phone number is not a valid E.164 number",
      400,
    );
  }

  const response = await fetch(`${DIALNEXA_API_URL}/calls`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      to_phone_number: normalizedPhoneNumber,
      metadata,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new DialnexaApiError(
      `Dialnexa rejected the call (${response.status}): ${errorText.slice(0, 500)}`,
      response.status,
    );
  }

  return (await response.json()) as DialnexaCallResponse;
}
