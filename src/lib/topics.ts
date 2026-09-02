/**
 * Topic normalization and deduplication.
 *
 * Topics drive search and filtering. They must be trimmed, whitespace-collapsed,
 * and deduplicated case-insensitively while preserving the display casing of the
 * first occurrence. Ordering is preserved.
 */

/** Normalize a single topic string: trim + collapse internal whitespace. */
export function normalizeTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, ' ');
}

/** Key used for case-insensitive comparison and filter matching. */
export function topicKey(topic: string): string {
  return normalizeTopic(topic).toLowerCase();
}

/**
 * Normalize a list of topics and drop case-insensitive duplicates and blanks,
 * keeping the first-seen casing and order.
 */
export function normalizeTopics(topics: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of topics) {
    const normalized = normalizeTopic(raw);
    if (normalized.length === 0) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

/** Whether two topic strings refer to the same topic (case-insensitively). */
export function topicsMatch(a: string, b: string): boolean {
  return topicKey(a) === topicKey(b);
}
