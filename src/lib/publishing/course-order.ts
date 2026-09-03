/**
 * `courseOrder` suggestion and availability checks.
 *
 * `courseOrder` is the global ordering key across every note type. Version one
 * spaces entries by ten so a later note can be slotted between two existing ones
 * without renumbering.
 */

import { COURSE_ORDER_INCREMENT } from './constants';

/**
 * The next suggested `courseOrder`: the first multiple of the increment strictly
 * greater than the current maximum (or the increment itself when there are no
 * notes yet).
 */
export function suggestCourseOrder(
  existing: readonly number[],
  increment: number = COURSE_ORDER_INCREMENT,
): number {
  if (existing.length === 0) return increment;
  const max = Math.max(...existing);
  return Math.floor(max / increment) * increment + increment;
}

/** Whether `value` is a positive integer not already taken by another note. */
export function isCourseOrderAvailable(value: number, existing: readonly number[]): boolean {
  if (!Number.isInteger(value) || value <= 0) return false;
  return !existing.includes(value);
}
