import { describe, expect, it } from 'vitest';

import { COURSE, type CourseConfig } from '../../src/config/course';
import {
  assertCourseConfigValid,
  courseProgress,
  findCourseConfigProblems,
  getLecture,
  isValidLectureId,
  lectureNumberLabel,
  resolveLectures,
  watchedLectureCount,
} from '../../src/lib/course';

function courseWith(overrides: Partial<CourseConfig>): CourseConfig {
  return { ...COURSE, ...overrides };
}

describe('CS229 2018 course configuration', () => {
  it('is internally consistent', () => {
    expect(() => assertCourseConfigValid()).not.toThrow();
  });

  it('configures 20 lectures and a matching registry', () => {
    expect(COURSE.totalLectures).toBe(20);
    expect(COURSE.lectures).toHaveLength(20);
  });

  it('numbers lectures 1..20 in sequence with unique ids', () => {
    const ids = COURSE.lectures.map((l) => l.id);
    const sequences = COURSE.lectures.map((l) => l.sequence);
    expect(new Set(ids).size).toBe(20);
    expect(sequences).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('carries the verified course-level source links', () => {
    expect(COURSE.syllabusUrl).toBe('https://cs229.stanford.edu/syllabus-autumn2018.html');
    expect(COURSE.playlistUrl).toContain('list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU');
    expect(COURSE.syllabusUrl.startsWith('https://')).toBe(true);
    expect(COURSE.playlistUrl.startsWith('https://')).toBe(true);
  });

  it('uses the playlist video titles as public lecture titles', () => {
    expect(getLecture(1)?.title).toBe('Welcome');
    expect(getLecture(2)?.title).toBe('Linear Regression and Gradient Descent');
    expect(getLecture(4)?.title).toBe('Perceptron & Generalized Linear Model');
    expect(getLecture(16)?.title).toBe('Independent Component Analysis & Reinforcement Learning');
    expect(getLecture(20)?.title).toBe('Reinforcement Learning Debugging and Diagnostics');
  });

  it('gives every lecture a playlist sourceUrl with its video id and the playlist id', () => {
    for (const lecture of COURSE.lectures) {
      expect(lecture.sourceUrl).toBe(
        `https://www.youtube.com/watch?v=${lecture.videoId}&list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU`,
      );
    }
  });

  it('uses the verified video ids from the playlist', () => {
    expect(getLecture(1)?.videoId).toBe('jGwO_UgTS7I');
    expect(getLecture(7)?.videoId).toBe('8NYoQiRANpg');
    expect(getLecture(20)?.videoId).toBe('pLhPQynL0tY');
    expect(new Set(COURSE.lectures.map((l) => l.videoId)).size).toBe(20);
  });

  it('keeps the verified Autumn 2018 syllabus dates', () => {
    expect(getLecture(1)?.date).toBe('2018-09-24');
    expect(getLecture(20)?.date).toBe('2018-12-05');
  });
});

describe('watched-lecture tracking', () => {
  it('is initialized with lectures 1 and 2', () => {
    expect([...COURSE.watchedLectureIds]).toEqual([1, 2]);
  });

  it('derives the watched count from the id set', () => {
    expect(watchedLectureCount()).toBe(2);
  });

  it('reports progress as 2 of 20', () => {
    const progress = courseProgress();
    expect(progress).toMatchObject({ watched: 2, total: 20, percent: 10 });
    expect(progress.fraction).toBeCloseTo(0.1);
  });
});

describe('lecture id validation and lookup', () => {
  it('accepts every registry id', () => {
    for (let id = 1; id <= 20; id += 1) expect(isValidLectureId(id)).toBe(true);
  });

  it('rejects out-of-range, zero, negative, and non-integer ids', () => {
    expect(isValidLectureId(0)).toBe(false);
    expect(isValidLectureId(21)).toBe(false);
    expect(isValidLectureId(-1)).toBe(false);
    expect(isValidLectureId(3.5)).toBe(false);
  });

  it('resolves related lectures in course sequence and drops unknown ids', () => {
    const resolved = resolveLectures([4, 1, 999]);
    expect(resolved.map((l) => l.id)).toEqual([1, 4]);
  });

  it('zero-pads lecture numbers to the registry width', () => {
    expect(lectureNumberLabel(1)).toBe('01');
    expect(lectureNumberLabel(20)).toBe('20');
  });
});

describe('course-config integrity checker', () => {
  it('passes the real configuration', () => {
    expect(findCourseConfigProblems(COURSE)).toEqual([]);
    expect(() => assertCourseConfigValid(COURSE)).not.toThrow();
  });

  it('flags a lecture count that disagrees with totalLectures', () => {
    const bad = courseWith({ totalLectures: 19 });
    expect(findCourseConfigProblems(bad).join('\n')).toMatch(/totalLectures is 19/);
    expect(() => assertCourseConfigValid(bad)).toThrow();
  });

  it('flags duplicate lecture ids', () => {
    const lectures = [...COURSE.lectures];
    lectures[1] = { ...lectures[1]!, id: 1 };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(
      /duplicate lecture id 1/,
    );
  });

  it('flags out-of-order sequence numbers', () => {
    const lectures = [...COURSE.lectures];
    lectures[2] = { ...lectures[2]!, sequence: 9 };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(
      /sequence 9 but is at position 3/,
    );
  });

  it('flags watched ids that are not in the registry', () => {
    expect(findCourseConfigProblems(courseWith({ watchedLectureIds: [1, 99] })).join('\n')).toMatch(
      /unknown lecture id 99/,
    );
  });

  it('flags an empty lecture title', () => {
    const lectures = [...COURSE.lectures];
    lectures[0] = { ...lectures[0]!, title: '   ' };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(/empty title/);
  });

  it('flags a missing video id', () => {
    const lectures = [...COURSE.lectures];
    lectures[0] = { ...lectures[0]!, videoId: '' };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(/empty videoId/);
  });

  it('flags a sourceUrl that does not match its video id', () => {
    const lectures = [...COURSE.lectures];
    lectures[0] = { ...lectures[0]!, sourceUrl: 'https://www.youtube.com/watch?v=wrong&list=x' };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(
      /malformed playlist sourceUrl/,
    );
  });

  it('flags a duplicate video id', () => {
    const lectures = [...COURSE.lectures];
    lectures[1] = { ...lectures[1]!, videoId: lectures[0]!.videoId };
    expect(findCourseConfigProblems(courseWith({ lectures })).join('\n')).toMatch(
      /duplicate lecture videoId/,
    );
  });
});
