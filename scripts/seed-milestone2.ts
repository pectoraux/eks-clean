/**
 * Milestone 2 seed — Knowledge Base, Workforce, AI-Ready, Event-Sourced demo data.
 * Run AFTER scripts/seed.ts + scripts/seed-erp.ts.
 */

import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Seeding Milestone 2 modules...");

  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("Run scripts/seed.ts first.");
    process.exit(1);
  }
  const workers = await db.worker.findMany({ take: 5, include: { user: true } });

  // =========================================================================
  //  Knowledge Base
  // =========================================================================
  console.log("  → Knowledge Base");
  const kbArticles = [
    { title: "How to Safely Handle Bleach", body: "## Safety First\n\nAlways wear gloves and goggles when handling bleach. Never mix bleach with ammonia-based cleaners as this produces toxic chloramine gas.\n\n## Dilution\n\nFor general surface cleaning, dilute 1 part bleach with 10 parts water.", category: "SAFETY", tags: ["BLEACH", "SAFETY", "CHEMICAL"] },
    { title: "Marble Surface Care Guide", body: "## Introduction\n\nMarble is a soft, porous stone that requires special care.\n\n## Do's\n- Use pH-neutral cleaners\n- Wipe spills immediately\n- Use coasters and trivens\n\n## Don'ts\n- Never use vinegar or lemon juice\n- Avoid abrasive scrubbers", category: "CHEMICAL", tags: ["MARBLE", "SURFACE"] },
    { title: "Worker Onboarding Checklist", body: "## Day 1\n- Collect ID and complete KYC\n- Issue uniform and PPE\n- Assign mentor\n\n## Week 1\n- Complete Chemical Safety course\n- Shadow 3 bookings\n- Pass equipment basics exam", category: "HR", tags: ["ONBOARDING", "HR"] },
    { title: "Carpet Cleaning Runbook", body: "## Steps\n1. Vacuum thoroughly\n2. Pre-treat stains\n3. Apply shampoo with machine\n4. Extract water\n5. Air dry 4-6 hours\n\n## Equipment\n- Hot water extractor\n- Stain brush\n- Air movers", category: "RUNBOOK", tags: ["CARPET", "CLEANING"] },
    { title: "Customer Complaint Handling", body: "## When a customer complains:\n1. Listen without interrupting\n2. Acknowledge their frustration\n3. Apologize without admitting fault\n4. Offer a concrete remedy\n5. Follow up within 24 hours\n\n## Escalation\n- Refund > ₵200 → manager\n- Repeated complaints → admin review", category: "FAQ", tags: ["CUSTOMER", "COMPLAINTS"] },
  ];
  for (const a of kbArticles) {
    const article = await db.kbArticle.create({
      data: {
        slug: a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "-" + Math.random().toString(36).slice(2, 6),
        title: a.title,
        body: a.body,
        excerpt: a.body.split("\n")[0].slice(0, 100),
        category: a.category,
        tags: a.tags,
        status: "PUBLISHED",
        authorId: admin.id,
        publishedAt: new Date(),
        searchVector: (a.title + " " + a.body + " " + a.tags.join(" ")).toLowerCase(),
        viewsCount: Math.floor(Math.random() * 200),
        helpfulCount: Math.floor(Math.random() * 30),
      },
    });
    await db.kbArticleVersion.create({
      data: {
        articleId: article.id,
        version: 1,
        title: a.title,
        body: a.body,
        excerpt: a.body.split("\n")[0].slice(0, 100),
        editedBy: admin.id,
        changeSummary: "Initial creation",
      },
    });
  }

  // =========================================================================
  //  Workforce — skills, pay grades, time-off, shifts, performance
  // =========================================================================
  console.log("  → Workforce");
  const skills = [
    { code: "SKILL-MARBLE", name: "Marble Surface Care", category: "SURFACE", levels: 4, isCertificationRequired: true },
    { code: "SKILL-CARPET", name: "Carpet Cleaning", category: "CLEANING", levels: 3, isCertificationRequired: false },
    { code: "SKILL-CHEMSAFE", name: "Chemical Safety", category: "SAFETY", levels: 3, isCertificationRequired: true },
    { code: "SKILL-WINDOW", name: "Window Cleaning", category: "CLEANING", levels: 3, isCertificationRequired: false },
    { code: "SKILL-DRIVE", name: "Driving (Motorbike)", category: "DRIVING", levels: 3, isCertificationRequired: true },
  ];
  for (const s of skills) {
    await db.skill.create({ data: s });
  }

  // Assess workers on skills
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    for (const s of skills.slice(0, 3)) {
      await db.skillAssessment.create({
        data: {
          skillId: (await db.skill.findUnique({ where: { code: s.code } }))!.id,
          workerId: w.id,
          level: 1 + Math.floor(Math.random() * s.levels),
          assessorId: admin.id,
          assessedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // Pay grades
  const payGrades = [
    { code: "PG-1", name: "Trainee", baseHourlyMinor: 2500, overtimeMultiplier: 1.5, weekendMultiplier: 1.25, holidayMultiplier: 2.0 },
    { code: "PG-2", name: "Junior", baseHourlyMinor: 3500, overtimeMultiplier: 1.5, weekendMultiplier: 1.25, holidayMultiplier: 2.0 },
    { code: "PG-3", name: "Senior", baseHourlyMinor: 5000, overtimeMultiplier: 1.5, weekendMultiplier: 1.25, holidayMultiplier: 2.0 },
    { code: "PG-4", name: "Lead", baseHourlyMinor: 7000, overtimeMultiplier: 1.75, weekendMultiplier: 1.5, holidayMultiplier: 2.5 },
  ];
  for (const pg of payGrades) {
    await db.payGrade.create({ data: pg });
  }
  // Assign pay grades to workers
  for (let i = 0; i < workers.length; i++) {
    const gradeIdx = Math.min(3, Math.floor(i / 2));
    await db.workerPayGradeAssignment.create({
      data: {
        workerId: workers[i].id,
        payGradeId: (await db.payGrade.findUnique({ where: { code: payGrades[gradeIdx].code } }))!.id,
        effectiveFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Time-off requests
  const timeOffTypes = ["VACATION", "SICK", "PERSONAL"];
  for (let i = 0; i < 4; i++) {
    const w = workers[i];
    const start = new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + (1 + i) * 24 * 60 * 60 * 1000);
    await db.timeOffRequest.create({
      data: {
        workerId: w.id,
        type: timeOffTypes[i % 3],
        startDate: start,
        endDate: end,
        reason: "Family event" ,
        status: i === 3 ? "APPROVED" : "PENDING",
        ...(i === 3 ? { reviewedBy: admin.id, reviewedAt: new Date() } : {}),
      },
    });
  }

  // Shifts for the next 7 days
  for (let d = 0; d < 7; d++) {
    for (let i = 0; i < 3; i++) {
      const w = workers[i % workers.length];
      await db.shiftSchedule.create({
        data: {
          workerId: w.id,
          date: new Date(Date.now() + d * 24 * 60 * 60 * 1000),
          startTime: "08:00",
          endTime: "17:00",
          type: "REGULAR",
          zone: ["Spintex", "East-Legon", "Osu"][i % 3],
          status: d === 0 ? "CONFIRMED" : "SCHEDULED",
        },
      }).catch(() => {}); // ignore unique constraint violations
    }
  }

  // Performance scores (current month)
  const currentPeriod = new Date().toISOString().slice(0, 7);
  for (const w of workers) {
    const punctuality = 70 + Math.random() * 30;
    const quality = 75 + Math.random() * 25;
    const productivity = 65 + Math.random() * 35;
    const customer = 70 + Math.random() * 30;
    const team = 75 + Math.random() * 25;
    const overall = 0.25 * punctuality + 0.30 * quality + 0.20 * productivity + 0.15 * customer + 0.10 * team;
    await db.workerPerformanceScore.create({
      data: {
        workerId: w.id,
        period: currentPeriod,
        overallScore: overall,
        punctualityScore: punctuality,
        qualityScore: quality,
        productivityScore: productivity,
        customerScore: customer,
        teamScore: team,
        trend: ["UP", "DOWN", "STABLE"][Math.floor(Math.random() * 3)],
        factorsJson: JSON.stringify({ completedJobs: Math.floor(Math.random() * 20) }),
      },
    });
  }

  // =========================================================================
  //  Subscriptions Advanced — addons + usage
  // =========================================================================
  console.log("  → Subscriptions Advanced");
  const addons = [
    { code: "ADDON-WINDOW", name: "Window Cleaning Addon", priceMinor: 5000, billingCycle: "MONTHLY" },
    { code: "ADDON-IRON", name: "Ironing Addon", priceMinor: 3000, billingCycle: "MONTHLY" },
    { code: "ADDON-DEEP", name: "Deep Clean Addon", priceMinor: 8000, billingCycle: "MONTHLY" },
  ];
  for (const a of addons) {
    await db.subscriptionAddon.create({ data: a });
  }
  // Assign addon to existing subscriptions
  const subs = await db.subscription.findMany({ take: 3 });
  for (let i = 0; i < subs.length; i++) {
    const addon = await db.subscriptionAddon.findUnique({ where: { code: addons[i % addons.length].code } });
    if (addon) {
      await db.subscriptionAddonAssignment.create({
        data: { subscriptionId: subs[i].id, addonId: addon.id, prorationMinor: 2500 },
      });
    }
    // Record usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await db.subscriptionUsage.create({
      data: {
        subscriptionId: subs[i].id,
        periodStart,
        periodEnd,
        unitsUsed: 3 + i,
        unitsIncluded: 4,
        overageMinor: i > 1 ? 5000 : 0,
      },
    });
    // Lifecycle event
    await db.subscriptionLifecycleEvent.create({
      data: {
        subscriptionId: subs[i].id,
        eventType: "ADDON_ADDED",
        payloadJson: JSON.stringify({ addonCode: addons[i % addons.length].code }),
        actorId: admin.id,
        actorType: "ADMIN",
      },
    });
  }

  // =========================================================================
  //  Event-Sourced Analytics — sample events
  // =========================================================================
  console.log("  → Event-Sourced Analytics");
  // Record payment.captured events from existing payment intents
  const payments = await db.paymentIntent.findMany({ where: { status: "succeeded" }, take: 20 });
  for (const p of payments) {
    await db.analyticsEvent.create({
      data: {
        aggregateType: "REVENUE",
        aggregateId: p.bookingId ?? p.id,
        eventType: "payment.captured",
        version: 1,
        payloadJson: JSON.stringify({ amountMinor: p.amountMinor, paymentIntentId: p.id }),
        metadataJson: JSON.stringify({ actorType: "SYSTEM" }),
        occurredAt: p.capturedAt ?? new Date(),
      },
    });
  }
  // Record booking.completed events
  const completedBookings = await db.booking.findMany({ where: { status: "rated" }, take: 10, include: { assignments: true } });
  for (const b of completedBookings) {
    const workerId = b.assignments[0]?.workerId;
    await db.analyticsEvent.create({
      data: {
        aggregateType: "BOOKING",
        aggregateId: b.id,
        eventType: "booking.completed",
        version: 1,
        payloadJson: JSON.stringify({ bookingId: b.id, workerId, totalMinor: b.totalMinor }),
        occurredAt: b.actualEnd ?? b.scheduledEnd,
      },
    });
  }

  // Saved query
  await db.analyticsQuery.create({
    data: {
      name: "Monthly Revenue Trend",
      description: "Sum of captured payments per month",
      queryType: "TIME_SERIES",
      dataSource: "PROJECTION",
      configJson: JSON.stringify({ projectionName: "monthly_revenue" }),
      isPublic: true,
      createdBy: admin.id,
    },
  });

  // =========================================================================
  //  AI-Ready — prompt templates, model configs, sample predictions
  // =========================================================================
  console.log("  → AI-Ready");
  await db.aiPromptTemplate.create({
    data: {
      key: "support.triage",
      name: "Support Ticket Triage",
      description: "Classifies incoming support tickets by urgency and category",
      systemPrompt: "You are a support ticket triage assistant for Eks-Clean. Classify the ticket into one of: BILLING, SCHEDULING, QUALITY, COMPLAINT, OTHER. Also assign an urgency: LOW, NORMAL, HIGH, URGENT.",
      userPromptTemplate: "Customer: {{customerName}}\nSubject: {{subject}}\nBody: {{body}}\n\nClassify this ticket:",
      variablesJson: JSON.stringify([
        { name: "customerName", type: "string", required: true },
        { name: "subject", type: "string", required: true },
        { name: "body", type: "string", required: true },
      ]),
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 256,
      createdBy: admin.id,
    },
  });

  await db.aiPromptTemplate.create({
    data: {
      key: "demand.forecast",
      name: "Weekly Demand Forecast",
      description: "Predicts booking volume per zone for the next 7 days",
      systemPrompt: "You are a demand forecasting assistant. Given historical booking counts, predict the next 7 days of demand per zone.",
      userPromptTemplate: "Historical data (last 4 weeks):\n{{history}}\n\nPredict demand for zone {{zone}} for the next 7 days:",
      variablesJson: JSON.stringify([
        { name: "history", type: "string", required: true },
        { name: "zone", type: "string", required: true },
      ]),
      model: "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 512,
      createdBy: admin.id,
    },
  });

  // Model configs
  const models = [
    { provider: "OPENAI", modelId: "gpt-4o-mini", displayName: "GPT-4o mini", contextWindow: 128000, inputCostPer1kMinor: 15, outputCostPer1kMinor: 60, capabilities: ["TEXT", "VISION", "FUNCTION_CALLING", "JSON_MODE"] },
    { provider: "OPENAI", modelId: "gpt-4o", displayName: "GPT-4o", contextWindow: 128000, inputCostPer1kMinor: 250, outputCostPer1kMinor: 1000, capabilities: ["TEXT", "VISION", "FUNCTION_CALLING", "JSON_MODE"] },
    { provider: "OPENAI", modelId: "text-embedding-3-small", displayName: "text-embedding-3-small", contextWindow: 8191, inputCostPer1kMinor: 2, outputCostPer1kMinor: 0, capabilities: ["EMBEDDINGS"] },
  ];
  for (const m of models) {
    await db.aiModelConfig.create({ data: m });
  }

  // Sample predictions
  const predTypes = [
    { predictionType: "DEMAND_FORECAST", entityType: "ZONE", entityId: "spintex", predictedValue: 45, confidence: 0.78, horizonDays: 7 },
    { predictionType: "CHURN_RISK", entityType: "CUSTOMER", entityId: workers[0].id, predictedValue: 0.25, confidence: 0.65, horizonDays: 30 },
    { predictionType: "QA_SCORE", entityType: "WORKER", entityId: workers[0].id, predictedValue: 88, confidence: 0.82, horizonDays: 1 },
    { predictionType: "DEMAND_FORECAST", entityType: "ZONE", entityId: "east-legon", predictedValue: 62, confidence: 0.81, horizonDays: 7, actualValue: 58, accuracyScore: 0.93, resolvedAt: new Date() },
  ];
  for (const p of predTypes) {
    await db.aiPrediction.create({
      data: { ...p, featuresJson: JSON.stringify({ historical_avg: 50, seasonality: "weekly" }) },
    });
  }

  // Sample agent run
  const run = await db.aiAgentRun.create({
    data: {
      agentType: "SUPPORT_TRIAGE",
      promptTemplateId: (await db.aiPromptTemplate.findUnique({ where: { key: "support.triage" } }))!.id,
      inputJson: JSON.stringify({ customerName: "Test Customer", subject: "Late arrival", body: "My cleaner arrived 30 minutes late." }),
      status: "COMPLETED",
      outputJson: JSON.stringify({ category: "SCHEDULING", urgency: "NORMAL" }),
      modelUsed: "gpt-4o-mini",
      promptTokens: 145,
      completionTokens: 12,
      totalCostMinor: 3,
      latencyMs: 842,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 50000),
    },
  });

  // Workflow adapter
  await db.aiWorkflowAdapter.create({
    data: {
      agentType: "DEMAND_FORECAST",
      promptTemplateKey: "demand.forecast",
      triggerConditionsJson: JSON.stringify({ eventType: "analytics.event_recorded", aggregateType: "BOOKING" }),
      outputMappingJson: JSON.stringify({ target: "aiPrediction", entityType: "ZONE" }),
    },
  });

  console.log("✅ Milestone 2 seed complete");
  console.log(`   KB: ${await db.kbArticle.count()} articles`);
  console.log(`   Workforce: ${await db.skill.count()} skills, ${await db.payGrade.count()} pay grades, ${await db.timeOffRequest.count()} time-off, ${await db.shiftSchedule.count()} shifts, ${await db.workerPerformanceScore.count()} performance scores`);
  console.log(`   Subscriptions+: ${await db.subscriptionAddon.count()} addons, ${await db.subscriptionLifecycleEvent.count()} lifecycle events`);
  console.log(`   Event-Sourced: ${await db.analyticsEvent.count()} events, ${await db.analyticsQuery.count()} saved queries`);
  console.log(`   AI-Ready: ${await db.aiPromptTemplate.count()} prompts, ${await db.aiModelConfig.count()} models, ${await db.aiAgentRun.count()} runs, ${await db.aiPrediction.count()} predictions`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
