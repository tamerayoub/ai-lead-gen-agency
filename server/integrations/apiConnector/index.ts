/**
 * API Connector - External REST API for PMS/integrators.
 * See server/API_CONNECTOR_ARCHITECTURE.md
 */

export { v1Router } from "./routes";
export { createInternalRoutes } from "./routes";
export { requireApiKey, requireScope, type ApiKeyInfo, type Scopes } from "./auth";
export * as apiConnectorStorage from "./storage";
