export function automationWorkflowsEnabled(): boolean {
  return process.env.ENABLE_AUTOMATION_WORKFLOWS === "true";
}
