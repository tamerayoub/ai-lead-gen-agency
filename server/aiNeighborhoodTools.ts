/**
 * Neighborhood / Nearby Places Tools
 * Uses OpenAI Responses API with web_search for nearby places (no Google Maps/Places)
 */

import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { propertyAreaCache } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";

const CACHE_TTL_DAYS = 7;
const DEFAULT_RADIUS_METERS = 800;
const DEFAULT_CATEGORIES = ['grocery', 'coffee', 'restaurants', 'pharmacy', 'parks', 'transit', 'gym'];

export interface PropertyLocation {
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

export interface Place {
  name: string;
  address?: string;
  category: string;
  notes?: string;
}

export interface NearbyPlacesResult {
  centerAddress: string;
  radiusMeters: number;
  groups: {
    grocery?: Place[];
    coffee?: Place[];
    restaurants?: Place[];
    pharmacy?: Place[];
    parks?: Place[];
    transit?: Place[];
    gym?: Place[];
  };
  provider: { name: string; retrievedAt: string };
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  partial?: boolean;
}

/**
 * Get property location from DB (formatted address for web search)
 */
export async function getPropertyLocation(
  orgId: string,
  propertyId: string
): Promise<{ success: boolean; data?: PropertyLocation; error?: string }> {
  try {
    const property = await storage.getProperty(propertyId, orgId);
    if (!property) {
      return { success: false, error: `Property ${propertyId} not found` };
    }

    const formattedAddress = [
      property.address || property.street,
      property.city,
      property.state,
      property.zipCode
    ].filter(Boolean).join(', ');

    return {
      success: true,
      data: {
        formattedAddress: formattedAddress || property.address || 'Unknown address',
        city: property.city || undefined,
        state: property.state || undefined,
        postalCode: property.zipCode || undefined,
      },
    };
  } catch (err: any) {
    console.error('[getPropertyLocation] Error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to get property location',
    };
  }
}

function hashCategories(categories: string[]): string {
  return crypto.createHash('sha256').update(categories.sort().join(',')).digest('hex').slice(0, 16);
}

/**
 * Get cached nearby places if fresh
 */
async function getCachedNearbyPlaces(
  propertyId: string,
  radiusMeters: number,
  categoriesHash: string
): Promise<NearbyPlacesResult | null> {
  try {
    const rows = await db
      .select()
      .from(propertyAreaCache)
      .where(and(
        eq(propertyAreaCache.propertyId, propertyId),
        eq(propertyAreaCache.radiusMeters, radiusMeters),
        eq(propertyAreaCache.categoriesHash, categoriesHash),
        gt(propertyAreaCache.expiresAt, new Date())
      ))
      .limit(1);

    if (rows.length > 0) {
      const cached = rows[0];
      const result = cached.resultJson as NearbyPlacesResult;
      console.log('[get_nearby_places] Cache HIT for', propertyId);
      return result;
    }
    return null;
  } catch (err) {
    console.warn('[get_nearby_places] Cache lookup failed:', err);
    return null;
  }
}

/**
 * Save result to cache
 */
async function saveToCache(
  propertyId: string,
  radiusMeters: number,
  categoriesHash: string,
  result: NearbyPlacesResult
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await db.insert(propertyAreaCache).values({
      propertyId,
      radiusMeters,
      categoriesHash,
      resultJson: result,
      providerName: result.provider?.name || 'openai_web_search',
      retrievedAt: new Date(),
      expiresAt,
    });
    console.log('[get_nearby_places] Cached result for', propertyId);
  } catch (err) {
    console.warn('[get_nearby_places] Cache save failed:', err);
  }
}

/**
 * Call OpenAI Responses API with web_search for nearby places
 */
