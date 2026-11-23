import { describe, it, expect } from 'vitest';
import { LABEL_STYLES, NIGHTSHIFT_LABELS } from './styles';

describe('NIGHTSHIFT_LABELS', () => {
  it('lists the eight labels of the night-shift contract', () => {
    expect([...NIGHTSHIFT_LABELS].sort()).toEqual([
      'night:blocked',
      'night:done',
      'night:ready',
      'night:running',
      'proposed',
      'src:human',
      'src:researcher',
      'src:smellfix',
    ]);
  });

  // LABEL_STYLES is checked directly because getLabelStyle falls back to a
  // default style and would hide a missing entry.
  it.each(NIGHTSHIFT_LABELS)('%s has its own style entry', (label) => {
    expect(Object.hasOwn(LABEL_STYLES, label)).toBe(true);
    const style = LABEL_STYLES[label];
    expect(style.bg).toBeTruthy();
    expect(style.fg).toBeTruthy();
    expect(style.ghColor).toMatch(/^[0-9A-F]{6}$/i);
  });

  it('gives each label a ghColor that no other label uses', () => {
    const all = Object.values(LABEL_STYLES).map((s) => s.ghColor.toUpperCase());
    for (const label of NIGHTSHIFT_LABELS) {
      const color = LABEL_STYLES[label].ghColor.toUpperCase();
      expect(all.filter((c) => c === color)).toHaveLength(1);
    }
  });

  it('gives each label a distinct pill colour pair', () => {
    const pairs = NIGHTSHIFT_LABELS.map(
      (label) => `${LABEL_STYLES[label].bg} ${LABEL_STYLES[label].fg}`,
    );
    expect(new Set(pairs).size).toBe(NIGHTSHIFT_LABELS.length);
  });
});
