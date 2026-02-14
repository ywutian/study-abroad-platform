import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize user-generated HTML content to prevent XSS attacks.
 * Allows basic formatting tags but strips scripts, event handlers, etc.
 *
 * Finding: A5-006
 */
export function sanitizeUserContent(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'data'],
    disallowedTagsMode: 'discard',
  });
}

/**
 * Strip ALL HTML tags - for plain text fields like names, titles.
 */
export function stripHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
  });
}