export async function getNearbyPlacesOpenAI(
  orgId: string,
  propertyId: string,
  options?: {
    radiusMeters?: number;
    categories?: string[];
  }
): Promise<{
  success: boolean;
  data?: NearbyPlacesResult;
  error?: string;
  sources?: string[];
}> {
  const radiusMeters = options?.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const categories = options?.categories ?? DEFAULT_CATEGORIES;
  const categoriesHash = hashCategories(categories);

  // Check cache first
  const cached = await getCachedNearbyPlaces(propertyId, radiusMeters, categoriesHash);
  if (cached) {
    return {
      success: true,
      data: cached,
      sources: ['cache:property_area_cache'],
    };
  }

  // Get property address
  const locResult = await getPropertyLocation(orgId, propertyId);
  if (!locResult.success || !locResult.data) {
    return {
      success: false,
      error: locResult.error || 'Could not get property address',
      sources: [],
    };
  }

  const address = locResult.data.formattedAddress;
  const model = process.env.OPENAI_NEIGHBORHOOD_MODEL || 'gpt-4o';
  const searchPrompt = `Search the web for nearby places around this address: ${address}

Find places within approximately ${Math.round(radiusMeters / 1609)} mile(s) (${radiusMeters} meters) in these categories:
- Grocery stores
- Coffee shops
- Restaurants
- Pharmacies
- Parks
- Transit (bus stops, train stations, light rail)
- Gyms (optional)

Return a JSON object with this EXACT structure (no other text):
{
  "centerAddress": "${address}",
  "radiusMeters": ${radiusMeters},
  "groups": {
    "grocery": [{"name": "Store Name", "address": "full address", "category": "grocery", "notes": "optional"}],
    "coffee": [],
    "restaurants": [],
    "pharmacy": [],
    "parks": [],
    "transit": [],
    "gym": []
  },
  "provider": {"name": "openai_web_search", "retrievedAt": "${new Date().toISOString()}"},
  "citations": [{"url": "https://...", "title": "Page Title", "snippet": "relevant snippet"}]
}

List up to 5 places per category. Use real business/place names and addresses from your search. If a category has no results, use an empty array. Include citations from the web search.`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let outputText = '';
    const citations: Array<{ url: string; title?: string; snippet?: string }> = [];

    // Use Responses API with web_search (OPENAI_NEIGHBORHOOD_MODEL env, default gpt-4o)
    try {
      const response = await openai.responses.create({
        model,
        tools: [{ type: 'web_search' as const }],
        input: searchPrompt,
        include: ['web_search_call.action.sources'],
      });

      outputText = (response as any).output_text || '';
      if ((response as any).output) {
        for (const item of (response as any).output) {
          if (item?.type === 'message' && item.content) {
            for (const c of item.content) {
              if (c?.type === 'output_text' && c.annotations) {
                for (const ann of c.annotations) {
                  if (ann?.type === 'url_citation') {
                    citations.push({
                      url: ann.url || '',
                      title: ann.title,
                      snippet: ann.snippet,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (responsesError: any) {
      console.warn('[get_nearby_places_openai] Responses API failed, fallback to Chat:', responsesError?.message);
      // Fallback: Chat Completions (no web search - uses model knowledge)
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You help find nearby places. Return ONLY valid JSON. Use your knowledge of common business types and areas. Do not make up specific business names - use generic descriptions if you lack specific data.',
          },
          { role: 'user', content: searchPrompt },
        ],
        temperature: 0.2,
      });
      outputText = completion.choices[0]?.message?.content || '';
    }

    if (!outputText) {
      return {
        success: true,
        data: {
          centerAddress: address,
          radiusMeters,
          groups: {},
          provider: { name: 'openai_web_search', retrievedAt: new Date().toISOString() },
          citations,
          partial: true,
        },
        sources: ['openai'],
      };
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = outputText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as NearbyPlacesResult;
    const result: NearbyPlacesResult = {
      centerAddress: parsed.centerAddress || address,
      radiusMeters: parsed.radiusMeters ?? radiusMeters,
      groups: parsed.groups || {},
      provider: parsed.provider || {
        name: 'openai_web_search',
        retrievedAt: new Date().toISOString(),
      },
      citations: parsed.citations || citations,
    };

    const hasAnyPlaces = Object.values(result.groups).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
    if (!hasAnyPlaces) {
      result.partial = true;
    }

    await saveToCache(propertyId, radiusMeters, categoriesHash, result);

    return {
      success: true,
      data: result,
      sources: ['openai_web_search'],
    };
  } catch (err: any) {
    console.error('[get_nearby_places_openai] Error:', err);

    // Return empty result with partial flag on error
    return {
      success: true,
      data: {
        centerAddress: address,
        radiusMeters,
        groups: {},
        provider: { name: 'openai_web_search', retrievedAt: new Date().toISOString() },
        citations: [],
        partial: true,
      },
      sources: ['openai'],
    };
  }
}
