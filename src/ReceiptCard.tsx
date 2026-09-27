import { ArrowUpRight, Check, Clock, RotateCcw } from 'lucide-react';
import type { Receipt } from '../shared/model';
import { formatEuro, formatUsdc, locations } from '../shared/model';

export function ReceiptCard({ receipt, onRefresh, busy }: { receipt: Receipt; onRefresh: () => void; busy: boolean }) {
  const returned = receipt.status === 'returned';
  const pending = receipt.status === 'reserved' || receipt.status === 'refund_pending';
  const signature = returned ? receipt.refundSignature : receipt.depositSignature;
  return <section className={`receipt ${returned ? 'returned' : ''}`} aria-label="Deposit Receipt">
    <div className="receipt-heading"><span className="receipt-icon">{pending ? <Clock size={22} /> : <Check size={22} />}</span>
      <div><span className="eyebrow">DEPOSIT RECEIPT</span><h3>{returned ? 'The loop is closed. Deposit refunded.' : receipt.status === 'reserved' ? 'Payment pending confirmation.' : receipt.status === 'refund_pending' ? 'Refund in progress.' : 'Cup borrowed. Deposit held.'}</h3></div></div>
    <dl><div><dt>Container</dt><dd>{receipt.cupId}</dd></div><div><dt>{returned ? 'Refunded' : 'Deposit Amount'}</dt><dd>{receipt.mode === 'demo' ? `${formatEuro(receipt.depositAtomic)} · MVP` : `${formatUsdc(receipt.depositAtomic)} Test-USDC`}</dd></div>
      <div><dt>{returned ? 'Return Station' : 'Issue Station'}</dt><dd>{locations.find(l => l.id === (receipt.returnLocation ?? receipt.borrowLocation))?.name}</dd></div>
      <div><dt>Recipient</dt><dd className="address" title={receipt.payer}>{receipt.mode === 'demo' ? `Member (${receipt.payer.slice(0, 12)}…)` : `${receipt.payer.slice(0, 8)}…${receipt.payer.slice(-6)}`}</dd></div></dl>
    <p className="fineprint">{receipt.mode === 'demo' ? 'MVP test receipt. Simulation on local ledger.' : 'Solana Devnet test tokens. Custody held by operator wallet.'}</p>
    <div className="receipt-actions"><button className="text-button" onClick={onRefresh} disabled={busy}><RotateCcw size={14} /> Refresh status</button>
      {signature && <a href={`https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`} target="_blank" rel="noreferrer" title="View Proof of Identity on Solana Mainnet Beta Explorer">View on Solana Explorer (Mainnet Beta) <ArrowUpRight size={14} /></a>}</div>
    <details><summary>Receipt ID for recovery</summary><code>{receipt.id}</code><p className="fineprint">Keep private: this ID allows recovery of your receipt.</p></details>
  </section>;
}

