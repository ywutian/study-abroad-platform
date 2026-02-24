import { Font } from '@react-pdf/renderer';
import type { FontPairing, FontPairingId } from '../types';

// ─── Font Registration ───
// Helvetica and Times-Roman are built-in to react-pdf (no registration needed)
// We register Google Fonts for Roboto, Lato, Noto Sans SC, Source Sans Pro, Merriweather

let registered = false;

export function registerFonts() {
  if (registered) return;
  registered = true;

  // Roboto
  Font.register({
    family: 'Roboto',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf',
        fontWeight: 700,
      },
    ],
  });

  // Lato
  Font.register({
    family: 'Lato',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXg.ttf', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ.ttf', fontWeight: 700 },
    ],
  });

  // Noto Sans SC (Chinese support)
  Font.register({
    family: 'Noto Sans SC',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
        fontWeight: 700,
      },
    ],
  });

  // Source Sans Pro
  Font.register({
    family: 'Source Sans Pro',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky462EM.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Kxm7WEM.ttf',
        fontWeight: 700,
      },
    ],
  });

  // Merriweather
  Font.register({
    family: 'Merriweather',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZM.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l52xwNZWMf6.ttf',
        fontWeight: 700,
      },
    ],
  });

  // Disable hyphenation for all fonts (resumes should not hyphenate)
  Font.registerHyphenationCallback((word) => [word]);
}

// ─── Font Pairings ───

export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  helvetica: {
    id: 'helvetica',
    heading: 'Helvetica',
    body: 'Helvetica',
    label: 'Helvetica (ATS Safe)',
  },
  times: {
    id: 'times',
    heading: 'Times-Roman',
    body: 'Times-Roman',
    label: 'Times New Roman (Classic)',
  },
  roboto: {
    id: 'roboto',
    heading: 'Roboto',
    body: 'Roboto',
    label: 'Roboto (Modern)',
  },
  lato: {
    id: 'lato',
    heading: 'Lato',
    body: 'Lato',
    label: 'Lato (Elegant)',
  },
  'noto-sans-sc': {
    id: 'noto-sans-sc',
    heading: 'Noto Sans SC',
    body: 'Noto Sans SC',
    label: 'Noto Sans SC (Chinese)',
  },
  'source-merriweather': {
    id: 'source-merriweather',
    heading: 'Source Sans Pro',
    body: 'Merriweather',
    label: 'Source Sans + Merriweather',
  },
};
