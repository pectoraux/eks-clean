/**
 * ============================================================================
 *  Eks-Clean Protocol — First OpsOS Protocol Installation
 * ============================================================================
 *  This file implements the ProtocolDefinition interface from the OpsOS
 *  Protocol SDK. It registers all cleaning business semantics as data —
 *  capabilities, intents, workflows, rules, pricing, policies, marketplace,
 *  dashboards, analytics, read models, API endpoints, and UI components.
 *
 *  The kernel remains completely domain-independent.
 *  No cleaning concepts are added to the kernel.
 * ============================================================================
 */

import type {
  ProtocolDefinition,
  CapabilityDefinition,
  IntentDefinition,
  PolicyDefinition,
  RuleDefinition,
  WorkflowDefinitionInput,
  MarketplaceDefinition,
  PricingModel,
  DashboardDefinition,
  ReadModelDefinition,
  AnalyticsDefinition,
  ApiEndpointDefinition,
  UiComponentDefinition,
  CompilerStage,
} from "@/lib/kernel/protocol-sdk";

// ============================================================================
//  CAPABILITIES — what Eks-Clean can do
// ============================================================================

const capabilities: CapabilityDefinition[] = [
  // Residential
  { code: "CAP-RESIDENTIAL-CLEANING", name: "Residential Cleaning", version: "1.0.0", description: "Standard home cleaning service", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 1 }], inputs: { rooms: "number", bathrooms: "number", squareMeters: "number" }, outputs: { qualityScore: "number" }, costModel: { baseCost: 5000, perUnit: "hour" }, qualityMetrics: { sla: "100%", accuracy: 0.95 } },
  // Commercial
  { code: "CAP-COMMERCIAL-CLEANING", name: "Commercial Cleaning", version: "1.0.0", description: "Office and commercial space cleaning", requiredResources: [{ type: "WORKER", minCount: 2 }, { type: "EQUIPMENT", minCount: 1 }], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 2 }], inputs: { squareMeters: "number", floors: "number" }, costModel: { baseCost: 6000, perUnit: "hour" } },
  // Deep cleaning
  { code: "CAP-DEEP-CLEANING", name: "Deep Cleaning", version: "1.0.0", description: "Thorough deep clean of all surfaces", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 2 }, { code: "SKILL-CHEMICAL-SAFETY", minLevel: 2 }], inputs: { rooms: "number", squareMeters: "number" }, costModel: { baseCost: 8000, perUnit: "hour" } },
  // Move-in/out
  { code: "CAP-MOVE-CLEANING", name: "Move-In/Out Cleaning", version: "1.0.0", description: "Complete cleaning for moving in or out", requiredResources: [{ type: "WORKER", minCount: 2 }], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 2 }], inputs: { rooms: "number", empty: "boolean" }, costModel: { baseCost: 12000, perUnit: "job" } },
  // Laundry
  { code: "CAP-LAUNDRY-PICKUP", name: "Laundry Pickup & Delivery", version: "1.0.0", description: "Pickup, wash, fold, and deliver laundry", requiredResources: [{ type: "WORKER", minCount: 1 }, { type: "VEHICLE", minCount: 1 }], requiredSkills: [{ code: "SKILL-LAUNDRY", minLevel: 1 }], inputs: { weightKg: "number" }, costModel: { baseCost: 3000, perUnit: "kg" } },
  // Carpet
  { code: "CAP-CARPET-CLEANING", name: "Carpet Cleaning", version: "1.0.0", description: "Deep carpet shampoo and extraction", requiredResources: [{ type: "WORKER", minCount: 1 }, { type: "EQUIPMENT", minCount: 1 }], requiredSkills: [{ code: "SKILL-CARPET", minLevel: 2 }], inputs: { areaSqM: "number" }, costModel: { baseCost: 4500, perUnit: "sqm" } },
  // Upholstery
  { code: "CAP-UPHOLSTERY-CLEANING", name: "Upholstery Cleaning", version: "1.0.0", description: "Sofa, chair, and fabric cleaning", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-UPHOLSTERY", minLevel: 2 }], inputs: { items: "number" }, costModel: { baseCost: 3500, perUnit: "item" } },
  // Window
  { code: "CAP-WINDOW-CLEANING", name: "Window Cleaning", version: "1.0.0", description: "Interior and exterior window cleaning", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-WINDOW", minLevel: 1 }], inputs: { windows: "number", floors: "number" }, costModel: { baseCost: 2500, perUnit: "window" } },
  // Waste
  { code: "CAP-WASTE-COLLECTION", name: "Waste Collection", version: "1.0.0", description: "Scheduled waste pickup and disposal", requiredResources: [{ type: "WORKER", minCount: 1 }, { type: "VEHICLE", minCount: 1 }], requiredSkills: [{ code: "SKILL-WASTE", minLevel: 1 }], inputs: { volumeKg: "number" }, costModel: { baseCost: 1500, perUnit: "job" } },
  // Surface intelligence
  { code: "CAP-SURFACE-TREATMENT", name: "Surface Treatment", version: "1.0.0", description: "Specialized treatment for marble, granite, wood, etc.", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-SURFACE", minLevel: 3 }], inputs: { surfaceType: "string", areaSqM: "number" }, costModel: { baseCost: 5500, perUnit: "sqm" } },
  // Chemical intelligence
  { code: "CAP-CHEMICAL-APPLICATION", name: "Chemical Application", version: "1.0.0", description: "Safe chemical application with PPE and dilution", requiredResources: [{ type: "WORKER", minCount: 1 }], requiredSkills: [{ code: "SKILL-CHEMICAL-SAFETY", minLevel: 3 }], inputs: { chemicalId: "string", surfaceType: "string" }, costModel: { baseCost: 2000, perUnit: "application" } },
];

// ============================================================================
//  INTENT DEFINITIONS — what customers can request
// ============================================================================

const intentDefinitions: IntentDefinition[] = [
  { key: "request-residential-cleaning", version: "1.0.0", parameters: { rooms: "number", bathrooms: "number", squareMeters: "number", date: "string", time: "string" }, capabilities: ["CAP-RESIDENTIAL-CLEANING"] },
  { key: "request-commercial-cleaning", version: "1.0.0", parameters: { squareMeters: "number", floors: "number", date: "string" }, capabilities: ["CAP-COMMERCIAL-CLEANING"] },
  { key: "request-deep-cleaning", version: "1.0.0", parameters: { rooms: "number", squareMeters: "number", date: "string" }, capabilities: ["CAP-DEEP-CLEANING"] },
  { key: "request-move-cleaning", version: "1.0.0", parameters: { rooms: "number", empty: "boolean", date: "string", type: "string" }, capabilities: ["CAP-MOVE-CLEANING"] },
  { key: "request-laundry-pickup", version: "1.0.0", parameters: { weightKg: "number", date: "string" }, capabilities: ["CAP-LAUNDRY-PICKUP"] },
  { key: "request-carpet-cleaning", version: "1.0.0", parameters: { areaSqM: "number", date: "string" }, capabilities: ["CAP-CARPET-CLEANING"] },
  { key: "request-upholstery-cleaning", version: "1.0.0", parameters: { items: "number", date: "string" }, capabilities: ["CAP-UPHOLSTERY-CLEANING"] },
  { key: "request-window-cleaning", version: "1.0.0", parameters: { windows: "number", floors: "number", date: "string" }, capabilities: ["CAP-WINDOW-CLEANING"] },
  { key: "request-waste-collection", version: "1.0.0", parameters: { volumeKg: "number", date: "string" }, capabilities: ["CAP-WASTE-COLLECTION"] },
  { key: "subscribe-cleaning-plan", version: "1.0.0", parameters: { plan: "string", frequency: "string", rooms: "number" }, capabilities: ["CAP-RESIDENTIAL-CLEANING"] },
];

// ============================================================================
//  POLICIES — access control + business rules
// ============================================================================

const policies: PolicyDefinition[] = [
  { key: "POLICY-PREMIUM-FIRST", name: "Premium Customers First", policyType: "BUSINESS", effect: "CONDITIONAL", conditions: [{ field: "customer.tier", operator: "EQ", value: "PREMIUM" }], actions: [{ type: "PRIORITY_DISPATCH", config: {} }], priority: 50 },
  { key: "POLICY-CHEMICAL-SAFETY", name: "Chemical Safety Required", policyType: "COMPLIANCE", effect: "DENY", conditions: [{ field: "worker.certifications", operator: "NOT_IN", value: ["CHEMICAL_SAFETY"] }], actions: [], priority: 10 },
  { key: "POLICY-SUBSCRIPTION-DISCOUNT", name: "Subscription Discount", policyType: "ECONOMIC", effect: "ALLOW", conditions: [{ field: "customer.isSubscriber", operator: "EQ", value: true }], actions: [{ type: "APPLY_DISCOUNT", config: { percent: 10 } }], priority: 80 },
  { key: "POLICY-ENTERPRISE-SLA", name: "Enterprise SLA Enforcement", policyType: "COMPLIANCE", effect: "CONDITIONAL", conditions: [{ field: "customer.type", operator: "EQ", value: "ENTERPRISE" }], actions: [{ type: "ENFORCE_SLA", config: { responseTime: 4, qualityScore: 90 } }], priority: 30 },
];

// ============================================================================
//  RULES — declarative business behavior
// ============================================================================

const rules: RuleDefinition[] = [
  {
    name: "Low Rating Auto-QA",
    triggerEvent: "execution_plan.completed",
    conditions: [{ field: "qualityScore", operator: "LT", value: 3 }],
    actions: [
      { actionType: "CREATE_TASK", config: { type: "QA_INSPECTION", priority: "HIGH" } },
      { actionType: "NOTIFY", config: { role: "MANAGER", message: "Low quality rating — QA inspection created" }, isAsync: true },
      { actionType: "APPLY_DISCOUNT", config: { percent: 10 } },
    ],
    priority: 50,
  },
  {
    name: "Urgent Demand Escalation",
    triggerEvent: "demand.detected",
    conditions: [{ field: "priority", operator: "EQ", value: "URGENT" }],
    actions: [
      { actionType: "NOTIFY", config: { role: "MANAGER", message: "Urgent demand detected" }, isAsync: true },
      { actionType: "SET_PRIORITY", config: { level: "CRITICAL" } },
    ],
    priority: 25,
  },
  {
    name: "Chemical Safety Block",
    triggerEvent: "intent.capabilities_resolved",
    conditions: [{ field: "capabilityCode", operator: "EQ", value: "CAP-CHEMICAL-APPLICATION" }, { field: "worker.certifications", operator: "NOT_IN", value: ["CHEMICAL_SAFETY"], logicOperator: "AND" }],
    actions: [
      { actionType: "NOTIFY", config: { role: "MANAGER", message: "Worker lacks chemical safety certification" }, isAsync: true },
    ],
    priority: 10,
  },
  {
    name: "Subscription Auto-Renewal Reminder",
    triggerEvent: "subscription.renewal_due",
    conditions: [{ field: "daysUntilRenewal", operator: "LTE", value: 7 }],
    actions: [
      { actionType: "NOTIFY", config: { role: "CUSTOMER", message: "Your subscription renews in 7 days" }, isAsync: true },
    ],
    priority: 75,
  },
  {
    name: "High Utilization Alert",
    triggerEvent: "resource.allocated",
    conditions: [{ field: "utilization", operator: "GT", value: 85 }],
    actions: [
      { actionType: "NOTIFY", config: { role: "MANAGER", message: "Worker utilization above 85%" }, isAsync: true },
    ],
    priority: 60,
  },
];

// ============================================================================
//  WORKFLOWS — configurable, no hardcoded workflows
// ============================================================================

const workflows: WorkflowDefinitionInput[] = [
  {
    key: "wf-standard-home-clean",
    name: "Standard Home Cleaning Workflow",
    stages: [
      { order: 1, name: "Preparation", type: "PREPARATION", estimatedDurationMin: 15, tasks: [
        { title: "Arrive and greet customer", estimatedDurationMin: 5, checklist: ["Wear uniform", "Lay protective mats", "Confirm scope"] },
      ] },
      { order: 2, name: "Execution", type: "EXECUTION", estimatedDurationMin: 120, tasks: [
        { title: "Kitchen cleaning", estimatedDurationMin: 30, requiresPhoto: true, checklist: ["Counters sanitized", "Sink cleaned", "Floor mopped"], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 1 }] },
        { title: "Bathroom sanitization", estimatedDurationMin: 25, requiresPhoto: true, checklist: ["Toilet sanitized", "Mirror spotless", "Tiles scrubbed"], requiredSkills: [{ code: "SKILL-CLEANING", minLevel: 1 }] },
        { title: "Living areas", estimatedDurationMin: 40, checklist: ["Dusted", "Vacuumed", "Mopped"] },
        { title: "Bedrooms", estimatedDurationMin: 30, checklist: ["Beds made", "Dusted", "Vacuumed"] },
      ] },
      { order: 3, name: "Handover", type: "HANDOVER", estimatedDurationMin: 15, tasks: [
        { title: "Customer walk-through", estimatedDurationMin: 10, checklist: ["Customer signed off", "Photos uploaded"] },
      ] },
    ],
    approvalRules: [{ approverRole: "CUSTOMER", autoApproveIfScoreGte: 90 }],
    completionRules: [{ metric: "CHECKLIST_COMPLETE", action: "BLOCK" }, { metric: "PHOTO_REQUIRED", action: "BLOCK" }],
    estimatedDurationMin: 180,
  },
  {
    key: "wf-deep-clean",
    name: "Deep Cleaning Workflow",
    stages: [
      { order: 1, name: "Assessment", type: "PREPARATION", tasks: [{ title: "Property assessment", checklist: ["Identify surfaces", "Note problem areas", "Select chemicals"] }] },
      { order: 2, name: "Chemical Application", type: "EXECUTION", tasks: [{ title: "Apply chemicals", requiresPhoto: true, checklist: ["PPE worn", "Dilution correct", "Approved surfaces only"], requiredSkills: [{ code: "SKILL-CHEMICAL-SAFETY", minLevel: 2 }] }] },
      { order: 3, name: "Deep Clean", type: "EXECUTION", tasks: [{ title: "Deep clean all surfaces", requiresPhoto: true, checklist: ["All surfaces treated", "Stains removed", "Grout cleaned"] }] },
      { order: 4, name: "Inspection", type: "REVIEW", tasks: [{ title: "Quality inspection", checklist: ["All areas checked", "No residue", "Photos taken"] }] },
    ],
    estimatedDurationMin: 360,
  },
  {
    key: "wf-laundry-pickup",
    name: "Laundry Pickup & Delivery Workflow",
    stages: [
      { order: 1, name: "Pickup", type: "EXECUTION", tasks: [{ title: "Collect laundry", checklist: ["Weight recorded", "Garments counted", "Barcode generated"] }] },
      { order: 2, name: "Processing", type: "EXECUTION", tasks: [{ title: "Wash and fold", checklist: ["Sorted by color", "Washed", "Dried", "Folded"] }] },
      { order: 3, name: "Delivery", type: "HANDOVER", tasks: [{ title: "Deliver to customer", checklist: ["Quality checked", "Delivered on time"] }] },
    ],
    estimatedDurationMin: 240,
  },
  {
    key: "wf-waste-collection",
    name: "Waste Collection Workflow",
    stages: [
      { order: 1, name: "Route", type: "EXECUTION", tasks: [{ title: "Follow collection route", checklist: ["All stops visited", "Volume recorded"] }] },
      { order: 2, name: "Disposal", type: "EXECUTION", tasks: [{ title: "Dispose at facility", checklist: ["Sorted by category", "Disposal documented"] }] },
    ],
    estimatedDurationMin: 180,
  },
];

