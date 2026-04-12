import { getLabelStyle } from '../labels/styles';

interface PillProps {
  label: string;
}

export function Pill({ label }: PillProps) {
  const s = getLabelStyle(label);
  return (
    <span className="pill" style={{ background: s.bg, color: s.fg }}>
      {label}
    </span>
  );
}
