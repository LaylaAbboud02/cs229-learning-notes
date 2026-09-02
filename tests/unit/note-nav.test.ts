import { describe, expect, it } from 'vitest';

import { adjacentNotes } from '../../src/lib/notes';

interface Stub {
  slug: string;
  courseOrder: number;
  title: string;
}

const notes: Stub[] = [
  { slug: 'c', courseOrder: 30, title: 'C' },
  { slug: 'a', courseOrder: 10, title: 'A' },
  { slug: 'b', courseOrder: 20, title: 'B' },
];

describe('adjacentNotes (previous / next note by course order)', () => {
  it('returns the neighbours around a middle note', () => {
    const { prev, next } = adjacentNotes(notes, 'b');
    expect(prev?.slug).toBe('a');
    expect(next?.slug).toBe('c');
  });

  it('has no previous for the first note and no next for the last', () => {
    expect(adjacentNotes(notes, 'a').prev).toBeUndefined();
    expect(adjacentNotes(notes, 'a').next?.slug).toBe('b');
    expect(adjacentNotes(notes, 'c').next).toBeUndefined();
    expect(adjacentNotes(notes, 'c').prev?.slug).toBe('b');
  });

  it('returns nothing for an unknown slug', () => {
    expect(adjacentNotes(notes, 'missing')).toEqual({});
  });

  it('a single note has no neighbours', () => {
    expect(adjacentNotes([{ slug: 'only', courseOrder: 10, title: 'Only' }], 'only')).toEqual({});
  });

  it('does not depend on input order (sorts by course order first)', () => {
    const shuffled = [notes[2]!, notes[0]!, notes[1]!];
    const { prev, next } = adjacentNotes(shuffled, 'b');
    expect(prev?.slug).toBe('a');
    expect(next?.slug).toBe('c');
  });
});