// ============================================================================
//  MARKETPLACE — capacity trading
// ============================================================================

const marketplace: MarketplaceDefinition[] = [
  { name: "Eks-Clean Service Marketplace", marketplaceType: "INTERNAL", optimizationGoals: ["QUALITY", "COST", "COVERAGE"] },
];

// ============================================================================
//  PRICING — dynamic pricing models
// ============================================================================

const pricing: PricingModel[] = [
  { capabilityCode: "CAP-RESIDENTIAL-CLEANING", basePriceMinor: 5000, factors: [{ name: "distance", multiplier: 1.0, perKmCharge: 500 }, { name: "urgency", multiplier: 1.5 }, { name: "demand", multiplier: 1.3 }, { name: "subscription", discount: 0.1 }, { name: "holiday", multiplier: 2.0 }, { name: "largeProperty", multiplier: 1.2, threshold: 200 }] },
  { capabilityCode: "CAP-COMMERCIAL-CLEANING", basePriceMinor: 6000, factors: [{ name: "distance", multiplier: 1.0, perKmCharge: 500 }, { name: "urgency", multiplier: 1.5 }, { name: "enterprise", discount: 0.15 }] },
  { capabilityCode: "CAP-DEEP-CLEANING", basePriceMinor: 8000, factors: [{ name: "distance", multiplier: 1.0, perKmCharge: 500 }, { name: "chemicalCost", multiplier: 1.1 }] },
  { capabilityCode: "CAP-LAUNDRY-PICKUP", basePriceMinor: 3000, factors: [{ name: "weight", perUnitCharge: 500 }, { name: "subscription", discount: 0.1 }] },
  { capabilityCode: "CAP-WASTE-COLLECTION", basePriceMinor: 1500, factors: [{ name: "volume", perUnitCharge: 200 }, { name: "frequency", discount: 0.2 }] },
];

