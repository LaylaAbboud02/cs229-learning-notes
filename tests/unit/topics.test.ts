import { describe, expect, it } from 'vitest';

import { normalizeTopic, normalizeTopics, topicKey, topicsMatch } from '../../src/lib/topics';

describe('topic normalization', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeTopic('  Linear   Regression  ')).toBe('Linear Regression');
  });

  it('builds a case-insensitive key', () => {
    expect(topicKey('  Support  Vector Machines ')).toBe('support vector machines');
  });
});

describe('normalizeTopics', () => {
  it('removes case-insensitive duplicates, keeping first-seen casing and order', () => {
    expect(
      normalizeTopics(['Supervised Learning', 'supervised learning', 'SVMs', 'svms', 'Kernels']),
    ).toEqual(['Supervised Learning', 'SVMs', 'Kernels']);
  });

  it('drops blank and whitespace-only entries', () => {
    expect(normalizeTopics(['Linear Regression', '   ', '', 'Least Squares'])).toEqual([
      'Linear Regression',
      'Least Squares',
    ]);
  });

  it('collapses whitespace differences into one topic', () => {
    expect(normalizeTopics(['Neural  Networks', 'Neural Networks'])).toEqual(['Neural Networks']);
  });

  it('is idempotent', () => {
    const once = normalizeTopics(['A', 'a', ' B ']);
    expect(normalizeTopics(once)).toEqual(once);
  });
});

describe('topicsMatch', () => {
  it('compares case- and whitespace-insensitively', () => {
    expect(topicsMatch('Linear Regression', 'linear regression')).toBe(true);
    expect(topicsMatch(' Kernels ', 'Kernels')).toBe(true);
    expect(topicsMatch('Kernels', 'SVM')).toBe(false);
  });
});
