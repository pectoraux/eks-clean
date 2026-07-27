/**
 * ============================================================================
 *  Property Digital Twin Service
 *  Property → Room → Surface → Appliance → Furniture → Photo → Timeline
 * ============================================================================
 *  Each property is a living record of everything we know about a customer's
 *  home or office. Every cleaning, repair, inspection, and complaint becomes
 *  a timeline event. Over time, AI can recommend next cleanings, predict
 *  maintenance, and suggest products based on this history.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Property CRUD
// ---------------------------------------------------------------------------

export async function createProperty(input: {
  organizationId: string;
  customerId: string;
  name: string;
  propertyType?: string;
  addressId?: string;
  geoZoneId?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareMeters?: number;
  floors?: number;
  hasPets?: boolean;
  petDetails?: string;
  hasChildren?: boolean;
  accessNotes?: string;
  parkingAvailable?: boolean;
  specialInstructions?: string;
}) {
  const property = await db.property.create({ data: input });
  await publish({ eventType: "property.created", payload: { propertyId: property.id, customerId: input.customerId } });
  return property;
}

export async function getProperty(id: string) {
  const property = await db.property.findUnique({
    where: { id },
    include: {
      rooms: { include: { surfaces: true, furniture: true }, orderBy: { floor: "asc" } },
      appliances: true,
      photos: { orderBy: { takenAt: "desc" }, take: 10 },
      timeline: { orderBy: { occurredAt: "desc" }, take: 20 },
      cleaningHistory: { orderBy: { cleanedAt: "desc" }, take: 10 },
    },
  });
  if (!property) throw notFound("Property not found");
  return property;
}

export async function listPropertiesForCustomer(customerId: string) {
  return db.property.findMany({
    where: { customerId, status: "ACTIVE" },
    include: {
      _count: { select: { rooms: true, appliances: true, photos: true, timeline: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Room → Surface → Furniture
// ---------------------------------------------------------------------------

export async function addRoom(propertyId: string, input: {
  name: string; roomType?: string; floor?: number; areaSqM?: number; notes?: string;
}) {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) throw notFound("Property not found");
  return db.room.create({ data: { ...input, propertyId } });
}

export async function addSurface(roomId: string, input: {
  surfaceType: string; location?: string; areaSqM?: number; condition?: string; notes?: string;
}) {
  return db.surface.create({ data: { ...input, roomId } });
}

export async function addFurniture(roomId: string, input: {
  name: string; material?: string; quantity?: number; condition?: string; notes?: string;
}) {
  return db.furniture.create({ data: { ...input, roomId } });
}

// ---------------------------------------------------------------------------
//  Appliances
// ---------------------------------------------------------------------------

export async function addAppliance(propertyId: string, input: {
  name: string; brand?: string; model?: string; location?: string;
  purchaseDate?: Date; warrantyExpiry?: Date; notes?: string;
}) {
  return db.appliance.create({ data: { ...input, propertyId } });
}

// ---------------------------------------------------------------------------
//  Photos
// ---------------------------------------------------------------------------

export async function addPropertyPhoto(propertyId: string, input: {
  url: string; caption?: string; photoType?: string; roomId?: string; takenBy?: string;
}) {
  return db.propertyPhoto.create({ data: { ...input, propertyId } });
}

// ---------------------------------------------------------------------------
//  Timeline — every action on the property becomes history
// ---------------------------------------------------------------------------

export async function recordTimelineEvent(propertyId: string, input: {
  eventType: string;
  title: string;
  description?: string;
  bookingId?: string;
  workerId?: string;
  metadataJson?: Record<string, unknown>;
}) {
  const event = await db.propertyTimelineEvent.create({
    data: {
      propertyId,
      ...input,
      metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null,
      occurredAt: new Date(),
    },
  });
  await publish({ eventType: "property.timeline_event", payload: { propertyId, eventType: input.eventType } });
  return event;
}

export async function getPropertyTimeline(propertyId: string, limit = 50) {
  return db.propertyTimelineEvent.findMany({
    where: { propertyId },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
//  Cleaning records — structured history of each clean
// ---------------------------------------------------------------------------

export async function recordCleaning(propertyId: string, input: {
  bookingId?: string;
  cleanedAt: Date;
  durationMin: number;
  roomsCleaned: number;
  productsUsed?: Array<{ itemId: string; quantity: number }>;
  issuesFound?: string[];
  qualityScore?: number;
  notes?: string;
}) {
  const record = await db.propertyCleaningRecord.create({
    data: {
      propertyId,
      bookingId: input.bookingId,
      cleanedAt: input.cleanedAt,
      durationMin: input.durationMin,
      roomsCleaned: input.roomsCleaned,
      productsUsed: input.productsUsed ? JSON.stringify(input.productsUsed) : null,
      issuesFound: input.issuesFound ? JSON.stringify(input.issuesFound) : null,
      qualityScore: input.qualityScore,
      notes: input.notes,
    },
  });

  // Update property's lastCleanedAt + cleanliness score
  const allRecords = await db.propertyCleaningRecord.findMany({
    where: { propertyId },
    orderBy: { cleanedAt: "desc" },
    take: 10,
  });
  const avgQuality = allRecords.length > 0
    ? allRecords.reduce((s, r) => s + (r.qualityScore ?? 80), 0) / allRecords.length
    : 80;

  // Recommend next cleaning: if quality < 70, recommend sooner (7 days); otherwise 14 days
  const nextRecDays = avgQuality < 70 ? 7 : 14;
  await db.property.update({
    where: { id: propertyId },
    data: {
      lastCleanedAt: input.cleanedAt,
      nextRecommendedCleanAt: new Date(input.cleanedAt.getTime() + nextRecDays * 24 * 60 * 60 * 1000),
      cleanlinessScore: avgQuality,
    },
  });

  // Add to timeline
  await recordTimelineEvent(propertyId, {
    eventType: "CLEANED",
    title: "Property cleaned",
    description: `${input.roomsCleaned} rooms cleaned in ${input.durationMin} minutes`,
    bookingId: input.bookingId,
    metadataJson: { qualityScore: input.qualityScore, issues: input.issuesFound },
  });

  return record;
}

// ---------------------------------------------------------------------------
//  Property intelligence — recommendations based on history
// ---------------------------------------------------------------------------

export async function getPropertyRecommendations(propertyId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: {
      rooms: { include: { surfaces: true } },
      cleaningHistory: { orderBy: { cleanedAt: "desc" }, take: 5 },
      timeline: { orderBy: { occurredAt: "desc" }, take: 20 },
    },
  });
  if (!property) throw notFound("Property not found");

  const recommendations: Array<{ type: string; priority: string; message: string; suggestedDate?: Date }> = [];

  // 1. Next cleaning recommendation
  if (property.nextRecommendedCleanAt) {
    const daysUntil = Math.ceil((property.nextRecommendedCleanAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntil <= 0) {
      recommendations.push({
        type: "CLEANING_DUE",
        priority: "HIGH",
        message: `Cleaning is overdue by ${Math.abs(daysUntil)} days. Last cleaned: ${property.lastCleanedAt?.toLocaleDateString()}`,
        suggestedDate: new Date(),
      });
    } else if (daysUntil <= 3) {
      recommendations.push({
        type: "CLEANING_SOON",
        priority: "MEDIUM",
        message: `Cleaning recommended in ${daysUntil} days`,
        suggestedDate: property.nextRecommendedCleanAt,
      });
    }
  }

  // 2. Surface condition alerts
  const poorSurfaces = property.rooms.flatMap((r) => r.surfaces).filter((s) => s.condition === "POOR");
  if (poorSurfaces.length > 0) {
    recommendations.push({
      type: "SURFACE_MAINTENANCE",
      priority: "MEDIUM",
      message: `${poorSurfaces.length} surface(s) in poor condition — consider deep cleaning or treatment`,
    });
  }

  // 3. Recurring issues
  const allIssues = property.cleaningHistory.flatMap((r) => {
    try { return JSON.parse(r.issuesFound ?? "[]") as string[]; } catch { return []; }
  });
  const issueCounts = new Map<string, number>();
  for (const issue of allIssues) {
    issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
  for (const [issue, count] of issueCounts) {
    if (count >= 2) {
      recommendations.push({
        type: "RECURRING_ISSUE",
        priority: "HIGH",
        message: `Issue "${issue}" has been reported ${count} times — may need specialized treatment`,
      });
    }
  }

  // 4. Pet-related cleaning frequency
  if (property.hasPets && property.cleaningHistory.length > 0) {
    const lastClean = property.cleaningHistory[0];
    const daysSince = Math.ceil((Date.now() - lastClean.cleanedAt.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince > 10) {
      recommendations.push({
        type: "PET_CLEANING",
        priority: "MEDIUM",
        message: `Property has pets — consider more frequent cleaning (last cleaned ${daysSince} days ago)`,
      });
    }
  }

  return {
    property: { id: property.id, name: property.name, cleanlinessScore: property.cleanlinessScore },
    recommendations,
  };
}

// ---------------------------------------------------------------------------
//  Property metrics
// ---------------------------------------------------------------------------

export async function propertyMetrics(organizationId?: string) {
  const where = organizationId ? { organizationId } : {};
  const [total, totalRooms, totalAppliances, totalPhotos, totalTimeline, avgCleanliness] = await Promise.all([
    db.property.count({ where }),
    db.room.count({ where: { property: where } }),
    db.appliance.count({ where: { property: where } }),
    db.propertyPhoto.count({ where: { property: where } }),
    db.propertyTimelineEvent.count({ where: { property: where } }),
    db.property.aggregate({ where, _avg: { cleanlinessScore: true } }),
  ]);
  return {
    total,
    totalRooms,
    totalAppliances,
    totalPhotos,
    totalTimeline,
    avgCleanliness: avgCleanliness._avg.cleanlinessScore ?? 0,
  };
}
