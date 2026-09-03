import { describe, expect, it } from 'vitest';

import {
  isCourseOrderAvailable,
  suggestCourseOrder,
} from '../../../src/lib/publishing/course-order';

describe('suggestCourseOrder', () => {
  it('suggests the first increment when there are no notes', () => {
    expect(suggestCourseOrder([])).toBe(10);
  });

  it('suggests the next free multiple of ten above the current maximum', () => {
    expect(suggestCourseOrder([10, 20, 30])).toBe(40);
    expect(suggestCourseOrder([10, 25])).toBe(30);
    expect(suggestCourseOrder([100])).toBe(110);
  });

  it('ignores ordering of the input', () => {
    expect(suggestCourseOrder([30, 10, 20])).toBe(40);
  });
});

describe('isCourseOrderAvailable', () => {
  it('is false for a value already in use', () => {
    expect(isCourseOrderAvailable(20, [10, 20, 30])).toBe(false);
  });

  it('is true for an unused positive integer', () => {
    expect(isCourseOrderAvailable(15, [10, 20, 30])).toBe(true);
  });

  it('rejects non-positive or non-integer values', () => {
    expect(isCourseOrderAvailable(0, [])).toBe(false);
    expect(isCourseOrderAvailable(-10, [])).toBe(false);
    expect(isCourseOrderAvailable(12.5, [])).toBe(false);
  });
});
