import en from '@/lib/i18n/locales/en.json';

type LocaleNode = Record<string, unknown>;

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as LocaleNode)[segment];
  }, en);
}

export function translateForTests(key: string, options?: string | Record<string, unknown>) {
  const value = lookup(key);
  const template = typeof value === 'string' ? value : typeof options === 'string' ? options : key;
  if (!options || typeof options === 'string') return template;

  return template.replace(/\{\{?(\w+)\}?\}/g, (match, name: string) => {
    const replacement = options[name];
    return replacement == null ? match : String(replacement);
  });
}
