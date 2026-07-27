/**
 * ============================================================================
 *  OpsOS Protocol SDK — Protocol Registration Interface
 * ============================================================================
 *  Protocols implement this interface. The kernel calls register*() methods
 *  at installation time. Kernel code NEVER changes when a new protocol is
 *  added.
 * ============================================================================
 */

export interface ProtocolDefinition {
  key: string;
  name: string;
  version: string;
  description?: string;

  registerCapabilities(): CapabilityDefinition[];
  registerIntentDefinitions(): IntentDefinition[];
  registerPolicies(): PolicyDefinition[];
  registerRules(): RuleDefinition[];
  registerCompilerStages(): CompilerStage[];
  registerWorkflows(): WorkflowDefinitionInput[];
  registerMarketplace(): MarketplaceDefinition[];
  registerPricing(): PricingModel[];
  registerDashboards(): DashboardDefinition[];
  registerReadModels(): ReadModelDefinition[];
  registerAnalytics(): AnalyticsDefinition[];
  registerApi(): ApiEndpointDefinition[];
  registerUi(): UiComponentDefinition[];
}

export interface CapabilityDefinition {
  code: string;
  name: string;
  version?: string;
  description?: string;
  requiredResources?: Record<string, unknown>[];
  requiredSkills?: Record<string, unknown>[];
  constraints?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  costModel?: Record<string, unknown>;
  qualityMetrics?: Record<string, unknown>;
  runtimeMetadata?: Record<string, unknown>;
}

export interface IntentDefinition {
  key: string;
  version: string;
  parameters: Record<string, unknown>;
  capabilities: string[];
  validation?: Record<string, unknown>;
}

export interface PolicyDefinition {
  key: string;
  name: string;
  policyType: string;
  effect: string;
  conditions?: Record<string, unknown>[];
  actions?: Record<string, unknown>[];
  priority?: number;
}

export interface RuleDefinition {
  name: string;
  triggerEvent: string;
  conditions: Array<{ field: string; operator: string; value: unknown; logicOperator?: string }>;
  actions: Array<{ actionType: string; config: Record<string, unknown>; isAsync?: boolean }>;
  priority?: number;
}

export interface CompilerStage {
  name: string;
  order: number;
  handler: string; // function reference
}

export interface WorkflowDefinitionInput {
  key: string;
  name: string;
  stages: Record<string, unknown>[];
  approvalRules?: Record<string, unknown>[];
  completionRules?: Record<string, unknown>[];
}

export interface MarketplaceDefinition {
  name: string;
  marketplaceType: string;
  optimizationGoals: string[];
}

export interface PricingModel {
  capabilityCode: string;
  basePriceMinor: number;
  factors: Record<string, unknown>[];
}

export interface DashboardDefinition {
  key: string;
  name: string;
  widgets: Record<string, unknown>[];
}

export interface ReadModelDefinition {
  name: string;
  events: string[];
  projection: string;
}

export interface AnalyticsDefinition {
  key: string;
  name: string;
  queryType: string;
  config: Record<string, unknown>;
}

export interface ApiEndpointDefinition {
  path: string;
  method: string;
  handler: string;
  authRequired: boolean;
}

export interface UiComponentDefinition {
  key: string;
  name: string;
  componentType: string;
  props?: Record<string, unknown>;
}

// Extension SDK
export interface ExtensionDefinition {
  key: string;
  name: string;
  version: string;
  description?: string;

  registerCompilerStages?(): CompilerStage[];
  registerDashboards?(): DashboardDefinition[];
  registerAnalytics?(): AnalyticsDefinition[];
  registerInspectorPanels?(): InspectorPanelDefinition[];
  registerRecommendationAnalyzers?(): RecommendationAnalyzerDefinition[];
  registerIntegrations?(): IntegrationDefinition[];
  registerWidgets?(): WidgetDefinition[];
  registerApi?(): ApiEndpointDefinition[];
  registerUi?(): UiComponentDefinition[];
}

export interface InspectorPanelDefinition {
  key: string;
  name: string;
  graphType: string; // EXECUTION | INTENT | RESOURCE | CAPABILITY | WORKFLOW | RECOMMENDATION | MARKETPLACE | SIMULATION | PIPELINE | DECISION
  dataSource: string;
}

export interface RecommendationAnalyzerDefinition {
  key: string;
  recommendationType: string;
  analyzer: string;
}

export interface IntegrationDefinition {
  key: string;
  name: string;
  integrationType: string;
  config: Record<string, unknown>;
}

export interface WidgetDefinition {
  key: string;
  name: string;
  widgetType: string;
  props?: Record<string, unknown>;
}
