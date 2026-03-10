/**
 * Generate a descriptive cell label for screen readers.
 * @param {number} row - 0-indexed row
 * @param {number} col - 0-indexed column
 * @param {string|null} value - 'X', 'O', or null
 * @param {string} [context] - optional context like "Board 3"
 * @returns {string} aria-label string
 */
export function cellLabel(row, col, value, context) {
  const pos = `Row ${row + 1}, Column ${col + 1}`;
  const val = value ? value : 'empty';
  return context ? `${context}, ${pos}, ${val}` : `${pos}, ${val}`;
}

/**
 * Visually hidden style for screen-reader-only content.
 */
export const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
};
