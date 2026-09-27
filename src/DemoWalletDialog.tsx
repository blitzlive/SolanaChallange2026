import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, RefreshCw, Wallet, X } from 'lucide-react';
import { formatEuro, type DemoWallet } from '../shared/model';
import { getDemoIdentity, request } from './api';
import { WalletLoans } from './WalletLoans';
import { SolEstimate } from './SolEstimate';

export function DemoWalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<DemoWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const next = await request<DemoWallet>('/demo-wallet', undefined, getDemoIdentity());
      if (current === generation.current) setData(next);
    } catch {
      if (current === generation.current) setError('The MVP wallet could not be loaded. Please try again.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    void refresh();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; generation.current++; };
  }, [open, refresh]);

  return <dialog className="wallet-dialog" ref={dialog} onClose={onClose} aria-labelledby="wallet-title">
    <button className="dialog-close" aria-label="Close Wallet" onClick={onClose}><X size={22} /></button>
    <span className="eyebrow"><Wallet size={15} /> YOUR MVP LOOP</span>
    <h2 id="wallet-title">Your MVP Wallet.</h2>
    <p className="wallet-description">Your deposit always stays yours. Track available balance, active containers in circulation, and recent movements.</p>
    {loading && <p className="wallet-loading" role="status"><LoaderCircle className="spin" size={17} /> Updating wallet …</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {data && !loading && !error && <>
      <p className="wallet-identity"><span>Member ID</span><code>{data.userId}</code></p>
      <section className="wallet-balance" aria-label="Available Balance"><span>Available Balance</span><strong>{formatEuro(data.availableAtomic)}</strong>
        <SolEstimate amount={data.availableAtomic} />
        <div><span>Held in Deposits</span><b>{formatEuro(data.heldAtomic)}</b></div>
      </section>
      <p className="wallet-disclaimer">{formatEuro(data.initialAtomic)} initial balance · After return confirmation by any partner merchant, your deposit is refunded immediately.</p>
      <WalletLoans data={data} />
      <h3>Deposit Movements</h3>
      {data.history.length === 0 ? <div className="wallet-empty"><RefreshCw size={24} /><p>No deposit movements yet.</p><span>Receive your first container at any partner store to see your transactions here.</span></div> :
        <ol className="wallet-history">{data.history.map(entry => <li key={`${entry.receiptId}:${entry.kind}`}>
          <span className={`movement-icon ${entry.kind}`}>{entry.kind === 'refund' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
          <div><strong>{entry.kind === 'refund' ? 'Deposit Refunded' : 'Deposit Debited'}</strong><span>{entry.cupId} · {new Date(entry.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
          <b>{entry.kind === 'refund' ? '+' : '−'}{formatEuro(entry.amountAtomic)}<small>MVP</small></b>
        </li>)}</ol>}
    </>}
    <button className="secondary wallet-refresh" disabled={loading} onClick={() => void refresh()}><span>Refresh Balance</span><RefreshCw size={16} /></button>
    <p className="fineprint">Your MVP wallet is saved in this browser. You can switch test members or connect a Solana Phantom wallet.</p>
  </dialog>;
}