// ============================================================================
//  DASHBOARDS — protocol-specific dashboard widgets
// ============================================================================

const dashboards: DashboardDefinition[] = [
  { key: "eks-clean-operations", name: "Cleaning Operations Dashboard", widgets: [
    { type: "kpi", title: "Active Cleanings", dataSource: "execution_plans", filter: { status: "EXECUTING" } },
    { type: "kpi", title: "Today's Bookings", dataSource: "demands", filter: { date: "today" } },
    { type: "kpi", title: "Quality Score", dataSource: "observations", aggregate: "avg" },
    { type: "chart", title: "Revenue Trend", dataSource: "events", filter: { type: "payment" } },
    { type: "table", title: "Worker Utilization", dataSource: "resources", filter: { type: "WORKER" } },
  ] },
  { key: "eks-clean-customer", name: "Customer Portal Dashboard", widgets: [
    { type: "kpi", title: "Next Cleaning", dataSource: "demands", filter: { status: "SCHEDULED" } },
    { type: "kpi", title: "Subscription Status", dataSource: "projections", filter: { name: "subscription" } },
    { type: "table", title: "Cleaning History", dataSource: "events", filter: { type: "execution_plan.completed" } },
  ] },
];

// ============================================================================
//  READ MODELS — projections for cleaning-specific views
// ============================================================================

