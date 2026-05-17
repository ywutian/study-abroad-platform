import { describe, expect, it } from 'vitest';
import { parseMatchTitle } from './utils';

describe('parseMatchTitle', () => {
  it('parses the canonical "context · teamA × teamB" shape', () => {
    const r = parseMatchTitle(
      'Regeneron STS / Innovation Track · Science Fair Innovators × 全栈开发组'
    );
    expect(r).toEqual({
      title: 'Regeneron STS / Innovation Track · Science Fair Innovators × 全栈开发组',
      context: 'Regeneron STS / Innovation Track',
      teamA: 'Science Fair Innovators',
      teamB: '全栈开发组',
    });
  });

  it('parses "teamA × teamB" without a context prefix', () => {
    const r = parseMatchTitle('Team Alpha × Team Beta');
    expect(r.context).toBeNull();
    expect(r.teamA).toBe('Team Alpha');
    expect(r.teamB).toBe('Team Beta');
  });

  it('tolerates ASCII "x" as versus separator', () => {
    const r = parseMatchTitle('Hackathon · Red x Blue');
    expect(r.context).toBe('Hackathon');
    expect(r.teamA).toBe('Red');
    expect(r.teamB).toBe('Blue');
  });

  it('tolerates bullet "•" as context separator', () => {
    const r = parseMatchTitle('Spring • A × B');
    expect(r.context).toBe('Spring');
    expect(r.teamA).toBe('A');
    expect(r.teamB).toBe('B');
  });

  it('keeps full title when shape does not match (no × at all)', () => {
    const r = parseMatchTitle('Just a plain group name');
    expect(r.title).toBe('Just a plain group name');
    expect(r.teamA).toBeNull();
    expect(r.teamB).toBeNull();
  });

  it('keeps full title when there are 3+ teams (ambiguous)', () => {
    const r = parseMatchTitle('A × B × C');
    expect(r.teamA).toBeNull();
    expect(r.teamB).toBeNull();
  });

  it('handles empty / null / undefined', () => {
    expect(parseMatchTitle(null).title).toBe('');
    expect(parseMatchTitle(undefined).teamA).toBeNull();
    expect(parseMatchTitle('').context).toBeNull();
  });

  it('trims whitespace around segments', () => {
    const r = parseMatchTitle('  Comp  ·   A   ×   B  ');
    expect(r.context).toBe('Comp');
    expect(r.teamA).toBe('A');
    expect(r.teamB).toBe('B');
  });
});
