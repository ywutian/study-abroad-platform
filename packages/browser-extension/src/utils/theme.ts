import { getExtensionThemeCssText } from '@study-abroad/shared/design/theme-contract';

const THEME_STYLE_ID_PREFIX = 'studyabroad-theme-vars';

export function injectExtensionThemeVars(selector = ':root'): void {
  const styleId = `${THEME_STYLE_ID_PREFIX}-${selector.replace(/[^a-z0-9_-]/gi, '-')}`;

  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = getExtensionThemeCssText(undefined, selector);
  (document.head || document.documentElement).appendChild(style);
}
