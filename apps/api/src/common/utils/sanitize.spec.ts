import { sanitizeUserContent, stripHtml } from './sanitize';

describe('sanitize utils', () => {
  it('removes script content and event handler attributes from rich content', () => {
    const result = sanitizeUserContent(
      '<p onclick="alert(1)">Hello <script>alert(1)</script><strong>world</strong></p>',
    );

    expect(result).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('removes unsafe URL protocols but keeps https links', () => {
    const result = sanitizeUserContent(
      '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>',
    );

    expect(result).toBe(
      '<a rel="noopener noreferrer">bad</a><a href="https://example.com" rel="noopener noreferrer">good</a>',
    );
  });

  it('strips all markup for plain text fields', () => {
    expect(stripHtml('<b>Plain</b><script>alert(1)</script> text')).toBe(
      'Plain text',
    );
  });
});