const readModels: ReadModelDefinition[] = [
  { name: "property_cleaning_history", events: ["execution_plan.completed", "execution_plan.started"], projection: "GROUP_BY property_id" },
  { name: "worker_performance", events: ["execution_plan.completed"], projection: "GROUP_BY resource_id, AVG quality_score" },
  { name: "revenue_by_service", events: ["payment.captured"], projection: "GROUP BY capability_code, SUM amount" },
  { name: "subscription_status", events: ["subscription.created", "subscription.cancelled"], projection: "LATEST per customer_id" },
  { name: "chemical_usage", events: ["chemical.applied"], projection: "GROUP BY chemical_id, SUM quantity" },
  { name: "surface_condition", events: ["surface.treated"], projection: "LATEST per property_id, surface_type" },
];

// ============================================================================
//  ANALYTICS — protocol-specific analytics queries
// ============================================================================

const analytics: AnalyticsDefinition[] = [
  { key: "cleaning-completion-rate", name: "Cleaning Completion Rate", queryType: "RATIO", config: { numerator: { event: "execution_plan.completed" }, denominator: { event: "demand.detected" } } },
  { key: "avg-cleaning-duration", name: "Average Cleaning Duration", queryType: "AVERAGE", config: { field: "durationMin", event: "execution_plan.completed" } },
  { key: "customer-retention", name: "Customer Retention Rate", queryType: "RETENTION", config: { cohort: "customer_id", period: "MONTHLY" } },
  { key: "worker-utilization", name: "Worker Utilization", queryType: "TIME_SERIES", config: { field: "utilization", groupBy: "resource_id", period: "WEEKLY" } },
  { key: "revenue-per-customer", name: "Revenue Per Customer", queryType: "TOP_N", config: { metric: "payment.captured", groupBy: "customer_id", limit: 10 } },
  { key: "chemical-consumption", name: "Chemical Consumption Trends", queryType: "TIME_SERIES", config: { field: "quantity", groupBy: "chemical_id", period: "MONTHLY" } },
];

