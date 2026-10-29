import { useEffect, useId, useState } from 'react';
import { Link } from '../router.jsx';
import { useApp } from '../state.jsx';
import { cx, initials } from '../lib.js';

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  plus: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  rupee: 'M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l9 7',
  class: 'M2 8l10-5 10 5-10 5zM6 10.5V16c3 2.5 9 2.5 12 0v-5.5',
  brief: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  scale: 'M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z',
  doc: 'M14 3H6v18h12V7zM14 3v4h4',
  laptop: 'M4 5h16v11H4zM2 19h20',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  check: 'M5 12l5 5L20 7',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  school: 'M3 21h18M5 21V10l7-6 7 6v11M9.5 21v-5h5v5M12 10.5h.01',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  truck: 'M2 6h12v10H2zM14 10h4l3 3v3h-7zM6.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
};

export const Icon = ({ name, className }) => (
  <svg className={cx('icon', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

/** Brand: a lamp inside an arched niche. */
export function Brand({ light = false, to = '/' }) {
  return (
    <Link to={to} className={cx('brand', light && 'brand-light')} aria-label="Takshashila home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 40">
          <path d="M8 36V19a10 10 0 0 1 20 0v17" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M18 17c2.6 3 3.1 5.4 1.7 7.3a2.3 2.3 0 0 1-3.4 0c-1.4-1.9-.9-4.3 1.7-7.3z" fill="var(--gold)" />
        </svg>
      </span>
      <span className="brand-name">Takshashila<small>Education Trust</small></span>
    </Link>
  );
}

export function Avatar({ name, size = 'md' }) {
  return <span className={cx('avatar', `avatar-${size}`)} aria-hidden="true">{initials(name)}</span>;
}

/** The need score drawn as a doorway: the gold line climbs one pillar, over the arch and down the other. */
export function ArchGauge({ value = 0, label = 'Need score', size = 'md', sub }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const L = 371.33; // 60 + π·80 + 60
  return (
    <div className={cx('gauge', `gauge-${size}`)} role="img" aria-label={`${label} ${Math.round(v)} out of 100`}>
      <svg viewBox="0 0 200 170" aria-hidden="true">
        <path className="gauge-track" d="M20 165V100a80 80 0 0 1 160 0v65" />
        <path className="gauge-fill" d="M20 165V100a80 80 0 0 1 160 0v65" strokeDasharray={L} strokeDashoffset={L * (1 - v / 100)} />
      </svg>
      <div className="gauge-num">
        <b>{Math.round(v)}</b>
        <span>{label}</span>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export function Badge({ status, children }) {
  const { meta } = useApp();
  return <span className={cx('badge', `b-${status}`)}>{children || meta?.statuses?.[status] || status}</span>;
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner" role="status"><span className="ring" /><span className="sr-only">{label}</span></div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="note note-error" role="alert">
      <p>{error.message}</p>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return <div className="empty"><h4>{title}</h4>{children && <p>{children}</p>}{action}</div>;
}

export function Flash() {
  const { flash, clearFlash } = useApp();
  if (!flash) return null;
  return (
    <div className={cx('flash', `flash-${flash.kind}`)} role="status" key={flash.at}>
      <span>{flash.message}</span>
      <button className="flash-x" onClick={clearFlash} aria-label="Dismiss">×</button>
    </div>
  );
}

// ---------- form controls ----------

export function Field({ label, hi, required, error, help, children, id: givenId, className }) {
  const auto = useId();
  const id = givenId || auto;
  return (
    <div className={cx('field', error && 'has-error', className)}>
      {label && (
        <label htmlFor={id} className={cx(required && 'req')}>
          {label}{hi && <span className="hi" lang="hi"> / {hi}</span>}
        </label>
      )}
      {typeof children === 'function' ? children({ id, 'aria-invalid': !!error, 'aria-describedby': error || help ? `${id}-d` : undefined }) : children}
      {(error || help) && <div id={`${id}-d`} className={error ? 'field-error' : 'field-help'}>{error || help}</div>}
    </div>
  );
}

export function Input({ label, hi, required, error, help, className, ...props }) {
  return (
    <Field label={label} hi={hi} required={required} error={error} help={help} className={className}>
      {(a) => <input {...a} {...props} required={required} />}
    </Field>
  );
}

export function Select({ label, hi, required, error, help, options, placeholder = 'Choose', className, ...props }) {
  return (
    <Field label={label} hi={hi} required={required} error={error} help={help} className={className}>
      {(a) => (
        <select {...a} {...props} required={required}>
          <option value="">{placeholder}</option>
          {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      )}
    </Field>
  );
}

/** Tap-to-choose buttons (radio or checkbox). options: [{value, label, sub}] */
export function Choices({ name, legend, hi, weight, options, value, onChange, multiple, required, error }) {
  const isOn = (v) => (multiple ? (value || []).includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    const set = new Set(value || []);
    set.has(v) ? set.delete(v) : set.add(v);
    onChange([...set]);
  };
  return (
    <fieldset className={cx('choices-q', error && 'has-error')} data-name={name}>
      <legend className={cx(required && 'req')}>
        {legend}{hi && <span className="hi" lang="hi"> / {hi}</span>}
        {weight !== undefined && <span className="weight" title="Share of the need score">{weight}%</span>}
      </legend>
      <div className="choices">
        {options.map((o) => (
          <label key={o.value} className={cx('choice', isOn(o.value) && 'on')}>
            <input type={multiple ? 'checkbox' : 'radio'} name={name} value={o.value} checked={isOn(o.value)} onChange={() => toggle(o.value)} />
            <span>{o.label}{o.sub && <small lang="hi">{o.sub}</small>}</span>
          </label>
        ))}
      </div>
      {error && <div className="field-error">{error}</div>}
    </fieldset>
  );
}

/** File picker styled as a slot that turns green once chosen or uploaded. */
export function FileSlot({ label, required, accept, file, uploaded, progress, onPick, capture }) {
  const state = progress !== undefined && progress < 1 ? `${Math.round(progress * 100)}%`
    : file ? file.name.length > 26 ? `${file.name.slice(0, 23)}…` : file.name
    : uploaded ? 'Uploaded' : required ? 'Pending' : 'Optional';
  return (
    <label className={cx('slot', (file || uploaded) && 'done', progress !== undefined && progress < 1 && 'busy')}>
      <input type="file" accept={accept} capture={capture} onChange={(e) => onPick(e.target.files[0] || null)} />
      <span className="slot-name">{label}</span>
      <span className="slot-state">{state}</span>
      {progress !== undefined && progress < 1 && <span className="slot-bar" style={{ width: `${progress * 100}%` }} />}
    </label>
  );
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} · Takshashila` : 'Takshashila'; }, [title]);
}

export function Confirm({ children }) {
  const [open, setOpen] = useState(false);
  return children(open, setOpen);
}
