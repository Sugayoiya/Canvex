/**
 * Feature flags for Phase 12.1 progressive migration.
 *
 * AGENT_CHAT_FOR_CANVAS: When true, canvas node execution routes through
 * agent chat SSE instead of legacy skillsApi.invoke. Default: false.
 * Set to true once agent is proven stable in chat-only mode.
 */
export const FEATURE_FLAGS = {
  AGENT_CHAT_FOR_CANVAS: false,
} as const;

type EndpointType = "skills/invoke" | "agent/chat";

const _usageCounts: Record<EndpointType, number> = {
  "skills/invoke": 0,
  "agent/chat": 0,
};

/**
 * Log endpoint usage for migration tracking.
 * Call this whenever an AI operation is dispatched.
 */
export function trackEndpointUsage(endpoint: EndpointType): void {
  _usageCounts[endpoint]++;
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[Migration Telemetry] ${endpoint}: ${_usageCounts[endpoint]} calls | ` +
        `Total: skills/invoke=${_usageCounts["skills/invoke"]}, agent/chat=${_usageCounts["agent/chat"]}`,
    );
  }
}

export function getEndpointUsage(): Record<EndpointType, number> {
  return { ..._usageCounts };
}
