/**
 * Tests for acquisition attribution normalization
 */
import { describe, it, expect } from "vitest";
import { normalizeAcquisitionContext } from "../acquisition";

describe("normalizeAcquisitionContext", () => {
  it("should set offer to 'unknown' when offer is invalid", () => {
    const result = normalizeAcquisitionContext({
      offer: "invalid_offer_xyz",
      source: "google",
      landing_page: "/some-page",
    });
    expect(result).not.toBeNull();
    expect(result!.initialOffer).toBe("unknown");
  });

  it("should accept valid offer fb_marketplace_ai_leasing_agent", () => {
    const result = normalizeAcquisitionContext({
      offer: "fb_marketplace_ai_leasing_agent",
      source: "email",
      landing_page: "/fb-ai-leasing-agent",
    });
    expect(result).not.toBeNull();
    expect(result!.initialOffer).toBe("fb_marketplace_ai_leasing_agent");
  });

  it("should accept valid offer facebook_marketplace_integration", () => {
    const result = normalizeAcquisitionContext({
      offer: "facebook_marketplace_integration",
      source: "facebook",
      landing_page: "/fb-integration",
    });
    expect(result).not.toBeNull();
    expect(result!.initialOffer).toBe("facebook_marketplace_integration");
  });

  it("should use fallback UTMs when context is empty", () => {
    const result = normalizeAcquisitionContext(
      null,
      {
        source: "email",
        medium: "outbound",
        campaign: "fb_ai_leasing_agent",
        content: "hero_cta",
      },
      "/fb-ai-leasing-agent"
    );
    expect(result).not.toBeNull();
    expect(result!.utmSource).toBe("email");
    expect(result!.utmMedium).toBe("outbound");
    expect(result!.utmCampaign).toBe("fb_ai_leasing_agent");
    expect(result!.landingPage).toBe("/fb-ai-leasing-agent");
  });

  it("should default source to 'direct' when no source provided", () => {
    const result = normalizeAcquisitionContext({
      offer: "fb_marketplace_ai_leasing_agent",
      landing_page: "/fb-ai-leasing-agent",
    });
    expect(result).not.toBeNull();
    expect(result!.utmSource).toBe("direct");
  });

  it("should trim and limit string lengths", () => {
    const long = "a".repeat(300);
    const result = normalizeAcquisitionContext({
      offer: "fb_marketplace_ai_leasing_agent",
      source: "  trimmed  ",
      campaign: long,
      landing_page: "/fb-ai-leasing-agent",
    });
    expect(result).not.toBeNull();
    expect(result!.utmSource).toBe("trimmed");
    expect(result!.utmCampaign!.length).toBeLessThanOrEqual(200);
  });

  it("should handle completely empty input with defaults", () => {
    const result = normalizeAcquisitionContext(null);
    expect(result).not.toBeNull();
    expect(result!.initialOffer).toBe("unknown");
    expect(result!.utmSource).toBe("direct");
  });

  it("should not overwrite existing - backend stores only when initialOffer is null", () => {
    // This documents the contract: callers must check user.initialOffer before persisting
    const validCtx = {
      offer: "fb_marketplace_ai_leasing_agent",
      source: "email",
      landing_page: "/fb-ai-leasing-agent",
    };
    const result = normalizeAcquisitionContext(validCtx);
    expect(result!.initialOffer).toBe("fb_marketplace_ai_leasing_agent");
  });
});
