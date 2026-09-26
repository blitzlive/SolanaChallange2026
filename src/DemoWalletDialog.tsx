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
      if (current === generation.current) setError('Die Demo-Wallet konnte nicht geladen werden. Bitte erneut versuchen.');
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
    <button className="dialog-close" aria-label="Wallet schließen" onClick={onClose}><X size={22} /></button>
    <span className="eyebrow"><Wallet size={15} /> DEIN DEMO-KREISLAUF</span>
    <h2 id="wallet-title">Deine Demo-Wallet.</h2>
    <p className="wallet-description">Dein Pfand bleibt deins. Hier siehst du, was verfügbar ist und was gerade mit deinen Behältern unterwegs ist.</p>
    {loading && <p className="wallet-loading" role="status"><LoaderCircle className="spin" size={17} /> Wallet wird aktualisiert …</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {data && !loading && !error && <>
      <p className="wallet-identity"><span>Deine Nutzer-ID</span><code>{data.userId}</code></p>
      <section className="wallet-balance" aria-label="Verfügbares Demo-Guthaben"><span>Verfügbares Demo-Guthaben</span><strong>{formatEuro(data.availableAtomic)}</strong>
        <SolEstimate amount={data.availableAtomic} />
        <div><span>Im Pfand gebunden</span><b>{formatEuro(data.heldAtomic)}</b></div>
      </section>
      <p className="wallet-disclaimer">{formatEuro(data.initialAtomic)} simuliertes Startguthaben · Kein echtes Geld. Nach Bestätigung durch das Geschäft wird dein hinterlegter Betrag wieder frei.</p>
      <WalletLoans data={data} />
      <h3>Deine Pfandbewegungen</h3>
      {data.history.length === 0 ? <div className="wallet-empty"><RefreshCw size={24} /><p>Noch keine Pfandbewegungen.</p><span>Leihe deinen ersten Behälter aus — der Betrag erscheint dann hier.</span></div> :
        <ol className="wallet-history">{data.history.map(entry => <li key={`${entry.receiptId}:${entry.kind}`}>
          <span className={`movement-icon ${entry.kind}`}>{entry.kind === 'refund' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
          <div><strong>{entry.kind === 'refund' ? 'Pfand zurück' : 'Pfand hinterlegt'}</strong><span>{entry.cupId} · {new Date(entry.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
          <b>{entry.kind === 'refund' ? '+' : '−'}{formatEuro(entry.amountAtomic)}<small>Simulation</small></b>
        </li>)}</ol>}
    </>}
    <button className="secondary wallet-refresh" disabled={loading} onClick={() => void refresh()}><span>Guthaben aktualisieren</span><RefreshCw size={16} /></button>
    <p className="fineprint">Deine Demo-Wallet ist in diesem Browser gespeichert. Gelöschte Browserdaten oder ein anderer Browser erzeugen eine neue Demo-Wallet.</p>
  </dialog>;
}
