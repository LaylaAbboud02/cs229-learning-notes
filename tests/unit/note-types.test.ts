import { describe, expect, it } from 'vitest';

import {
  NOTE_TYPES,
  NOTE_TYPE_CONFIG,
  NOTE_TYPE_LIST,
  isNoteType,
  noteTypeConfig,
} from '../../src/config/note-types';

describe('controlled note-type registry', () => {
  it('has exactly the two initial types', () => {
    expect([...NOTE_TYPES]).toEqual(['lecture', 'exercise']);
  });

  it('provides config for each type with matching asset directories', () => {
    expect(NOTE_TYPE_CONFIG.lecture.assetDir).toBe('lectures');
    expect(NOTE_TYPE_CONFIG.exercise.assetDir).toBe('exercises');
    expect(NOTE_TYPE_CONFIG.lecture.route).toBe('/lectures');
    expect(NOTE_TYPE_CONFIG.exercise.route).toBe('/exercises');
  });

  it('keeps routes base-independent (no repo prefix baked in)', () => {
    for (const config of NOTE_TYPE_LIST) {
      expect(config.route.startsWith('/')).toBe(true);
      expect(config.route).not.toContain('cs229-learning-notes');
    }
  });

  it('lists configs in registry order', () => {
    expect(NOTE_TYPE_LIST.map((c) => c.type)).toEqual(['lecture', 'exercise']);
  });

  it('narrows unknown values with isNoteType', () => {
    expect(isNoteType('lecture')).toBe(true);
    expect(isNoteType('exercise')).toBe(true);
    expect(isNoteType('cheatsheet')).toBe(false);
    expect(isNoteType('formula-sheet')).toBe(false);
    expect(isNoteType(undefined)).toBe(false);
    expect(isNoteType(2)).toBe(false);
  });

  it('noteTypeConfig returns the same object as the record', () => {
    expect(noteTypeConfig('lecture')).toBe(NOTE_TYPE_CONFIG.lecture);
  });
});
