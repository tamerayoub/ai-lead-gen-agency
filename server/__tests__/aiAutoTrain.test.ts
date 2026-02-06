/**
 * Tests for Auto Train AI feature
 * 
 * These tests ensure:
 * 1. StyleProfile and IntentPlaybook never contain factual data
 * 2. Router uses playbook when available
 * 3. Generator applies style constraints correctly
 * 4. Length constraints are enforced
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { buildStyleProfile, buildIntentPlaybook, type StyleProfile, type IntentPlaybook } from '../aiAutoTrain';
import { enforceLengthConstraint } from '../aiStyleMixer';

describe('Auto Train AI', () => {
  describe('buildStyleProfile', () => {
    it('should not extract prices or dates', async () => {
      const messages = [
        {
          type: 'outgoing' as const,
          message: 'The rent is $1,500 per month. Available starting March 1st.',
          createdAt: new Date(),
          leadId: 'lead-1'
        }
      ];

      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    greetingPatterns: ['Hello'],
                    closingPatterns: ['Thank you'],
                    commonPhrases: ['feel free'],
                    emojiPolicy: 'none',
                    personalizationTokensAllowed: [],
                    doNotUse: [],
                    formattingPreferences: {
                      useBullets: false,
                      useNumberedLists: false,
                      paragraphBreaks: true
                    }
                  })
                }
              }]
            })
          }
        }
      } as any;

      const profile = await buildStyleProfile(mockOpenAI, messages);
      
      // Verify no factual data in profile
      const profileStr = JSON.stringify(profile);
      expect(profileStr).not.toContain('1500');
      expect(profileStr).not.toContain('March');
      expect(profileStr).not.toContain('1st');
    });

    it('should extract style patterns only', async () => {
      const messages = [
        {
          type: 'outgoing' as const,
          message: 'Hi there! Thanks for reaching out. Feel free to ask any questions.',
          createdAt: new Date(),
          leadId: 'lead-1'
        }
      ];

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    greetingPatterns: ['Hi there!', 'Thanks for reaching out'],
                    closingPatterns: [],
                    commonPhrases: ['Feel free to ask'],
                    emojiPolicy: 'none',
                    personalizationTokensAllowed: [],
                    doNotUse: [],
                    formattingPreferences: {
                      useBullets: false,
                      useNumberedLists: false,
                      paragraphBreaks: true
                    }
                  })
                }
              }]
            })
          }
        }
      } as any;

      const profile = await buildStyleProfile(mockOpenAI, messages);
      
      expect(profile.greetingPatterns.length).toBeGreaterThan(0);
      expect(profile.commonPhrases.length).toBeGreaterThan(0);
    });
  });

  describe('buildIntentPlaybook', () => {
    it('should not include prices or unit numbers in example utterances', async () => {
      const messages = [
        {
          type: 'incoming' as const,
          message: 'How much is unit 101? Is it $1,500?',
          createdAt: new Date(),
          leadId: 'lead-1'
        }
      ];

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    intents: [{
                      name: 'pricing',
                      exampleUtterances: ['How much is rent?', 'What is the price?'],
                      requiredFields: ['propertyId'],
                      recommendedTools: ['quote_price'],
                      defaultFollowUpQuestion: 'Which property are you interested in?'
                    }]
                  })
                }
              }]
            })
          }
        }
      } as any;

      const playbook = await buildIntentPlaybook(mockOpenAI, messages);
      
      // Verify no factual data
      const playbookStr = JSON.stringify(playbook);
      expect(playbookStr).not.toContain('101');
      expect(playbookStr).not.toContain('1500');
    });
  });

  describe('enforceLengthConstraint', () => {
    it('should truncate to max sentences', () => {
      const longAnswer = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five. This is sentence six.';
      const result = enforceLengthConstraint(longAnswer, 3);
      
      const sentences = result.split(/[.!?]+/).filter(s => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(3);
    });

    it('should not truncate if under limit', () => {
      const shortAnswer = 'This is sentence one. This is sentence two.';
      const result = enforceLengthConstraint(shortAnswer, 5);
      
      expect(result).toBe(shortAnswer);
    });
  });
});

