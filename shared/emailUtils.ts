/**
 * Email utility functions shared between frontend and backend
 */

/**
 * Normalize email subject by removing reply/forward prefixes
 * 
 * Strips common prefixes including:
 * - Reply: "Re:", "RE:", etc.
 * - Forward: "Fwd:", "FWD:", "FW:", etc.
 * - International: "Aw:" (German), "Sv:" (Swedish), etc.
 * 
 * Handles multiple nested prefixes: "Re: Re: Fwd: Hi" → "Hi"
 * 
 * @param subject - The email subject to normalize
 * @returns The normalized subject with prefixes removed
 */
export function normalizeEmailSubject(subject: string): string {
  if (!subject) return '';
  
  let normalized = subject.trim();
  
  // Keep removing prefixes until none are found
  // This handles cases like "Re: Re: Fwd: FW: Hi"
  let changed = true;
  while (changed) {
    const before = normalized;
    
    // Remove all reply prefix variations:
    // Re:, RE:, re: (English)
    // Aw: (German - Antwort)
    // Sv: (Swedish - Svar)
    // Vs: (Finnish - Vastaus)
    // Rif: (Italian - Riferimento)
    normalized = normalized.replace(/^(re|RE|Re|aw|AW|Aw|sv|SV|Sv|vs|VS|Vs|rif|RIF|Rif):\s*/i, '');
    
    // Remove all forward prefix variations:
    // Fwd:, FWD:, fwd:, Forward:, FORWARD:
    // FW:, Fw:, fw: (common short form)
    // Wg: (German - Weitergeleitet)
    // Doorst: (Dutch - Doorgestuurd)
    normalized = normalized.replace(/^(fwd|FWD|Fwd|fw|FW|Fw|forward|Forward|FORWARD|wg|WG|Wg|doorst|Doorst|DOORST):\s*/i, '');
    
    // Check if we made any changes
    changed = (before !== normalized);
  }
  
  return normalized.trim();
}
