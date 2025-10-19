/**
 * Strips email reply/forward prefixes from subject lines
 * Removes: Re:, RE:, Fwd:, FW:, FWD:, etc. (including multiple occurrences)
 */
export function cleanEmailSubject(subject: string): string {
  if (!subject) return "";
  
  // Remove all instances of Re:, Fwd:, and similar prefixes (case-insensitive)
  // This regex handles multiple prefixes like "Re: Fwd: Re: Subject"
  let cleaned = subject;
  let previousCleaned = "";
  
  // Keep looping until no more prefixes can be removed
  while (cleaned !== previousCleaned) {
    previousCleaned = cleaned;
    cleaned = cleaned.replace(/^\s*(Re|RE|Fwd|FWD|FW|Fw):\s*/i, '').trim();
  }
  
  return cleaned;
}

/**
 * Cleans email body by removing quoted content and preserving original formatting
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  let result = emailBody;
  let cutPosition = -1;

  // Pattern 1: Gmail-style "On <date> <name> wrote:" pattern (handles multi-line)
  // This can appear as:
  //   "On Mon, Oct 16, 2024 at 3:00 PM User <user@example.com> wrote:"
  // OR across two lines:
  //   "On Mon, Oct 16, 2024 at 3:00 PM User <user@example.com>
  //    wrote:"
  // We need to handle both cases
  const gmailQuotePattern = /(^|\n)\s*On\s+.+?(?:\r?\n\s*)?wrote:/im;
  const gmailQuoteMatch = result.match(gmailQuotePattern);
  if (gmailQuoteMatch && gmailQuoteMatch.index !== undefined) {
    const matchStart = gmailQuoteMatch[1] === '\n' ? gmailQuoteMatch.index + 1 : gmailQuoteMatch.index;
    console.log('[EmailClean] Found Gmail quote marker at position', matchStart);
    if (cutPosition === -1 || matchStart < cutPosition) {
      cutPosition = matchStart;
    }
  }
  
  // Fallback: Look for lines that start with "On " followed eventually by "wrote:" on the next line
  const lines = result.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim().match(/^On\s+.+/i) && lines[i + 1].trim().match(/^wrote:/i)) {
      const linePosition = result.split('\n').slice(0, i).join('\n').length;
      console.log('[EmailClean] Found multi-line Gmail quote at line', i);
      if (cutPosition === -1 || linePosition < cutPosition) {
        cutPosition = linePosition;
      }
      break;
    }
  }

  // Pattern 2: "Begin forwarded message" or "Forwarded message"
  const forwardedPattern = /(^|\n)\s*(Begin forwarded message|Forwarded message)/im;
  const forwardedMatch = result.match(forwardedPattern);
  if (forwardedMatch && forwardedMatch.index !== undefined) {
    const matchStart = forwardedMatch[1] === '\n' ? forwardedMatch.index + 1 : forwardedMatch.index;
    console.log('[EmailClean] Found forwarded message marker at position', matchStart);
    if (cutPosition === -1 || matchStart < cutPosition) {
      cutPosition = matchStart;
    }
  }

  // Pattern 3: Classic email header block (From:/Sent:/To:/Subject:)
  // Look for blank line followed by "From:" which typically starts forwarded content
  const headerBlockPattern = /\n\s*\n\s*From:\s*.+/im;
  const headerBlockMatch = result.match(headerBlockPattern);
  if (headerBlockMatch && headerBlockMatch.index !== undefined) {
    console.log('[EmailClean] Found header block at position', headerBlockMatch.index);
    if (cutPosition === -1 || headerBlockMatch.index < cutPosition) {
      cutPosition = headerBlockMatch.index;
    }
  }

  // Pattern 4: Outlook-style divider with "From:" header
  const outlookDividerMatch = result.match(/\n\s*_{10,}\s*\n\s*From:/im);
  if (outlookDividerMatch && outlookDividerMatch.index !== undefined) {
    if (cutPosition === -1 || outlookDividerMatch.index < cutPosition) {
      cutPosition = outlookDividerMatch.index;
    }
  }

  // Pattern 5: -----Original Message-----
  const originalMessageMatch = result.match(/\n\s*-+\s*Original Message\s*-+/im);
  if (originalMessageMatch && originalMessageMatch.index !== undefined) {
    if (cutPosition === -1 || originalMessageMatch.index < cutPosition) {
      cutPosition = originalMessageMatch.index;
    }
  }

  // Cut at the earliest detected quote/forward marker
  if (cutPosition !== -1) {
    console.log('[EmailClean] Cutting at position', cutPosition, '(original length:', emailBody.length, ')');
    result = result.substring(0, cutPosition);
  }

  // Remove lines starting with ">" (quoted text) - preserve other formatting
  result = result.split('\n').filter(line => !line.trimStart().startsWith('>')).join('\n');

  // Normalize Gmail line wrapping: Join lines that were wrapped by Gmail
  // Gmail typically wraps at ~72-76 characters
  const normalizedLines: string[] = [];
  const contentLines = result.split('\n');
  
  for (let i = 0; i < contentLines.length; i++) {
    const currentLine = contentLines[i];
    const nextLine = i < contentLines.length - 1 ? contentLines[i + 1] : null;
    
    // Check if this line was wrapped (not a natural paragraph break)
    // A wrapped line:
    // - Doesn't end with common sentence-ending punctuation
    // - Is followed by a line that doesn't start with whitespace (continuation)
    // - The line length suggests it might have been wrapped
    const endsWithPunctuation = /[.!?:]$/.test(currentLine.trim());
    const nextLineIsContinuation = nextLine && !nextLine.match(/^\s/) && nextLine.length > 0;
    const likelyWrapped = !endsWithPunctuation && nextLineIsContinuation && currentLine.trim().length > 40;
    
    if (likelyWrapped) {
      // Join with the next line (add a space if current doesn't end with space)
      const joiner = currentLine.endsWith(' ') ? '' : ' ';
      normalizedLines.push(currentLine + joiner);
    } else {
      normalizedLines.push(currentLine + '\n');
    }
  }
  
  result = normalizedLines.join('').trimEnd();

  console.log('[EmailClean] Final cleaned length:', result.length);
  console.log('[EmailClean] Preview:', result.substring(0, 100).replace(/\n/g, '\\n'));

  return result;
}
