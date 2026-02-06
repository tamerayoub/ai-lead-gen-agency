/**
 * Tests for Neighborhood / Nearby Places capability
 *
 * Covers:
 * 1. Router classification for neighborhood intent
 * 2. Tool output validation shape
 * 3. Cache key hashing
 */

import crypto from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type OpenAI from 'openai';

vi.mock('../db', () => ({ pool: {}, db: {} }));
vi.mock('../aiAutoTrain', () => ({
  loadTrainedArtifacts: vi.fn().mockResolvedValue({ enabled: false, intentPlaybook: null }),
}));
vi.mock('../aiConversationMemory', () => ({
  appearsToAnswerQuestion: vi.fn().mockReturnValue(false),
}));

import { classifyMessageIntent } from '../aiRouter';

// Mock OpenAI - classifyMessageIntent uses openai.chat.completions.create
const createMockOpenAI = (intent: string) => ({
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent,
                confidence: 'high',
                reasoning: 'Test',
                followUpQuestion: null,
              }),
            },
          },
        ],
      }),
    },
  },
});

describe('Neighborhood Intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Router classification', () => {
    it('should classify "what\'s around here?" as neighborhood', async () => {
      const openai = createMockOpenAI('neighborhood') as unknown as OpenAI;
      const result = await classifyMessageIntent(openai, "What's around here?", {
        hasProperty: true,
        propertyId: 'prop-123',
      });
      expect(result.intent).toBe('neighborhood');
    });

    it('should classify "nearby stores?" as neighborhood', async () => {
      const openai = createMockOpenAI('neighborhood') as unknown as OpenAI;
      const result = await classifyMessageIntent(openai, 'Nearby stores?', {
        hasProperty: true,
        propertyId: 'prop-123',
      });
      expect(result.intent).toBe('neighborhood');
    });

    it('should classify "is it walkable?" as neighborhood', async () => {
      const openai = createMockOpenAI('neighborhood') as unknown as OpenAI;
      const result = await classifyMessageIntent(openai, 'Is it walkable?', {
        hasProperty: true,
        propertyId: 'prop-123',
      });
      expect(result.intent).toBe('neighborhood');
    });

    it('should classify "transit nearby?" as neighborhood', async () => {
      const openai = createMockOpenAI('neighborhood') as unknown as OpenAI;
      const result = await classifyMessageIntent(openai, 'Transit nearby?', {
        hasProperty: true,
        propertyId: 'prop-123',
      });
      expect(result.intent).toBe('neighborhood');
    });

    it('should classify "parks or restaurants?" as neighborhood', async () => {
      const openai = createMockOpenAI('neighborhood') as unknown as OpenAI;
      const result = await classifyMessageIntent(openai, 'Any parks or restaurants?', {
        hasProperty: true,
        propertyId: 'prop-123',
      });
      expect(result.intent).toBe('neighborhood');
    });
  });
});

describe('Tool output validation', () => {
  it('should validate NearbyPlacesResult shape', () => {
    const validResult = {
      centerAddress: '123 Main St',
      radiusMeters: 800,
      groups: {
        grocery: [{ name: 'Store', address: '456 Oak', category: 'grocery' }],
        coffee: [],
        restaurants: [],
        pharmacy: [],
        parks: [],
        transit: [],
        gym: [],
      },
      provider: { name: 'openai_web_search', retrievedAt: new Date().toISOString() },
      citations: [{ url: 'https://example.com', title: 'Example' }],
    };

    expect(validResult.centerAddress).toBeDefined();
    expect(validResult.radiusMeters).toBe(800);
    expect(validResult.groups).toBeDefined();
    expect(validResult.groups.grocery).toBeInstanceOf(Array);
    expect(validResult.provider.name).toBe('openai_web_search');
    expect(validResult.citations).toBeInstanceOf(Array);
  });

  it('should allow partial flag for insufficient results', () => {
    const partialResult = {
      centerAddress: '123 Main St',
      radiusMeters: 800,
      groups: {},
      provider: { name: 'openai_web_search', retrievedAt: new Date().toISOString() },
      citations: [],
      partial: true,
    };

    expect(partialResult.partial).toBe(true);
    expect(Object.keys(partialResult.groups).length).toBe(0);
  });
});

describe('Cache key hashing', () => {
  it('categories hash should be deterministic', () => {
    const hash1 = crypto.createHash('sha256').update(['grocery', 'coffee'].sort().join(',')).digest('hex').slice(0, 16);
    const hash2 = crypto.createHash('sha256').update(['coffee', 'grocery'].sort().join(',')).digest('hex').slice(0, 16);
    expect(hash1).toBe(hash2);
  });
});
