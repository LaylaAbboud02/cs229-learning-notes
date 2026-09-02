/**
 * Serialize a validated `NoteRecord` to its `src/content/notes/<slug>.md` form.
 *
 * The frontmatter key order is fixed and matches the documented content model,
 * so generated files read predictably and diffs stay small. The slug is never
 * written into frontmatter — it is the file name.
 */

import matter from 'gray-matter';

import type { NoteRecord } from '../note-schema';

/** Ordered frontmatter for a note file (everything except the slug). */
function orderedFrontmatter(record: NoteRecord): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: record.title,
    type: record.type,
    description: record.description,
    courseOrder: record.courseOrder,
  };
  if (record.relatedLectures && record.relatedLectures.length > 0) {
    data.relatedLectures = [...record.relatedLectures];
  }
  data.topics = [...record.topics];
  if (record.sources && record.sources.length > 0) {
    data.sources = record.sources.map((s) => ({ label: s.label, url: s.url }));
  }
  if (record.writtenAt) data.writtenAt = record.writtenAt;
  data.publishedAt = record.publishedAt;
  if (record.updatedAt) data.updatedAt = record.updatedAt;
  data.pdfPath = record.pdfPath;
  data.thumbnailPath = record.thumbnailPath;
  data.pageCount = record.pageCount;
  data.fileSizeBytes = record.fileSizeBytes;
  data.featured = record.featured;
  return data;
}

/**
 * Render the Markdown file content for a note. The body is intentionally empty:
 * version one carries all information in frontmatter.
 */
export function serializeNoteMarkdown(record: NoteRecord): string {
  const yaml = matter.stringify('', orderedFrontmatter(record));
  return yaml.endsWith('\n') ? yaml : `${yaml}\n`;
}
