/**
 * Derived course helpers: lecture lookup, ID validation, and progress.
 *
 * `assertCourseConfigValid()` runs once when this module loads so a malformed
 * registry fails fast in dev, tests, `astro check`, and the production build.
 */

import { COURSE, type CourseConfig, type LectureRegistryEntry } from '../config/course';

/** Map of lecture id → entry, built once. */
const LECTURE_BY_ID: ReadonlyMap<number, LectureRegistryEntry> = new Map(
  COURSE.lectures.map((lecture) => [lecture.id, lecture]),
);

export function getLecture(id: number): LectureRegistryEntry | undefined {
  return LECTURE_BY_ID.get(id);
}

/** Whether `id` refers to a lecture that exists in the configured registry. */
export function isValidLectureId(id: number): boolean {
  return Number.isInteger(id) && LECTURE_BY_ID.has(id);
}

/**
 * Resolve a note's `relatedLectures` to registry entries, in course sequence.
 * Unknown IDs are dropped by callers only after schema validation has already
 * rejected them; this helper simply skips anything unresolved.
 */
export function resolveLectures(ids: readonly number[]): LectureRegistryEntry[] {
  return ids
    .map((id) => LECTURE_BY_ID.get(id))
    .filter((entry): entry is LectureRegistryEntry => entry !== undefined)
    .sort((a, b) => a.sequence - b.sequence);
}

/** Zero-padded lecture number, e.g. `1` → `"01"` (width follows the registry size). */
export function lectureNumberLabel(id: number): string {
  const width = String(COURSE.totalLectures).length;
  return String(id).padStart(width, '0');
}

/** Deduplicated count of watched lectures. */
export function watchedLectureCount(): number {
  return new Set(COURSE.watchedLectureIds).size;
}

export interface CourseProgress {
  readonly watched: number;
  readonly total: number;
  /** `watched / total`, clamped to [0, 1]. */
  readonly fraction: number;
  /** Whole-number percentage, rounded. */
  readonly percent: number;
}

export function courseProgress(): CourseProgress {
  const total = COURSE.totalLectures;
  const watched = Math.min(watchedLectureCount(), total);
  const fraction = total > 0 ? watched / total : 0;
  return { watched, total, fraction, percent: Math.round(fraction * 100) };
}

/** Collect every internal-consistency problem with a course configuration. */
export function findCourseConfigProblems(config: CourseConfig = COURSE): string[] {
  const problems: string[] = [];
  const { lectures, totalLectures, watchedLectureIds } = config;

  if (!Number.isInteger(totalLectures) || totalLectures <= 0) {
    problems.push(`totalLectures must be a positive integer (got ${totalLectures}).`);
  }
  if (lectures.length !== totalLectures) {
    problems.push(
      `lectures registry has ${lectures.length} entries but totalLectures is ${totalLectures}.`,
    );
  }

  const seenIds = new Set<number>();
  const seenSequences = new Set<number>();
  lectures.forEach((lecture, index) => {
    if (!Number.isInteger(lecture.id) || lecture.id <= 0) {
      problems.push(`lecture at index ${index} has a non-positive id (${lecture.id}).`);
    }
    if (seenIds.has(lecture.id)) problems.push(`duplicate lecture id ${lecture.id}.`);
    seenIds.add(lecture.id);

    if (seenSequences.has(lecture.sequence)) {
      problems.push(`duplicate lecture sequence ${lecture.sequence}.`);
    }
    seenSequences.add(lecture.sequence);

    if (lecture.sequence !== index + 1) {
      problems.push(
        `lecture id ${lecture.id} has sequence ${lecture.sequence} but is at position ${index + 1}.`,
      );
    }
    if (lecture.title.trim().length === 0) {
      problems.push(`lecture id ${lecture.id} has an empty title.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lecture.date) || Number.isNaN(Date.parse(lecture.date))) {
      problems.push(`lecture id ${lecture.id} has an invalid date (${lecture.date}).`);
    }
    if (!lecture.videoId || lecture.videoId.trim().length === 0) {
      problems.push(`lecture id ${lecture.id} has an empty videoId.`);
    }
    if (
      !lecture.sourceUrl.startsWith('https://www.youtube.com/watch?v=') ||
      !lecture.sourceUrl.includes(lecture.videoId) ||
      !lecture.sourceUrl.includes('list=')
    ) {
      problems.push(`lecture id ${lecture.id} has a malformed playlist sourceUrl.`);
    }
  });

  const seenVideoIds = new Set<string>();
  for (const lecture of lectures) {
    if (seenVideoIds.has(lecture.videoId)) {
      problems.push(`duplicate lecture videoId ${lecture.videoId}.`);
    }
    seenVideoIds.add(lecture.videoId);
  }

  for (const id of watchedLectureIds) {
    if (!seenIds.has(id)) {
      problems.push(`watchedLectureIds references unknown lecture id ${id}.`);
    }
  }

  return problems;
}

/**
 * Validate the course configuration's internal consistency. Throws on any
 * violation. Called at module load so a malformed registry fails fast.
 */
export function assertCourseConfigValid(config: CourseConfig = COURSE): void {
  const problems = findCourseConfigProblems(config);
  if (problems.length > 0) {
    throw new Error(`Invalid CS229 course configuration:\n- ${problems.join('\n- ')}`);
  }
}

assertCourseConfigValid();
