import { useState } from 'react';
import { Download } from 'lucide-react';
import { formatEuro, locations, type DemoWallet, type Status } from '../shared/model';
import { getDemoIdentity } from './api';

const statusText: Record<Status, string> = { reserved: 'Payment Pending', borrowed: 'With You', refund_pending: 'Refund Processing', returned: 'Returned' };
const date = (value: string) => new Date(value).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
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
      const link = document.createElement('a'); link.href = url; link.download = 'pfandloop-cup-history.csv';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Could not download CSV export. Please try again.'); }
    finally { setExporting(false); }
  }
  return <section className="wallet-loans" aria-label="Cup History">
    <div className="history-heading"><h3>Active & Past Containers.</h3><button className="text-button" disabled={exporting} onClick={() => void download()}><Download size={15} />{exporting ? 'Downloading …' : 'Export CSV'}</button></div>
    <p className="fineprint">Every container borrow is permanently logged. The CSV export contains your complete history.</p>
    <div className="tab-bar history-tabs"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All Containers ({data.loans.length})</button><button aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Currently Held ({active.length})</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {loans.length ? <ol className="loan-list">{loans.map(loan => <li key={loan.loanId}>
      <div className="loan-heading"><strong>{loan.name}</strong><span className={`loan-status ${loan.status}`}>{statusText[loan.status]}</span></div>
      <p>{loan.cupId} <span>· {formatEuro(loan.depositAtomic)} Deposit</span></p>
      <dl><div><dt>Borrowed</dt><dd>{date(loan.borrowedAt)}<span>{site(loan.borrowLocation)}</span></dd></div>
        <div><dt>Return</dt><dd>{loan.returnedAt ? <>{date(loan.returnedAt)}<span>{site(loan.returnLocation)}</span></> : loan.status === 'refund_pending' ? <>Confirmation pending<span>{site(loan.returnLocation)}</span></> : 'In circulation with you'}</dd></div></dl>
    </li>)}</ol> : <p className="wallet-empty">{filter === 'active' ? 'All containers have been returned to the loop.' : 'No containers borrowed yet.'}</p>}
  </section>;
}
