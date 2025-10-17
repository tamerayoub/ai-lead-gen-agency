/**
 * Cleans email body by removing quoted/threaded content only
 * Preserves original formatting and line breaks
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  // Remove "On...wrote:" quoted sections and everything after
  // This handles Gmail/Outlook reply threading
  emailBody = emailBody.replace(/\n\s*On\s+.+?wrote:\s*\n[\s\S]*/gi, '');
  
  // Remove lines that start with ">" (quoted text)
  const lines = emailBody.split('\n');
  const cleanedLines: string[] = [];
  let inQuotedSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if we hit a quoted section
    if (trimmed.startsWith('>')) {
      inQuotedSection = true;
      continue;
    }
    
    // Stop processing if we hit "On...wrote:" pattern (case insensitive)
    if (/^On\s+.+?wrote:/i.test(trimmed)) {
      break;
    }
    
    // Stop if we hit forwarded email markers
    if (trimmed.startsWith('From:') && cleanedLines.length > 0) {
      break;
    }
    
    // If not in quoted section, keep the line
    if (!inQuotedSection) {
      cleanedLines.push(line);
    }
  }

  // Join and return, preserving original formatting
  return cleanedLines.join('\n').trim();
}
