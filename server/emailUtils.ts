/**
 * Cleans email body by removing quoted content and preserving original formatting
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  let result = emailBody;
  
  // CRITICAL: Find where the quoted/previous content starts and cut everything after
  // Pattern 1: Gmail-style "On <date> <name> wrote:" pattern
  // Look for this pattern and remove everything from that point onward
  // Example: "On Mon, Oct 16, 2024 at 3:00 PM User <user@example.com> wrote:"
  const gmailQuoteMatch = result.match(/\n\s*On\s+.+?wrote:/im);
  if (gmailQuoteMatch && gmailQuoteMatch.index !== undefined) {
    console.log('[EmailClean] Found Gmail quote marker at position', gmailQuoteMatch.index);
    console.log('[EmailClean] Original length:', emailBody.length, 'Cleaned length:', gmailQuoteMatch.index);
    result = result.substring(0, gmailQuoteMatch.index);
  }
  
  // Pattern 2: Outlook-style divider with "From:" header
  // Common formats:
  // ________________________________
  // From: Name <email>
  // OR
  // -----Original Message-----
  const outlookDividerMatch = result.match(/\n\s*_{10,}\s*\n\s*From:/im);
  if (outlookDividerMatch && outlookDividerMatch.index !== undefined) {
    result = result.substring(0, outlookDividerMatch.index);
  }
  
  const originalMessageMatch = result.match(/\n\s*-+\s*Original Message\s*-+/im);
  if (originalMessageMatch && originalMessageMatch.index !== undefined) {
    result = result.substring(0, originalMessageMatch.index);
  }
  
  // Pattern 3: Lines starting with ">" (quoted text) - remove these lines
  result = result.replace(/^>.*$/gm, '');
  
  // Pattern 4: Email signature separator (-- or ----)
  result = result.replace(/\n\s*-{2,}\s*$/m, '');
  
  // Clean up excessive whitespace while preserving intentional line breaks
  // Remove more than 2 consecutive newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Remove trailing/leading whitespace from each line
  result = result.split('\n').map(line => line.trimEnd()).join('\n');
  
  // Clean up multiple spaces within lines
  result = result.replace(/ {2,}/g, ' ');

  return result.trim();
}
