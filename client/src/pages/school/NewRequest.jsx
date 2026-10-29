import { useEffect, useMemo, useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ProfileMeter } from '../../components/school.jsx';
import { Choices, ErrorNote, Icon, Input, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, inr, uploadTo } from '../../lib.js';
import { Link, navigate } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

let nextKey = 1;

export default function NewRequest() {
  useTitle('New request');
  const { meta, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/school/me');
  const [f, setF] = useState({ title: '', urgency: '', justification: '', beneficiaries: '' });
  const [lines, setLines] = useState([]);
  const [cat, setCat] = useState('furniture');
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(null);
  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0), [lines]);
  useEffect(() => { if (data && !data.school) navigate('/school/profile', { replace: true }); }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data.school) return <Spinner />;
  if (!data.status.ready) {
    return (
      <>
        <PageHead crumb={['/school', 'Dashboard']} title="New infrastructure request" />
        <Panel className="narrow">
          <ProfileMeter status={data.status} />
          <p className="mt">Complete your school profile before making a request. The committee uses it to verify your school and compare needs fairly.</p>
          <Link className="btn" to={data.status.missing.length === 1 && data.status.missing[0].includes('Photo') ? '/school/profile#photos' : '/school/profile'}>Complete profile</Link>
        </Panel>
      </>
    );
  }
  const { catalog, categories, urgency } = meta.infra;
  const school = data.school;
  const set = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: undefined })); };

  const add = (c) => {
    setErr((x) => ({ ...x, items: undefined }));
    setLines((ls) => {
      const have = ls.find((l) => l.item_key === c.key);
      if (have) return ls.map((l) => (l === have ? { ...l, quantity: Number(l.quantity || 0) + 1 } : l));
      return [...ls, { k: nextKey++, item_key: c.key, name: c.name, category: c.category, unit: c.unit, quantity: 1, unit_cost: c.cost, note: '' }];
    });
  };
  const addCustom = () => setLines((ls) => [...ls, { k: nextKey++, item_key: 'custom', name: '', category: cat, unit: 'item', quantity: 1, unit_cost: '', note: '' }]);
  const update = (k, patch) => setLines((ls) => ls.map((l) => (l.k === k ? { ...l, ...patch } : l)));
  const remove = (k) => setLines((ls) => ls.filter((l) => l.k !== k));
  const inCart = (key) => lines.find((l) => l.item_key === key)?.quantity;

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!lines.length) local.items = 'Add at least one item.';
    lines.forEach((l, i) => {
      if (!l.name.trim()) local[`item_${i}`] = 'Name every custom item.';
      else if (!(Number(l.quantity) >= 1)) local[`item_${i}`] = `${l.name}: enter a quantity.`;
      else if (l.unit_cost === '' || !(Number(l.unit_cost) >= 0)) local[`item_${i}`] = `${l.name}: enter the cost per ${l.unit}.`;
    });
    if (!f.title.trim()) local.title = 'Give the request a short title.';
    if (!f.urgency) local.urgency = 'Choose how urgent this is.';
    if (f.justification.trim().length < 80) local.justification = 'Explain the need in at least 80 characters: what is missing, and how students are affected today.';
    if (f.beneficiaries && !(Number(f.beneficiaries) >= 1 && Number(f.beneficiaries) <= school.students)) local.beneficiaries = `Between 1 and ${school.students} (your enrolment).`;
    if (!photos.length) local.photos = 'Add at least one photo of the current condition. It helps the field executive plan the visit.';
    setErr(local);
    setBusy('saving');
    try {
      if (Object.keys(local).length) throw Object.assign(new Error('Some details need fixing.'), { fields: local });
      const body = { ...f, beneficiaries: f.beneficiaries || school.students, items: lines.map(({ item_key, name, category, quantity, unit_cost, note }) => ({ item_key, name, category, quantity, unit_cost, note })) };
      const r = await api.post('/api/school/requests', body);
      setBusy('uploading');
      let failed = 0;
      for (const file of photos) {
        try { await uploadTo(`/api/infra/${r.id}/documents/condition`, file); } catch { failed += 1; }
      }
      notify(failed ? `Request ${r.code} submitted. ${failed} photo${failed > 1 ? 's' : ''} didn't upload; add them from the request page.`
        : `Request ${r.code} submitted. A field executive will contact you to plan a site visit.`, failed ? 'warn' : 'success');
      navigate(`/school/requests/${r.id}`);
    } catch (x) {
      setErr({ ...local, ...(x.fields || {}) }); notify(x.message, 'error');
      setTimeout(() => document.querySelector('.has-error input, .has-error textarea, .has-error select')?.focus(), 30);
    } finally { setBusy(null); }
  };

  const itemErrors = Object.entries(err).filter(([k, v]) => k.startsWith('item_') && v).map(([, v]) => v);

  return (
    <>
      <PageHead crumb={['/school', 'Dashboard']} title="New infrastructure request"
        sub={`For ${school.name}. Ask for everything one project needs, e.g. all the furniture for three classrooms.`} />
      <form className="request-form" onSubmit={submit} noValidate>
        <div className="col-main">
          <Panel title="1. Choose items" aside="Costs are estimates; change them to match a local quotation">
            <div className="cat-tabs" role="tablist">
              {Object.entries(categories).filter(([k]) => k !== 'other').map(([k, c]) => (
                <button type="button" key={k} role="tab" aria-selected={cat === k} className={cx(cat === k && 'on')} onClick={() => setCat(k)}>{c.label}</button>
              ))}
            </div>
            <div className="catalog">
              {catalog.filter((c) => c.category === cat).map((c) => (
                <button type="button" key={c.key} className={cx('cat-item', inCart(c.key) && 'in')} onClick={() => add(c)}>
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-cost">{inr(c.cost)} / {c.unit}</span>
                  <span className="cat-add">{inCart(c.key) ? `${inCart(c.key)} added` : '+ Add'}</span>
                </button>
              ))}
              <button type="button" className="cat-item cat-custom" onClick={addCustom}>
                <span className="cat-name">Something else</span><span className="cat-cost">Add a custom item</span><span className="cat-add">+ Add</span>
              </button>
            </div>
          </Panel>

          <Panel title={`2. Your list (${lines.length})`} aside={<span className="money-line">Total <b>{inr(total)}</b></span>} className={cx(err.items && 'panel-warn')}>
            {lines.length ? (
              <ul className="lines">
                {lines.map((l) => (
                  <li key={l.k}>
                    <div className="line-name">
                      {l.item_key === 'custom'
                        ? <input aria-label="Item name" placeholder="Item name, e.g. Water cooler" value={l.name} onChange={(e) => update(l.k, { name: e.target.value })} />
                        : <b>{l.name}</b>}
                      <input className="line-note" aria-label="Note" placeholder="Note (optional): size, classroom, brand" value={l.note} onChange={(e) => update(l.k, { note: e.target.value })} />
                    </div>
                    <div className="stepper" aria-label="Quantity">
                      <button type="button" onClick={() => update(l.k, { quantity: Math.max(1, Number(l.quantity || 1) - 1) })} aria-label="Less">−</button>
                      <input inputMode="numeric" value={l.quantity} onChange={(e) => update(l.k, { quantity: e.target.value.replace(/\D/g, '') })} aria-label="Quantity" />
                      <button type="button" onClick={() => update(l.k, { quantity: Number(l.quantity || 0) + 1 })} aria-label="More">+</button>
                    </div>
                    <label className="line-cost"><span>₹ per {l.unit}</span>
                      <input inputMode="numeric" value={l.unit_cost} onChange={(e) => update(l.k, { unit_cost: e.target.value.replace(/\D/g, '') })} />
                    </label>
                    <span className="line-total">{inr((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}</span>
                    <button type="button" className="icon-btn" onClick={() => remove(l.k)} aria-label={`Remove ${l.name || 'item'}`}><Icon name="trash" /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="muted flush">Nothing added yet. Pick items above.</p>}
            {(err.items || itemErrors.length > 0) && <div className="field-error">{[err.items, ...itemErrors].filter(Boolean).join(' ')}</div>}
          </Panel>

          <Panel title="3. Explain the need">
            <Input label="Short title" required placeholder='e.g. "Desks for Classes 5 to 7"' maxLength={120} value={f.title} onChange={set('title')} error={err.title} />
            <Choices name="urgency" legend="How urgent is this?" required value={f.urgency} onChange={set('urgency')} error={err.urgency}
              options={Object.entries(urgency).map(([value, u]) => ({ value, label: u.label.split(':')[0], sub: u.label.split(': ')[1] }))} />
            <div className={cx('field', err.justification && 'has-error')}>
              <label htmlFor="just" className="req">What is the problem today?</label>
              <p className="field-help" style={{ marginTop: 0 }}>What is missing or broken, how many children are affected, and what happens because of it. Kannada or Hindi is fine.</p>
              <textarea id="just" rows={6} maxLength={3000} value={f.justification} onChange={set('justification')} aria-invalid={!!err.justification} />
              <div className={cx('counter', f.justification.trim().length >= 80 && 'ok')}>
                {f.justification.trim().length >= 80 ? `${f.justification.trim().length} characters` : `${f.justification.trim().length} / 80 characters minimum`}
              </div>
              {err.justification && <div className="field-error">{err.justification}</div>}
            </div>
            <Input label="Students who will benefit" type="number" min="1" max={school.students} placeholder={String(school.students)}
              value={f.beneficiaries} onChange={set('beneficiaries')} error={err.beneficiaries} help={`Leave blank for the whole school (${school.students}).`} />
          </Panel>

          <Panel title="4. Photos of the current condition" className={cx(err.photos && 'panel-warn')}>
            <label className={cx('slot', photos.length && 'done')}>
              <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => { setPhotos([...photos, ...e.target.files]); setErr((x) => ({ ...x, photos: undefined })); e.target.value = ''; }} />
              <Icon name="camera" />
              <span className="slot-name">{photos.length ? `${photos.length} file${photos.length > 1 ? 's' : ''} selected` : 'Add photos or a quotation PDF'}</span>
              <span className="slot-state">{photos.length ? 'Add more' : 'Required'}</span>
            </label>
            {photos.length > 0 && (
              <ul className="file-chips">{photos.map((p, i) => (
                <li key={`${p.name}-${i}`}>{p.name}<button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</button></li>
              ))}</ul>
            )}
            {err.photos && <div className="field-error">{err.photos}</div>}
          </Panel>
        </div>

        <aside className="col-side request-summary">
          <Panel title="Summary">
            <dl className="kv">
              <dt>School</dt><dd>{school.name}</dd>
              <dt>Items</dt><dd>{lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)} across {lines.length} line{lines.length === 1 ? '' : 's'}</dd>
              <dt>Urgency</dt><dd>{f.urgency ? urgency[f.urgency].label.split(':')[0] : '—'}</dd>
              <dt>Photos</dt><dd>{photos.length}</dd>
            </dl>
            <p className="big-num mt">{inr(total)} <span>estimated</span></p>
            <p className="muted small">We pay the vendor directly after approval. The final sanctioned amount may differ from the estimate.</p>
            <button className="btn btn-block btn-lg" disabled={!!busy}>{busy === 'saving' ? 'Submitting…' : busy === 'uploading' ? 'Uploading photos…' : 'Submit request'}</button>
            <Link className="btn btn-block btn-ghost mt" to="/school">Cancel</Link>
          </Panel>
        </aside>
      </form>
    </>
  );
}
