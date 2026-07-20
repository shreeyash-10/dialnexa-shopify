import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENT_TEMPLATE_VERSION,
  buildAgentFromTemplate,
  USE_CASES,
} from "../app/services/use-cases.server";

const outputPath = resolve(process.cwd(), "agent-templates.json");
const companyPlaceholders = {
  name: "[COMPANY_NAME]",
  shopDomain: "[SHOP_DOMAIN]",
  storefrontUrl: "[STOREFRONT_URL]",
  currency: "[STORE_CURRENCY]",
  timezone: "[STORE_TIMEZONE]",
};

const templates = USE_CASES.map((useCase) => {
  const agent = buildAgentFromTemplate(useCase, companyPlaceholders);

  return {
    id: useCase.id,
    title: useCase.title,
    category: useCase.category,
    template_version: AGENT_TEMPLATE_VERSION,
    dialnexa_payload: {
      title: agent.title,
      is_published: true,
      conversation_start_type: "agent",
      allow_interruptions: true,
      prompts: {
        prompt_text: agent.promptText,
        welcome_message: agent.welcomeMessage,
      },
      security: {
        opt_out_sensitive_data_storage: true,
        opt_in_secure_urls: false,
      },
      analysis: {
        postcall_analysis: agent.postCallAnalysis,
      },
    },
  };
});

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      generated_from: "app/services/use-cases.server.ts",
      company_placeholders: companyPlaceholders,
      templates,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Exported ${templates.length} templates to ${outputPath}`);
