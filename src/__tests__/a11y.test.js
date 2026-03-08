import { describe, it, expect } from 'vitest';
import { cellLabel, srOnly } from '../lib/a11y';

describe('cellLabel', () => {
  it('generates label for empty cell', () => {
    expect(cellLabel(0, 0, null)).toBe('Row 1, Column 1, empty');
  });

  it('generates label for X cell', () => {
    expect(cellLabel(1, 2, 'X')).toBe('Row 2, Column 3, X');
  });

  it('generates label for O cell', () => {
    expect(cellLabel(2, 0, 'O')).toBe('Row 3, Column 1, O');
  });

  it('includes context when provided', () => {
    expect(cellLabel(0, 1, null, 'Board 5')).toBe('Board 5, Row 1, Column 2, empty');
  });

  it('includes context with value', () => {
    expect(cellLabel(1, 1, 'X', 'Board 3')).toBe('Board 3, Row 2, Column 2, X');
  });
});

describe('srOnly', () => {
  it('is a valid style object', () => {
    expect(srOnly).toHaveProperty('position', 'absolute');
    expect(srOnly).toHaveProperty('width', 1);
    expect(srOnly).toHaveProperty('height', 1);
    expect(srOnly).toHaveProperty('overflow', 'hidden');
  });
});
