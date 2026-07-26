/**
 * ============================================================================
 *  Geographic Intelligence Service
 *  Country → Region → City → District → Neighborhood → Zone → ServiceArea
 *  Plus: TravelPolygon, CoverageRadius, TrafficModel, PricingZone, DemandScore
 * ============================================================================
 */

import { db } from "@/lib/db";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Hierarchy CRUD
// ---------------------------------------------------------------------------

export async function createCountry(input: { code: string; name: string; currency?: string; phoneCode?: string; timezone?: string }) {
  const existing = await db.geoCountry.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Country ${input.code} already exists`);
  return db.geoCountry.create({ data: input });
}

export async function createRegion(countryId: string, input: { code: string; name: string }) {
  return db.geoRegion.create({ data: { ...input, countryId } });
}

export async function createCity(regionId: string, input: { code: string; name: string; latitude?: number; longitude?: number }) {
  return db.geoCity.create({ data: { ...input, regionId } });
}

export async function createDistrict(cityId: string, input: { code: string; name: string }) {
  return db.geoDistrict.create({ data: { ...input, cityId } });
}

export async function createNeighborhood(districtId: string, input: { code: string; name: string; latitude?: number; longitude?: number }) {
  return db.geoNeighborhood.create({ data: { ...input, districtId } });
}

export async function createZone(input: {
  organizationId?: string;
  neighborhoodId?: string;
  code: string;
  name: string;
  description?: string;
  polygonJson?: string;
  coverageRadiusKm?: number;
  centerLatitude?: number;
  centerLongitude?: number;
  trafficModelJson?: string;
  demandScore?: number;
  pricingMultiplier?: number;
}) {
  return db.geoZone.create({ data: { ...input, demandScore: input.demandScore ?? 0.5, pricingMultiplier: input.pricingMultiplier ?? 1.0 } });
}

export async function createServiceArea(zoneId: string, input: { code: string; name: string; defaultWorkerPool?: string; estimatedTravelMin?: number }) {
  return db.geoServiceArea.create({ data: { ...input, zoneId } });
}

// ---------------------------------------------------------------------------
//  Hierarchy queries
// ---------------------------------------------------------------------------

export async function getGeographicTree() {
  const countries = await db.geoCountry.findMany({
    where: { isActive: true },
    include: {
      regions: {
        where: { isActive: true },
        include: {
          cities: {
            where: { isActive: true },
            include: {
              districts: {
                where: { isActive: true },
                include: {
                  neighborhoods: {
                    include: {
                      zones: { where: { isActive: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return countries;
}

export async function getZonesForOrganization(organizationId: string) {
  return db.geoZone.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], isActive: true },
    include: {
      neighborhood: { include: { district: { include: { city: { include: { region: { include: { country: true } } } } } } } },
      serviceAreas: true,
    },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
//  Zone matching — find which zone a lat/lon falls into
//  (Simple radius check for now; pluggable for polygon-based matching later)
// ---------------------------------------------------------------------------

export async function findZoneForCoordinates(latitude: number, longitude: number, organizationId?: string): Promise<{ zoneId: string; distanceKm: number } | null> {
  const zones = await db.geoZone.findMany({
    where: {
      OR: [{ organizationId }, { organizationId: null }],
      isActive: true,
      centerLatitude: { not: null },
      centerLongitude: { not: null },
    },
  });

  let best: { zoneId: string; distanceKm: number } | null = null;
  for (const z of zones) {
    if (z.centerLatitude == null || z.centerLongitude == null) continue;
    const distKm = haversineKm(latitude, longitude, z.centerLatitude, z.centerLongitude);
    if (z.coverageRadiusKm && distKm <= z.coverageRadiusKm) {
      if (!best || distKm < best.distanceKm) {
        best = { zoneId: z.id, distanceKm: distKm };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
//  Travel time estimation using zone traffic model
// ---------------------------------------------------------------------------

export interface TrafficModel {
  off_peak: number;   // km/h
  morning_peak: number;
  evening_peak: number;
  night: number;
}

export function estimateTravelMinutes(distanceKm: number, trafficModel: TrafficModel, hourOfDay: number): number {
  let speed: number;
  if (hourOfDay >= 22 || hourOfDay < 6) speed = trafficModel.night;
  else if (hourOfDay >= 7 && hourOfDay < 10) speed = trafficModel.morning_peak;
  else if (hourOfDay >= 17 && hourOfDay < 20) speed = trafficModel.evening_peak;
  else speed = trafficModel.off_peak;
  return Math.round((distanceKm / speed) * 60);
}

// ---------------------------------------------------------------------------
//  Haversine distance
// ---------------------------------------------------------------------------

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
//  Demand score update (called periodically by a job)
// ---------------------------------------------------------------------------

export async function updateDemandScore(zoneId: string, demandScore: number) {
  if (demandScore < 0 || demandScore > 1) throw badRequest("Demand score must be 0..1");
  return db.geoZone.update({
    where: { id: zoneId },
    data: { demandScore },
  });
}

// ---------------------------------------------------------------------------
//  Geographic metrics
// ---------------------------------------------------------------------------

export async function geographicMetrics() {
  const [countries, regions, cities, zones, serviceAreas] = await Promise.all([
    db.geoCountry.count(),
    db.geoRegion.count(),
    db.geoCity.count(),
    db.geoZone.count(),
    db.geoServiceArea.count(),
  ]);
  return { countries, regions, cities, zones, serviceAreas };
}
