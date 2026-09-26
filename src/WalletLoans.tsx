import { useState } from 'react';
import { Download } from 'lucide-react';
import { formatEuro, locations, type DemoWallet, type Status } from '../shared/model';
import { getDemoIdentity } from './api';

const statusText: Record<Status, string> = { reserved: 'Zahlung offen', borrowed: 'Bei dir', refund_pending: 'Rückzahlung läuft', returned: 'Zurückgegeben' };
const date = (value: string) => new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const site = (id: string | null) => locations.find(location => location.id === id)?.name ?? '—';

export function WalletLoans({ data }: { data: DemoWallet }) {
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const active = data.loans.filter(loan => loan.status !== 'returned');
  const loans = filter === 'active' ? active : data.loans;
  async function download() {
    setExporting(true); setError('');
    try {
      const response = await fetch('/api/demo-wallet/export.csv', { headers: { Authorization: `Bearer ${getDemoIdentity()}` } });
      if (!response.ok) throw new Error('export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'pfandloop-becherhistorie.csv';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('CSV konnte nicht geladen werden. Bitte erneut versuchen.'); }
    finally { setExporting(false); }
  }
  return <section className="wallet-loans" aria-label="Meine Becherhistorie">
    <div className="history-heading"><h3>Alle deine Becher.</h3><button className="text-button" disabled={exporting} onClick={() => void download()}><Download size={15} />{exporting ? 'Lädt …' : 'CSV exportieren'}</button></div>
    <p className="fineprint">Jede Ausleihe bleibt erhalten – auch nach der Rückgabe. Der CSV-Export enthält die gesamte Historie.</p>
    <div className="tab-bar history-tabs"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Alle Ausleihen ({data.loans.length})</button><button aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Noch offen ({active.length})</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {loans.length ? <ol className="loan-list">{loans.map(loan => <li key={loan.loanId}>
      <div className="loan-heading"><strong>{loan.name}</strong><span className={`loan-status ${loan.status}`}>{statusText[loan.status]}</span></div>
      <p>{loan.cupId} <span>· {formatEuro(loan.depositAtomic)} Pfand</span></p>
      <dl><div><dt>Ausgeliehen</dt><dd>{date(loan.borrowedAt)}<span>{site(loan.borrowLocation)}</span></dd></div>
        <div><dt>Rückgabe</dt><dd>{loan.returnedAt ? <>{date(loan.returnedAt)}<span>{site(loan.returnLocation)}</span></> : loan.status === 'refund_pending' ? <>Bestätigung läuft<span>{site(loan.returnLocation)}</span></> : 'Noch nicht zurückgegeben'}</dd></div></dl>
    </li>)}</ol> : <p className="wallet-empty">{filter === 'active' ? 'Alle Becher sind zurück im Kreislauf.' : 'Noch keine Becher ausgeliehen.'}</p>}
  </section>;
}
