/**
 * Cleans email body by removing quoted content and fixing line breaks
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  // First, try to remove quoted sections using a more robust approach
  // Look for "On...wrote:" pattern (can span multiple lines)
  // This pattern matches "On [date/time]..." followed by "wrote:" which may be on the next line
  emailBody = emailBody.replace(/\n\s*On\s+[\s\S]+?wrote:\s*\n[\s\S]*/gi, '');
  
  // Remove lines that start with ">" (quoted text)
  emailBody = emailBody.replace(/^>.*$/gm, '');
  
  // Remove email signature separators and everything after
  emailBody = emailBody.replace(/\n\s*-{2,}\s*\n[\s\S]*/g, '');
  
  // Remove "From:" forwarded email markers and everything after
  const lines = emailBody.split('\n');
  const cleanedLines: string[] = [];
  let hitForwardMarker = false;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    
    // Check for forward marker (but not if it's the first line)
    if (i > 0 && trimmedLine.startsWith('From:')) {
      hitForwardMarker = true;
    }
    
    if (hitForwardMarker) {
      break; // Stop adding lines
    }
    
    // Keep non-empty lines or preserve paragraph breaks
    if (trimmedLine.length > 0) {
      cleanedLines.push(lines[i]);
    } else if (cleanedLines.length > 0) {
      cleanedLines.push('');
    }
  }

  // Join lines and fix artificial line breaks
  // Gmail adds line breaks at ~76 chars for formatting, we need to join them back
  let result = cleanedLines.join('\n');

  // Fix artificial line breaks: If a line doesn't end with punctuation and the next line
  // doesn't start with whitespace/special chars, join them with a space
  result = result.replace(/([^\n.!?;:,])\n([^\s>-])/g, '$1 $2');

  // Clean up multiple consecutive spaces
  result = result.replace(/ {2,}/g, ' ');

  // Trim each line and remove multiple blank lines
  result = result
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n'); // Max 2 newlines (1 blank line)

  return result.trim();
}
