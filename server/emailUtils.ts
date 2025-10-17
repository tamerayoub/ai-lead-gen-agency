/**
 * Cleans email body by removing quoted content while preserving exact formatting
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  // Remove "On...wrote:" quoted sections - match the entire pattern including the quoted content after it
  // This pattern looks for "On " followed by any text including newlines, then "wrote:" and removes everything after
  emailBody = emailBody.replace(/\n\s*On\s+.+?wrote:\s*[\s\S]*/gi, '');
  
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
    
    // Preserve all lines exactly as they are (including empty lines)
    cleanedLines.push(lines[i]);
  }

  // Join lines preserving exact formatting
  let result = cleanedLines.join('\n');

  // Remove multiple blank lines (more than 2 consecutive newlines)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
