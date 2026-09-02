import { describe, expect, it } from 'vitest';

import { formatDate, pluralize } from '../../src/lib/format';

describe('formatDate', () => {
  it('formats an ISO date as a long US date, timezone-independent', () => {
    expect(formatDate('2026-01-05')).toBe('January 5, 2026');
    expect(formatDate('2024-05-12')).toBe('May 12, 2024');
    expect(formatDate('2018-12-05')).toBe('December 5, 2018');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'note')).toBe('1 note');
    expect(pluralize(1, 'lecture note')).toBe('1 lecture note');
  });

  it('uses the plural otherwise', () => {
    expect(pluralize(0, 'note')).toBe('0 notes');
    expect(pluralize(4, 'note')).toBe('4 notes');
    expect(pluralize(2, 'lecture note')).toBe('2 lecture notes');
  });

  it('accepts an explicit plural', () => {
    expect(pluralize(3, 'index', 'indices')).toBe('3 indices');
  });
});
