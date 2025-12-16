/**
 * Converts text to sentence case (first letter uppercase, rest lowercase)
 * Example: "HELLO WORLD" -> "Hello world"
 */
export function toSentenceCase(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Converts name to title case (first letter of each word uppercase)
 * Example: "JUAN CARLOS PÉREZ" -> "Juan Carlos Pérez"
 */
export function toTitleCase(text: string): string {
  if (!text) return text;
  return text
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a training title to sentence case
 */
export function formatTrainingTitle(title: string): string {
  return toSentenceCase(title);
}

/**
 * Formats a user's full name to title case
 */
export function formatUserName(name: string): string {
  return toTitleCase(name);
}
