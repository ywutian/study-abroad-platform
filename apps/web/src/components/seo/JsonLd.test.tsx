import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SchoolJsonLd, OrganizationJsonLd } from './JsonLd';

/**
 * These assert on server-rendered markup on purpose. The component previously
 * injected its <script> from a useEffect, so it passed any client-side test
 * while being completely absent from the HTML crawlers actually read.
 */
describe('JsonLd — must land in the server-rendered HTML', () => {
  it('emits the script tag during SSR, not on hydration', () => {
    const html = renderToStaticMarkup(<SchoolJsonLd name="Princeton University" />);

    expect(html).toContain('application/ld+json');
    expect(html).toContain('Princeton University');
  });

  it('produces parseable schema.org JSON', () => {
    const html = renderToStaticMarkup(
      <SchoolJsonLd name="Williams College" url="https://williams.edu" description="A college." />
    );
    const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    const parsed = JSON.parse(json.replace(/\\u003c/g, '<'));

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('EducationalOrganization');
    expect(parsed.name).toBe('Williams College');
  });

  it('escapes < so DB text cannot break out of the script tag', () => {
    // A school description carrying this is enough to inject markup if the
    // JSON is written into the tag raw.
    const html = renderToStaticMarkup(
      <OrganizationJsonLd name="Lumni" description={'</script><img src=x onerror=alert(1)>'} />
    );

    expect(html).not.toContain('</script><img');
    expect(html).toContain('\\u003c');
    // Exactly one closing tag: the component's own.
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
