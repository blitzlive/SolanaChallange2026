import { ArrowUpRight, Check, Clock, RotateCcw } from 'lucide-react';
import type { Receipt } from '../shared/model';
import { locations } from '../shared/model';

export function ReceiptCard({ receipt, onRefresh, busy }: { receipt: Receipt; onRefresh: () => void; busy: boolean }) {
  const returned = receipt.status === 'returned';
  const pending = receipt.status === 'reserved' || receipt.status === 'refund_pending';
  const signature = returned ? receipt.refundSignature : receipt.depositSignature;
  return <section className={`receipt ${returned ? 'returned' : ''}`} aria-label="Pfandbeleg">
    <div className="receipt-heading"><span className="receipt-icon">{pending ? <Clock size={22} /> : <Check size={22} />}</span>
      <div><span className="eyebrow">DEIN PFANDBELEG</span><h3>{returned ? 'Der Kreis ist geschlossen.' : receipt.status === 'reserved' ? 'Zahlung noch offen.' : receipt.status === 'refund_pending' ? 'Rückzahlung wird bestätigt.' : 'Dein Becher. Dein Pfand.'}</h3></div></div>
    <dl><div><dt>Behälter</dt><dd>{receipt.cupId}</dd></div><div><dt>{returned ? 'Zurückgezahlt' : 'Pfandbetrag'}</dt><dd>3,00 {receipt.mode === 'demo' ? 'Demo-USDC' : 'Test-USDC'}</dd></div>
      <div><dt>{returned ? 'Rückgabestelle' : 'Ausgabestelle'}</dt><dd>{locations.find(l => l.id === (receipt.returnLocation ?? receipt.borrowLocation))?.name}</dd></div>
      <div><dt>Empfänger</dt><dd className="address" title={receipt.payer}>{receipt.mode === 'demo' ? 'Deine Demo-Wallet' : `${receipt.payer.slice(0, 8)}…${receipt.payer.slice(-6)}`}</dd></div></dl>
    <p className="fineprint">{receipt.mode === 'demo' ? 'Simulierter Beleg. Es wurde kein Geld bewegt.' : 'Testgeld auf Solana Devnet. Verwahrung durch die Betreiber-Wallet.'}</p>
    <div className="receipt-actions"><button className="text-button" onClick={onRefresh} disabled={busy}><RotateCcw size={14} /> Status aktualisieren</button>
      {signature && <a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">Transaktion <ArrowUpRight size={14} /></a>}</div>
    <details><summary>Beleg-ID für Wiederherstellung</summary><code>{receipt.id}</code><p className="fineprint">Privat aufbewahren: Diese ID erlaubt den Zugriff auf deinen Beleg.</p></details>
  </section>;
}
