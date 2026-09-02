/**
 * Typed configuration for the public 2018 Stanford CS229 lecture series.
 *
 * This project follows the official "Stanford CS229: Machine Learning — Autumn
 * 2018" YouTube playlist:
 *   https://www.youtube.com/playlist?list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU
 *
 * The lecture registry uses the playlist's own video titles as the public
 * `title` values, and each `sourceUrl` is that video watched within the
 * playlist. Session `date` values are the verified Autumn 2018 syllabus dates
 * (https://cs229.stanford.edu/syllabus-autumn2018.html). No lecture information
 * is invented.
 *
 * The playlist contains one extra video beyond Lectures 1–20; it is not part of
 * the numbered series and does not affect `totalLectures`.
 *
 * `watchedLectureIds` is maintained by hand. The displayed "watched" count is
 * derived from it (deduplicated); do not store a separate integer.
 *
 * Visible lecture numbers on notes come from a note's `relatedLectures` resolved
 * through this registry — never from a note's `courseOrder`.
 */

const PLAYLIST_ID = 'PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU';

/** A CS229-2018 playlist video, watched in-playlist. */
export function playlistVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}&list=${PLAYLIST_ID}`;
}

export interface LectureRegistryEntry {
  /** Stable identifier. For the 2018 edition this equals the lecture number. */
  readonly id: number;
  /** Position in the official course sequence (1-based). */
  readonly sequence: number;
  /** Public lecture title — the playlist video title. */
  readonly title: string;
  /** Session date in the 2018 offering (ISO `YYYY-MM-DD`), from the syllabus. */
  readonly date: string;
  /** YouTube video id for this lecture in the course playlist. */
  readonly videoId: string;
  /** Canonical public source: the playlist video. */
  readonly sourceUrl: string;
}

/** `[id, playlist title, syllabus date, videoId]` for lectures 1–20. */
const LECTURE_ROWS: ReadonlyArray<readonly [number, string, string, string]> = [
  [1, 'Welcome', '2018-09-24', 'jGwO_UgTS7I'],
  [2, 'Linear Regression and Gradient Descent', '2018-09-26', '4b4MUYve_U8'],
  [3, 'Locally Weighted & Logistic Regression', '2018-10-01', 'het9HFqo1TQ'],
  [4, 'Perceptron & Generalized Linear Model', '2018-10-03', 'iZTeva0WSTQ'],
  [5, 'GDA & Naive Bayes', '2018-10-08', 'nt63k3bfXS0'],
  [6, 'Support Vector Machines', '2018-10-10', 'lDwow4aOrtg'],
  [7, 'Kernels', '2018-10-15', '8NYoQiRANpg'],
  [8, 'Data Splits, Models & Cross-Validation', '2018-10-17', 'rjbkWSTjHzM'],
  [9, 'Approximation/Estimation Error & ERM', '2018-10-22', 'iVOxMcumR4A'],
  [10, 'Decision Trees and Ensemble Methods', '2018-10-24', 'wr9gUr-eWdA'],
  [11, 'Introduction to Neural Networks', '2018-10-29', 'MfIjxPh6Pys'],
  [12, 'Backpropagation & Improving Neural Networks', '2018-10-31', 'zUazLXZZA2U'],
  [13, 'Debugging ML Models and Error Analysis', '2018-11-05', 'ORrStCArmP4'],
  [14, 'Expectation-Maximization Algorithms', '2018-11-07', 'rVfZHWTwXSA'],
  [15, 'EM Algorithm & Factor Analysis', '2018-11-12', 'tw6cmL5STuY'],
  [16, 'Independent Component Analysis & Reinforcement Learning', '2018-11-14', 'YQA9lLdLig8'],
  [17, 'MDPs & Value/Policy Iteration', '2018-11-26', 'd5gaWTo6kDM'],
  [18, 'Continuous-State MDPs & Model Simulation', '2018-11-28', 'QFu5nuc-S0s'],
  [19, 'Reward Models & Linear Dynamical Systems', '2018-12-03', '0rt2CsEQv6U'],
  [20, 'Reinforcement Learning Debugging and Diagnostics', '2018-12-05', 'pLhPQynL0tY'],
] as const;

const LECTURES: readonly LectureRegistryEntry[] = LECTURE_ROWS.map(
  ([id, title, date, videoId]) => ({
    id,
    sequence: id,
    title,
    date,
    videoId,
    sourceUrl: playlistVideoUrl(videoId),
  }),
);

export interface CourseConfig {
  readonly name: string;
  readonly shortName: string;
  /** Machine-friendly edition key. */
  readonly edition: string;
  /** Human label for the edition. */
  readonly editionLabel: string;
  /** Named factually for attribution only. No logos, no implied endorsement. */
  readonly institution: string;
  readonly syllabusUrl: string;
  readonly playlistUrl: string;
  /** Configured total number of lectures in this edition. */
  readonly totalLectures: number;
  /** Hand-maintained set of watched lecture IDs. Order and duplicates do not matter. */
  readonly watchedLectureIds: readonly number[];
  readonly lectures: readonly LectureRegistryEntry[];
}

export const COURSE: CourseConfig = {
  name: 'CS229: Machine Learning',
  shortName: 'CS229',
  edition: '2018',
  editionLabel: 'Autumn 2018',
  institution: 'Stanford University',
  syllabusUrl: 'https://cs229.stanford.edu/syllabus-autumn2018.html',
  playlistUrl: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
  totalLectures: 20,
  watchedLectureIds: [1, 2],
  lectures: LECTURES,
} as const;
