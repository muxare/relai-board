export interface LabelStyle {
  bg: string;
  fg: string;
  ghColor: string;
}

export const LABEL_STYLES: Record<string, LabelStyle> = {
  epic: { bg: 'var(--purple-light)', fg: 'var(--purple)', ghColor: '6F42C1' },
  feature: { bg: 'var(--green-light)', fg: 'var(--green)', ghColor: '0E8A16' },
  story: { bg: 'var(--accent-light)', fg: 'var(--accent)', ghColor: '1D76DB' },
  'phase-1': {
    bg: 'var(--yellow-light)',
    fg: 'var(--yellow)',
    ghColor: 'FBCA04',
  },
  'phase-2': {
    bg: 'var(--orange-light)',
    fg: 'var(--orange)',
    ghColor: 'F9A825',
  },
  'phase-3': { bg: 'var(--red-light)', fg: 'var(--red)', ghColor: 'E65100' },
  'phase-4': {
    bg: 'var(--purple-light)',
    fg: 'var(--purple)',
    ghColor: 'B71C1C',
  },
  A1: { bg: 'var(--accent-light)', fg: 'var(--accent)', ghColor: 'C5DEF5' },
  A2: { bg: 'var(--yellow-light)', fg: 'var(--yellow)', ghColor: 'FEF2C0' },
  A3: { bg: 'var(--red-light)', fg: 'var(--red)', ghColor: 'F9D0C4' },
  backend: {
    bg: 'var(--purple-light)',
    fg: 'var(--purple)',
    ghColor: 'D4C5F9',
  },
  frontend: {
    bg: 'var(--accent-light)',
    fg: 'var(--accent)',
    ghColor: 'BFD4F2',
  },
  ai: { bg: 'var(--red-light)', fg: 'var(--red)', ghColor: 'F7C6C7' },
  infra: { bg: 'var(--green-light)', fg: 'var(--green)', ghColor: 'D4E4BC' },
  proposed: {
    bg: 'var(--yellow-light)',
    fg: 'var(--yellow)',
    ghColor: 'DBAB09',
  },
  'night:ready': {
    bg: 'var(--green-light)',
    fg: 'var(--green)',
    ghColor: '3FB950',
  },
  'night:running': {
    bg: 'var(--accent-dark)',
    fg: 'var(--bg)',
    ghColor: '0550AE',
  },
  'night:done': {
    bg: 'var(--purple-light)',
    fg: 'var(--purple)',
    ghColor: '8957E5',
  },
  'night:blocked': {
    bg: 'var(--red-light)',
    fg: 'var(--red)',
    ghColor: 'CF222E',
  },
  'src:human': {
    bg: 'var(--accent-light)',
    fg: 'var(--accent)',
    ghColor: '54AEFF',
  },
  'src:researcher': {
    bg: 'var(--orange-light)',
    fg: 'var(--orange)',
    ghColor: 'BC4C00',
  },
  'src:smellfix': {
    bg: 'var(--fg2)',
    fg: 'var(--bg)',
    ghColor: '57606A',
  },
};

export const NIGHTSHIFT_LABELS = [
  'proposed',
  'night:ready',
  'night:running',
  'night:done',
  'night:blocked',
  'src:human',
  'src:researcher',
  'src:smellfix',
] as const;

export function getLabelStyle(name: string): LabelStyle {
  return (
    LABEL_STYLES[name] || {
      bg: 'var(--bg3)',
      fg: 'var(--fg2)',
      ghColor: 'EDEDED',
    }
  );
}
