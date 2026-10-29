import { PageHead } from '../../components/layout.jsx';
import { useTitle } from '../../components/ui.jsx';
import { useApp } from '../../state.jsx';

export default function Scoring() {
  useTitle('Scoring rules');
  const { meta } = useApp();
  const share = Math.round(meta.needShare * 100);
  return (
    <>
      <PageHead title="Scoring rules" sub={`Overall score = need × ${share}% + marks × ${100 - share}%. Each answer earns a share of its question's weight.`} />
      <div className="table-wrap narrow">
        <table className="data">
          <thead><tr><th>Question</th><th className="num">Weight</th><th>Points for each answer</th></tr></thead>
          <tbody>
            {meta.questions.map((q) => (
              <tr key={q.key}>
                <td><b>{q.en}</b><br /><span className="muted small" lang="hi">{q.hi}</span></td>
                <td className="num"><span className="weight">{q.weight}%</span></td>
                <td className="small">{q.options.map((o, i) => <span key={o.key}>{o.en} <b>{Math.round(q.weight * o.value * 10) / 10}</b>{i < q.options.length - 1 ? '; ' : ''}</span>)}</td>
              </tr>
            ))}
            <tr className="total"><td>Total</td><td className="num">{meta.questions.reduce((s, q) => s + q.weight, 0)}%</td><td /></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
