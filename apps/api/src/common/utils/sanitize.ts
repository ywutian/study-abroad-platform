import * as cheerio from 'cheerio';

type CheerioAcceptedNode = Parameters<cheerio.CheerioAPI>[0];
type SanitizableElement = CheerioAcceptedNode & {
  tagName?: string;
  attribs?: Record<string, string>;
};

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const DISCARD_WITH_CONTENT = new Set([
  'script',
  'style',
  'template',
  'xmp',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
]);

const GLOBAL_ATTRIBUTES = new Set(['title']);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'title']),
};

function isAllowedUrl(value: string): boolean {
  if (!value.trim()) return false;

  try {
    const parsed = new URL(value, 'https://example.com');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeAttributes(
  $: cheerio.CheerioAPI,
  element: SanitizableElement,
  tagName: string,
) {
  const attrs = element.attribs ?? {};
  const allowedForTag = TAG_ATTRIBUTES[tagName] ?? new Set<string>();

  for (const attr of Object.keys(attrs)) {
    const normalizedAttr = attr.toLowerCase();
    const isAllowed =
      GLOBAL_ATTRIBUTES.has(normalizedAttr) ||
      allowedForTag.has(normalizedAttr);

    if (!isAllowed) {
      $(element).removeAttr(attr);
      continue;
    }

    if (
      (normalizedAttr === 'href' || normalizedAttr === 'src') &&
      !isAllowedUrl(attrs[attr])
    ) {
      $(element).removeAttr(attr);
    }
  }

  if (tagName === 'a') {
    $(element).attr('rel', 'noopener noreferrer');
  }
}

/**
 * Sanitize user-generated HTML content to prevent XSS attacks.
 * Allows basic formatting tags but strips scripts, event handlers, etc.
 *
 * Finding: A5-006
 */
export function sanitizeUserContent(dirty: string): string {
  const $ = cheerio.load(dirty, null, false);

  $('*').each((_, node) => {
    if (!('tagName' in node)) return;
    const element = node as SanitizableElement;
    const tagName = element.tagName?.toLowerCase();
    if (!tagName) return;

    if (DISCARD_WITH_CONTENT.has(tagName)) {
      $(element).remove();
      return;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      $(element).replaceWith($(element).contents());
      return;
    }

    sanitizeAttributes($, element, tagName);
  });

  return $.root().html() ?? '';
}

/**
 * Strip ALL HTML tags - for plain text fields like names, titles.
 */
export function stripHtml(dirty: string): string {
  const $ = cheerio.load(dirty, null, false);
  $('script, style, template, xmp').remove();
  return $.root().text();
}
