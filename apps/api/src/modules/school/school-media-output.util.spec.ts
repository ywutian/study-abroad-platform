import {
  schoolMediaJsonReplacer,
  stringifySchoolMediaResult,
} from './school-media-output.util';

describe('schoolMediaJsonReplacer', () => {
  it('omits downloaded image buffers from CLI output', () => {
    const output = stringifySchoolMediaResult({
      candidate: {
        originalUrl: 'https://example.edu/campus.png',
        buffer: Buffer.from([1, 2, 3, 4]),
      },
    });

    expect(output).toContain('"buffer": "[buffer omitted: 4 bytes]"');
    expect(output).not.toContain('"data"');
  });

  it('leaves normal fields unchanged', () => {
    expect(schoolMediaJsonReplacer('status', 'APPROVED')).toBe('APPROVED');
  });
});
