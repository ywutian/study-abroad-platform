/**
 * Essay provenance — Mom-persona trust signal.
 *
 * The essay-harvest pipeline stamps the originating URL onto each
 * `AdmissionCase.tags` slot using a single canonical tag of the form:
 *
 *     `source:<url>#<author>`
 *
 * — where `<author>` is either a public byline (e.g. "Nancy") or the
 * sentinel `anon` when the archive published the essay anonymously.
 * Older rows may carry only the URL (no `#author` suffix). This module
 * canonicalises both shapes into a structured `EssayProvenance` so the
 * gallery can render a verifiable "本文来源 · 查看原文 →" link instead of
 * passing raw tag strings through to the UI.
 *
 * Used in two places:
 *   - API: write-time backfill in `essay-gallery.service.ts` to populate
 *     the new `AdmissionCase.sourceArchive / sourceUrl / sourceAuthor`
 *     columns when they're null on legacy rows.
 *   - Web: `EssayCard` + `EssayDetailPanel` to render the chip / footer.
 */

export interface EssayProvenance {
  /** Bare host of the originating archive (e.g. "apply.jhu.edu"). */
  archive: string | null;
  /** Canonical link back to the originating page (never the harvester). */
  url: string | null;
  /**
   * Public byline if the archive published one; `null` when the source
   * was anonymous (the sentinel `anon` is collapsed to `null` here).
   */
  author: string | null;
}

/**
 * Human-readable labels for each archive host we've seen in the harvest.
 * Hosts not in this map fall back to the bare host string on the chip.
 *
 * Keep this list narrow — every entry is a manual editorial assertion
 * that the source is reputable enough to surface to readers. If a new
 * archive starts appearing in tags, add it here only after a human has
 * confirmed it's a real publication and not random user-generated content.
 */
export const ARCHIVE_LABELS: Record<string, { en: string; zh: string }> = {
  'apply.jhu.edu': {
    en: "Johns Hopkins 'Essays That Worked'",
    zh: '约翰·霍普金斯「Essays That Worked」公开档案',
  },
  'hamilton.edu': {
    en: 'Hamilton College Admissions Archive',
    zh: '汉密尔顿学院招生公开档案',
  },
  'collegevine.com': {
    en: 'CollegeVine Essay Archive',
    zh: 'CollegeVine 范文库',
  },
  'blog.collegevine.com': {
    en: 'CollegeVine Essay Archive',
    zh: 'CollegeVine 范文库',
  },
  'prepmaven.com': {
    en: 'PrepMaven Essay Archive',
    zh: 'PrepMaven 范文库',
  },
  'shemmassianconsulting.com': {
    en: 'Shemmassian Academic Consulting Archive',
    zh: 'Shemmassian Consulting 公开范文',
  },
  'collegeessayguy.com': {
    en: 'College Essay Guy Archive',
    zh: 'College Essay Guy 公开范文',
  },
  'thecrimson.com': {
    en: 'Harvard Crimson — Essays That Worked',
    zh: '哈佛 Crimson「Essays That Worked」',
  },
  'business.thecrimson.com': {
    en: 'Harvard Crimson — Essays That Worked',
    zh: '哈佛 Crimson「Essays That Worked」',
  },
  'thetech.com': {
    en: "MIT The Tech — 'Application V'",
    zh: 'MIT The Tech「Application V」公开档案',
  },
  'blog.emoryadmission.com': {
    en: 'Emory Admission Blog',
    zh: '埃默里大学招生官博客',
  },
  'blog.prepscholar.com': {
    en: 'PrepScholar Essay Archive',
    zh: 'PrepScholar 范文库',
  },
  'kevinzhensei.medium.com': {
    en: 'Medium — Personal Essay Archive',
    zh: 'Medium — 个人公开发布',
  },
};

const SOURCE_TAG_PREFIX = 'source:';

/**
 * Parse the canonical `source:<url>#<author>` tag out of a `tags` array.
 * Returns null fields when the tag is missing or malformed — callers
 * MUST be tolerant of null because legacy rows pre-date the convention.
 */
export function parseEssayProvenance(tags: readonly string[] | null | undefined): EssayProvenance {
  if (!tags || tags.length === 0) {
    return { archive: null, url: null, author: null };
  }

  // Prefer the first http(s) source tag — the harvest writes exactly one,
  // but a few legacy rows have synthetic `source:reddit:...` markers that
  // are NOT URLs. We skip those: reddit threads aren't a citeable archive.
  const tag = tags.find(
    (t) =>
      typeof t === 'string' &&
      t.startsWith(SOURCE_TAG_PREFIX) &&
      (t.startsWith(`${SOURCE_TAG_PREFIX}http://`) || t.startsWith(`${SOURCE_TAG_PREFIX}https://`))
  );
  if (!tag) return { archive: null, url: null, author: null };

  // Strip the prefix, then split on '#'. The first '#' separator splits
  // the URL from the (anchor-or-author). Some pages have legitimate URL
  // fragments (e.g. `#essay4`); when there are 2+ '#' segments we treat
  // the LAST segment as the author and re-attach everything else to the URL.
  const rest = tag.slice(SOURCE_TAG_PREFIX.length);
  const hashIdx = rest.lastIndexOf('#');
  let rawUrl: string;
  let rawAuthor: string | null;
  if (hashIdx === -1) {
    rawUrl = rest;
    rawAuthor = null;
  } else {
    rawUrl = rest.slice(0, hashIdx);
    rawAuthor = rest.slice(hashIdx + 1) || null;
  }

  // Sanity-check the URL — if anything goes wrong, return null fields
  // rather than risk surfacing a junk link to the reader.
  let host: string | null = null;
  try {
    const parsed = new URL(rawUrl);
    host = parsed.host.replace(/^www\./, '');
  } catch {
    return { archive: null, url: null, author: null };
  }

  // Collapse the `anon` sentinel — the archive published anonymously,
  // surface no byline rather than the placeholder string.
  const author = rawAuthor && rawAuthor.toLowerCase() !== 'anon' ? rawAuthor : null;

  return { archive: host, url: rawUrl, author };
}

/**
 * Human-readable label for the chip / detail line. Falls back to the
 * bare host when we don't have an editorial entry yet — keeps the link
 * trustworthy without lying about which archive it is.
 */
export function getArchiveLabel(
  archive: string | null | undefined,
  locale: 'zh' | 'en'
): string | null {
  if (!archive) return null;
  const entry = ARCHIVE_LABELS[archive];
  if (entry) return entry[locale];
  return archive;
}
