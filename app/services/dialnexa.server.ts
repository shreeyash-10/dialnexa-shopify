export const DIALNEXA_API_URL = "https://api.dialnexa.com";

/**
 * Trigger an outbound call via Dialnexa API.
 */
export async function triggerOutboundCall(apiKey: string, agentId: string, toPhoneNumber: string, promptVariables: Record<string, string> = {}) {
  // Typical endpoint for outbound calls (placeholder based on common patterns)
  const url = `${DIALNEXA_API_URL}/v1/calls/outbound`; 

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      agent_id: agentId,
      phone_number: toPhoneNumber,
      variables: promptVariables,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Dialnexa API Error:", errorText);
    throw new Error(`Failed to trigger outbound call: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