// ============================================================================
//  API ENDPOINTS — protocol-specific API routes
// ============================================================================

const apiEndpoints: ApiEndpointDefinition[] = [
  { path: "/api/protocols/eks-clean/services", method: "GET", handler: "listServices", authRequired: true },
  { path: "/api/protocols/eks-clean/book", method: "POST", handler: "bookCleaning", authRequired: true },
  { path: "/api/protocols/eks-clean/quote", method: "POST", handler: "getQuote", authRequired: false },
  { path: "/api/protocols/eks-clean/subscribe", method: "POST", handler: "subscribe", authRequired: true },
  { path: "/api/protocols/eks-clean/property", method: "POST", handler: "registerProperty", authRequired: true },
  { path: "/api/protocols/eks-clean/worker/certify", method: "POST", handler: "certifyWorker", authRequired: true },
  { path: "/api/protocols/eks-clean/chemicals", method: "GET", handler: "listChemicals", authRequired: true },
  { path: "/api/protocols/eks-clean/surfaces", method: "GET", handler: "listSurfaces", authRequired: true },
];

// ============================================================================
//  UI COMPONENTS — protocol-specific UI
// ============================================================================

const uiComponents: UiComponentDefinition[] = [
  { key: "booking-form", name: "Cleaning Booking Form", componentType: "FORM", props: { services: ["residential", "commercial", "deep", "move", "laundry", "carpet", "upholstery", "window", "waste"] } },
  { key: "service-catalog", name: "Service Catalog", componentType: "GRID", props: { columns: 3 } },
  { key: "property-twin-view", name: "Property Digital Twin", componentType: "CANVAS", props: { interactive: true } },
  { key: "worker-schedule", name: "Worker Schedule Board", componentType: "BOARD", props: { groupBy: "date" } },
  { key: "quality-dashboard", name: "Quality Dashboard", componentType: "DASHBOARD", props: { metrics: ["punctuality", "cleanliness", "professionalism"] } },
  { key: "chemical-safety-card", name: "Chemical Safety Card", componentType: "CARD", props: { showPPE: true, showDilution: true } },
  { key: "subscription-manager", name: "Subscription Manager", componentType: "PANEL", props: { plans: ["weekly", "biweekly", "monthly"] } },
  { key: "route-optimizer", name: "Route Optimizer", componentType: "MAP", props: { showTraffic: true } },
];

