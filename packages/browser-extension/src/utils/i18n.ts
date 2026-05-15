type MessageSubstitution = string | number | boolean | null | undefined;

function normalizeSubstitutions(
  substitutions?: MessageSubstitution | MessageSubstitution[]
): string | string[] | undefined {
  if (substitutions == null) return undefined;
  if (Array.isArray(substitutions)) return substitutions.map((item) => String(item ?? ''));
  return String(substitutions);
}

export function msg(
  key: string,
  substitutions?: MessageSubstitution | MessageSubstitution[]
): string {
  const translated = chrome.i18n.getMessage(key, normalizeSubstitutions(substitutions));
  return translated || key;
}

export function applyI18n(root: ParentNode = document): void {
  document.documentElement.lang = chrome.i18n.getUILanguage().startsWith('zh') ? 'zh-CN' : 'en';

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = msg(key);
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (key) element.setAttribute('title', msg(key));
  });

  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]')
    .forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      if (key) element.placeholder = msg(key);
    });
}
