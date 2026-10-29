import { useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { Avatar, Badge, ErrorNote, Input, Select, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, niceDate } from '../../lib.js';
import { useApi, useApp } from '../../state.jsx';

const blank = { phone: '', name: '', role: '', district: '' };

export default function Team() {
  useTitle('Team');
  const { auth, meta, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/staff/team');
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr((x) => ({ ...x, [k]: undefined })); };
  const editing = data.rows.some((u) => u.phone === f.phone.replace(/\D/g, '').slice(-10));
  const staffRoles = Object.entries(meta.roles).filter(([k]) => k !== 'student').map(([value, label]) => ({ value, label }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      const r = await api.post('/api/staff/team', f);
      notify(r.created ? `${f.name} added. They can now sign in at the staff portal with ${f.phone}.` : `${f.name}'s account updated.`);
      setF(blank); reload();
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(false); }
  };

  const toggle = async (u) => {
    if (u.active && !window.confirm(`Deactivate ${u.name}? They will be signed out and can't sign in until reactivated. Their past actions stay on record.`)) return;
    setToggling(u.id);
    try {
      await api.post(`/api/staff/team/${u.id}/active`, { active: !u.active });
      notify(u.active ? `${u.name} deactivated.` : `${u.name} reactivated.`);
      reload();
    } catch (x) { notify(x.message, 'error'); } finally { setToggling(null); }
  };

  const active = data.rows.filter((u) => u.active).length;

  return (
    <>
      <PageHead title="Team" sub={`${active} active staff. Staff sign in at the staff portal with their registered mobile number.`} />
      <div className="cols">
        <div className="col-main">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Role</th><th>District</th><th className="num">Actions taken</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.rows.map((u) => (
                  <tr key={u.id} className={cx(!u.active && 'row-muted')}>
                    <td><div className="who"><Avatar name={u.name} size="sm" /><div><b>{u.name || '—'}</b>{u.id === auth.user.id && <span className="you">You</span>}<span className="muted small">+91 {u.phone}</span></div></div></td>
                    <td>{meta.roles[u.role]}</td>
                    <td>{u.district || <span className="muted">All</span>}</td>
                    <td className="num">{u.actions}</td>
                    <td>{u.active ? <Badge status="accepted">Active</Badge> : <Badge status="rejected">Deactivated</Badge>}<div className="muted small">Since {niceDate(u.created_at)}</div></td>
                    <td className="actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => { setF({ phone: u.phone, name: u.name || '', role: u.role, district: u.district || '' }); setErr({}); }}>Edit</button>
                      {u.id !== auth.user.id && (
                        <button className={cx('btn btn-sm', u.active ? 'btn-danger' : 'btn-ghost')} disabled={toggling === u.id} onClick={() => toggle(u)}>
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-side">
          <Panel title={editing ? 'Update staff member' : 'Add staff member'} aside={editing && <button className="linkish" onClick={() => { setF(blank); setErr({}); }}>Cancel</button>}>
            <form onSubmit={save} noValidate>
              <Input label="Mobile number" required type="tel" inputMode="numeric" maxLength={14} placeholder="98765 43210" value={f.phone} onChange={set('phone')} error={err.phone}
                help={editing ? 'Existing account: saving updates it.' : 'They sign in with this number and a one-time code.'} />
              <Input label="Full name" required value={f.name} onChange={set('name')} error={err.name} />
              <Select label="Role" required options={staffRoles} value={f.role} onChange={set('role')} error={err.role} />
              <Input label="District" required={f.role === 'field'} list="team-districts" value={f.district} onChange={set('district')} error={err.district}
                help={f.role === 'field' ? 'Field executives only see applications from this district.' : 'Optional for managers and admins.'} />
              <datalist id="team-districts">{meta.districts.map((d) => <option key={d} value={d} />)}</datalist>
              <dl className="role-help">
                <dt>Field executive</dt><dd>Home visits, documents, forwards to manager</dd>
                <dt>Program manager</dt><dd>Approves applications and payments</dd>
                <dt>Admin / finance</dt><dd>Everything, releases payments, manages team</dd>
              </dl>
              <button className="btn btn-block" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add staff member'}</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
