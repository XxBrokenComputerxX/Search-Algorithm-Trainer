import type { ReactNode } from 'react';
import type { Property } from '../engine/properties';

export function Stars({ value, max = 3, size = 'md' }: { value: number; max?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? 'star on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export function VerdictBadge({ p }: { p: Property }) {
  return (
    <span className={`verdict verdict-${p.verdict}`} title={p.text}>
      {p.verdict === 'yes' ? '✓ ' : p.verdict === 'no' ? '✗ ' : '◐ '}
      {p.short}
    </span>
  );
}

export function Panel({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function NumberInput({
  value,
  onChange,
  label,
  invalid,
  disabled,
  width = 5,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  width?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`num${invalid ? ' invalid' : ''}`}
      style={{ width: `${width + 1.5}ch` }}
      aria-label={label}
      placeholder={label.split(' ')[0]}
      disabled={disabled}
      value={value === undefined || Number.isNaN(value) ? '' : value}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}
