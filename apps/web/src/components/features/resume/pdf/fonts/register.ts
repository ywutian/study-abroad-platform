import { Font } from '@react-pdf/renderer';
import type { FontPairing, FontPairingId } from '../types';

// ─── Font Registration ───
// Helvetica and Times-Roman are built-in to react-pdf (no registration needed)
// We register Google Fonts for Roboto, Lato, Noto Sans SC, Source Sans Pro, Merriweather

let registered = false;

export function registerFonts() {
  if (registered) return;
  registered = true;

  // Roboto (regular + bold + italic variants)
  Font.register({
    family: 'Roboto',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLoHQiA8.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLmbXiA8.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
      },
    ],
  });

  // Lato (regular + bold + italic variants)
  Font.register({
    family: 'Lato',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHvxk.ttf', fontWeight: 400 },
      {
        src: 'https://fonts.gstatic.com/s/lato/v25/S6u8w4BMUTPHjxswWw.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      { src: 'https://fonts.gstatic.com/s/lato/v25/S6u9w4BMUTPHh6UVew8.ttf', fontWeight: 700 },
      {
        src: 'https://fonts.gstatic.com/s/lato/v25/S6u_w4BMUTPHjxsI5wqPHA.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
      },
    ],
  });

  // Noto Sans SC (Chinese support)
  // CJK fonts have no native italic — register regular file as italic fallback
  Font.register({
    family: 'Noto Sans SC',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
      },
    ],
  });

  // Source Sans Pro (regular + bold + italic variants)
  Font.register({
    family: 'Source Sans Pro',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky461EN.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlO9C4.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Kxf7FEN.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqF5J9C4.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
      },
    ],
  });

  // Merriweather (regular + bold + italic variants)
  Font.register({
    family: 'Merriweather',
    fonts: [
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v33/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDr3icqEw.ttf',
        fontWeight: 400,
      },
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v33/u-4B0qyriQwlOrhSvowK_l5-eTxCVx0ZbwLvKH2Gk9hLmp0v5yA-xXPqCzLvPee1XYk_XSf-FmTCUF3w.ttf',
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v33/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDrOSAqEw.ttf',
        fontWeight: 700,
      },
      {
        src: 'https://fonts.gstatic.com/s/merriweather/v33/u-4B0qyriQwlOrhSvowK_l5-eTxCVx0ZbwLvKH2Gk9hLmp0v5yA-xXPqCzLvPee1XYk_XSf-FmQlV13w.ttf',
        fontWeight: 700,
        fontStyle: 'italic',
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