// ============================================================================
//  COMPILER STAGES — protocol-specific pipeline stages
// ============================================================================

const compilerStages: CompilerStage[] = [
  { name: "surface-compatibility-check", order: 50, handler: "checkSurfaceCompatibility" },
  { name: "chemical-safety-validation", order: 51, handler: "validateChemicalSafety" },
  { name: "property-twin-enrichment", order: 52, handler: "enrichWithPropertyData" },
  { name: "subscription-discount-application", order: 70, handler: "applySubscriptionDiscount" },
];

// ============================================================================
//  PROTOCOL DEFINITION — the complete Eks-Clean protocol
// ============================================================================

export const eksCleanProtocol: ProtocolDefinition = {
  key: "eks-clean",
  name: "Eks-Clean",
  version: "2.0.0",
  description: "Household cleaning services — the first OpsOS protocol. Residential, commercial, deep cleaning, laundry, carpet, upholstery, windows, waste collection. Includes surface intelligence, chemical intelligence, property digital twins, dynamic pricing, route optimization, enterprise customers, and AI-ready event collection.",

  registerCapabilities() { return capabilities; },
  registerIntentDefinitions() { return intentDefinitions; },
  registerPolicies() { return policies; },
  registerRules() { return rules; },
  registerCompilerStages() { return compilerStages; },
  registerWorkflows() { return workflows; },
  registerMarketplace() { return marketplace; },
  registerPricing() { return pricing; },
  registerDashboards() { return dashboards; },
  registerReadModels() { return readModels; },
  registerAnalytics() { return analytics; },
  registerApi() { return apiEndpoints; },
  registerUi() { return uiComponents; },
};
