import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Coffee, Leaf, LoaderCircle, MapPin, QrCode, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { BorrowResult, LocationId, PublicConfig, Receipt } from '../shared/model';
import { cupIdSchema, loanIdSchema } from '../shared/model';
import { confirmPayment, getConfig, getReceipt, readSaved, request, save } from './api';
import { connectWallet, pay } from './wallet';
import { CupArt } from './CupArt';
import { ReceiptCard } from './ReceiptCard';

export function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [view, setView] = useState<'borrow' | 'return'>('borrow');
  const [cupId, setCupId] = useState(() => cupIdSchema.safeParse(new URLSearchParams(location.search).get('cup')).data ?? 'LOOP-001');
  const [site, setSite] = useState<LocationId>('cafe');
  const [result, setResult] = useState<BorrowResult | null>(null);
  const [signature, setSignature] = useState('');
  const [wallet, setWallet] = useState('');
  const [merchantToken, setMerchantToken] = useState('');
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qr, setQr] = useState('');
  const [recoverId, setRecoverId] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = config?.cups.find(c => c.id === cupId);
  const demo = config?.mode === 'demo';
  const isOpen = result?.receipt.cupId === cupId && result.receipt.status !== 'returned';

  async function reload() { setConfig(await getConfig()); }
  function remember(next: BorrowResult) {
    setResult(next);
    save('receipt', { id: next.receipt.id, mode: next.receipt.mode });
  }
  useEffect(() => {
    let cancelled = false;
    getConfig().then(async next => {
      if (cancelled) return;
      setConfig(next);
      const saved = readSaved<{ id: string; mode: string }>('receipt');
      if (saved?.mode === next.mode && loanIdSchema.safeParse(saved.id).success) {
        const restored = await getReceipt(saved.id);
        if (cancelled) return;
        setResult(restored);
        setSignature(readSaved<string>(`signature:${saved.id}`) ?? '');
      }
    }).catch(() => { if (!cancelled) setError('Verbindung oder gespeicherter Beleg nicht verfügbar. Bitte neu laden.'); });
    return () => { cancelled = true; };
  }, []);

  async function action(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Etwas ist schiefgegangen. Bitte erneut versuchen.'); }
    finally { setBusy(false); busyRef.current = false; }
  }
  async function refreshReceipt() {
    if (result) remember(await getReceipt(result.receipt.id));
    await reload();
  }
  async function borrow() {
    let payer = wallet;
    if (demo) {
      payer = readSaved<string>('demo-wallet') ?? `demo-${crypto.randomUUID()}`;
      save('demo-wallet', payer);
    } else { payer = await connectWallet(); setWallet(payer); }
    const next = await request<BorrowResult>('/loans', { cupId, payer, location: site });
    remember(next);
    setSignature('');
    await reload();
    if (next.transaction) await signDeposit(next);
    else setNotice('Demo-Pfand hinterlegt. Du kannst den Behälter jetzt zurückgeben.');
  }
  async function signDeposit(next: BorrowResult) {
    if (!next.transaction) return;
    const payer = await connectWallet(); setWallet(payer);
    const sig = await pay(next.transaction, next.receipt.payer);
    setSignature(sig); save(`signature:${next.receipt.id}`, sig);
    setNotice('Gesendet. Nach der Finalisierung mit „Zahlung prüfen“ bestätigen. Nicht erneut bezahlen.');
  }
  async function confirm() {
    if (!result) return;
    const updated = await confirmPayment(result.receipt.id, signature.trim());
    remember({ receipt: updated }); await reload(); setNotice('Pfand auf Devnet bestätigt. Dein Behälter ist ausgeliehen.');
  }
  async function returnCup() {
    const parsed = cupIdSchema.parse(cupId);
    const retry = result?.receipt.cupId === parsed && result.receipt.status === 'refund_pending';
    const path = retry ? `/loans/${result!.receipt.id}/refund` : `/returns/${parsed}`;
    const updated = await request<Receipt>(path, { location: site, physicallyReceived: received }, merchantToken);
    remember({ receipt: updated }); await reload();
    setNotice(updated.status === 'returned' ? 'Rückgabe abgeschlossen. Danke, dass du den Kreislauf schließt.' : 'Rückzahlung gesendet. Mit „Rückzahlung prüfen“ später final bestätigen.');
  }
  async function showQr() {
    const url = new URL(location.origin); url.searchParams.set('cup', cupId);
    setQr(await QRCode.toDataURL(url.toString(), { width: 256, margin: 2, color: { dark: '#173f35', light: '#ffffff' } }));
    dialog.current?.showModal();
  }
  function switchView(next: 'borrow' | 'return') {
    setView(next); setError(''); setNotice(''); setReceived(false);
    if (next === 'return') setSite('festival'); else setSite('cafe');
    if (result && next === 'return') setCupId(result.receipt.cupId);
  }

  return <>
    <div className="mode-strip"><span className="status-dot" />{config ? demo ? 'INTERAKTIVE DEMO' : 'SOLANA DEVNET' : 'VERBINDUNG WIRD AUFGEBAUT'}<span className="strip-divider">/</span><span>{demo ? 'Ausprobieren. Ohne Wallet. Ohne echtes Geld.' : 'Nur Test-USDC · Betreiber-Wallet · kein Smart-Contract-Escrow'}</span></div>
    <header className="header"><a className="brand" href="/" aria-label="PfandLoop Startseite"><RefreshCw size={26} strokeWidth={2.6} />pfandloop<span className="brand-dot">.</span></a>
      <nav aria-label="Hauptnavigation"><button className={view === 'borrow' ? 'nav-active' : ''} onClick={() => switchView('borrow')} disabled={busy}>Ausleihen</button><button className={view === 'return' ? 'nav-active' : ''} onClick={() => switchView('return')} disabled={busy}>Rückgabe</button><a href="#how">So funktioniert’s <ArrowUpRight size={13} /></a></nav>
      <button className="wallet-button" disabled={busy || !config} onClick={() => action(async () => {
        if (demo) { setNotice('Der Demo-Modus verwendet eine simulierte Wallet. Dafür brauchst du keine Erweiterung.'); return; }
        setWallet(await connectWallet());
      })}><Wallet size={17} /><span>{demo ? 'Demo-Wallet' : wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : 'Wallet verbinden'}</span></button>
    </header>

    <main>
      <div className="page-meta"><span><span className="mini-loop">↻</span> WENIGER EINWEG. MEHR KREISLAUF.</span><span className="pilot-tag">PILOT / 001</span></div>
      <section className="workspace">
        <div className="story"><div className="eyebrow"><Leaf size={15} /> MEHRWEG, WEITERGEDACHT</div>
          <h1>{view === 'borrow' ? <>Dein Kaffee geht.<br />Der Becher <em>bleibt.</em></> : <>Becher zurück.<br />Pfand <em>auch.</em></>}</h1>
          <p className="intro">{view === 'borrow' ? 'Nimm deinen Lieblingsmoment mit. Gib den Behälter an einer teilnehmenden Stelle zurück — dein Pfand findet zu dir zurück.' : 'Einmal zurückgeben, wieder im Kreislauf. Die Rückgabestelle bestätigt den Behälter. Das Pfand geht an die ursprüngliche Wallet.'}</p>
          <div className="benefits"><span><Check size={15} /> Keine PfandLoop-App</span><span><Check size={15} /> Rückgabe im ganzen Pilot</span></div>
          <div className="illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <span className="illustration-caption">DESIGNED TO<br /><strong>go around.</strong></span>
            <div className="hero-cup"><CupArt color={selected?.color} bowl={cupId === 'LOOP-003'} /></div>
            <div className="floating-label"><RefreshCw size={19} /><div>Immer wieder.<span>Ein guter Kreislauf.</span></div></div>
            <span className="cup-reference">PFANDLOOP COLLECTION — {cupId.slice(-3)}</span>
          </div>
        </div>

        <div className="transaction-column">
          <section className="transaction-card" aria-label={view === 'borrow' ? 'Behälter ausleihen' : 'Behälter zurückgeben'}>
            <div className="card-top"><span className="eyebrow">{view === 'borrow' ? 'DEIN NÄCHSTER KREISLAUF' : 'RÜCKGABESTATION'}</span><span className="step-label">{view === 'borrow' ? '01 / 02' : '02 / 02'}</span></div>
            <h2>{view === 'borrow' ? 'Einmal mitnehmen, bitte.' : 'Schließen wir den Kreis.'}</h2>
            <p className="card-description">{view === 'borrow' ? 'Wähle deinen Behälter oder öffne seinen QR-Code.' : 'Für Mitarbeitende: Behälter entgegennehmen und bestätigen.'}</p>
            <div className="tab-bar"><button onClick={() => switchView('borrow')} aria-pressed={view === 'borrow'} disabled={busy}><Coffee size={16} /> Ausleihen</button><button onClick={() => switchView('return')} aria-pressed={view === 'return'} disabled={busy}><ArrowDownLeft size={17} /> Zurückgeben</button></div>
            {!config ? <div className="loading-state"><LoaderCircle className="spin" /> Behälter werden geladen …<button className="text-button" onClick={() => action(reload)}>Erneut laden</button></div> : <>
              {view === 'borrow' && <div className="cup-options" aria-label="Behälter auswählen">{config.cups.map(cup => <button key={cup.id} className={`cup-option ${cupId === cup.id ? 'selected' : ''}`} onClick={() => { setCupId(cup.id); setError(''); }} disabled={busy} aria-pressed={cupId === cup.id} aria-label={`${cup.name}, ${cup.id}`}>
                <CupArt color={cup.color} bowl={cup.id === 'LOOP-003'} small /><span>{cup.id === 'LOOP-001' ? 'Kaffee' : cup.id === 'LOOP-002' ? 'Festival' : 'Lunch'}</span><small>{cup.status === 'available' ? 'Verfügbar' : cup.status === 'reserved' ? 'Reserviert' : 'Unterwegs'}</small>{cupId === cup.id && <Check className="selection-check" size={14} />}</button>)}</div>}
              <div className="field-row"><div className="field"><label htmlFor="cup">Behälter-Nummer</label><div className="input-with-icon"><input id="cup" value={cupId} maxLength={20} onChange={e => { setCupId(e.target.value.toUpperCase()); setReceived(false); }} disabled={busy} spellCheck={false} /><button title="Behälter-QR-Code anzeigen" aria-label="Behälter-QR-Code anzeigen" disabled={!selected || busy} onClick={() => action(showQr)}><QrCode size={19} /></button></div></div>
                <div className="field"><label htmlFor="site">{view === 'borrow' ? 'Du bist hier' : 'Rückgabe bei'}</label><div className="select-wrapper"><MapPin size={15} /><select id="site" value={site} disabled={busy} onChange={e => setSite(e.target.value as LocationId)}>{config.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><ChevronDown size={13} /></div></div></div>
              <div className="deposit-summary"><div><span>{view === 'borrow' ? 'Dein rückzahlbares Pfand' : 'Zurück an die ursprüngliche Wallet'}</span><p>{selected?.name ?? 'Behälter prüfen'}{view === 'borrow' && selected ? ` · ${selected.size}` : ''}</p></div><strong>3,00<small>{demo ? 'DEMO-USDC' : 'TEST-USDC'}</small></strong></div>
              {view === 'return' && <div className="staff-fields">{demo ? <p className="demo-staff"><CircleHelp size={16} /> Demo: Du übernimmst jetzt die Rolle der Rückgabestelle.</p> : <div className="field"><label htmlFor="token">Betreiber-Schlüssel</label><input id="token" type="password" value={merchantToken} onChange={e => setMerchantToken(e.target.value)} autoComplete="off" placeholder="Nur für autorisierte Mitarbeitende" /></div>}
                <label className="checkbox"><input type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} disabled={busy} /><span>Ich habe den richtigen Behälter physisch entgegengenommen.</span></label></div>}
              {view === 'borrow' && isOpen && result?.receipt.status === 'reserved' ? <div className="pending-payment"><p>Dein Beleg ist reserviert. Eine gesendete Zahlung nur prüfen, nicht erneut bezahlen.</p>
                {!signature && <button className="primary" disabled={busy} onClick={() => action(() => signDeposit(result))}>Mit Phantom bezahlen <Wallet size={17} /></button>}
                <label htmlFor="signature">Transaktionssignatur</label><input id="signature" value={signature} onChange={e => setSignature(e.target.value)} placeholder="Signatur aus Phantom" />
                <button className="secondary" disabled={busy || !signature} onClick={() => action(confirm)}>Zahlung prüfen <RefreshCw size={16} /></button>
              </div> : <button className="primary" disabled={busy || !selected || (view === 'borrow' ? selected.status !== 'available' : !received || selected.status === 'available' || (!demo && !merchantToken))} onClick={() => action(view === 'borrow' ? borrow : returnCup)}>
                <span>{busy ? 'Einen Moment …' : !selected ? 'Gültige Behälter-Nummer eingeben' : view === 'borrow' ? selected.status !== 'available' ? 'Behälter bereits unterwegs' : demo ? 'Pfand hinterlegen · Demo starten' : '3 Test-USDC hinterlegen' : result?.receipt.status === 'refund_pending' ? 'Rückzahlung prüfen' : 'Rückgabe bestätigen'}</span>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={19} />}</button>}
              <p className="payment-note"><ShieldCheck size={14} />{demo ? 'Reine Simulation. Keine Zahlung, kein Wallet-Zugriff.' : 'Devnet-Testgeld. SOL-Gebühren zusätzlich. Kein EUR-Betrag.'}</p>
            </>}
          </section>
          <div className="feedback" aria-live="polite">{error && <div className="error" role="alert">{error}</div>}{notice && <div className="notice"><Check size={17} />{notice}</div>}</div>
          {result && <ReceiptCard receipt={result.receipt} busy={busy} onRefresh={() => action(refreshReceipt)} />}
          <details className="recovery"><summary>Du hast schon einen Pfandbeleg?</summary><label htmlFor="recover">Beleg-ID</label><div className="recovery-row"><input id="recover" value={recoverId} onChange={e => setRecoverId(e.target.value)} placeholder="Beleg-ID einfügen" /><button className="secondary" disabled={busy || !recoverId} onClick={() => action(async () => {
            const id = loanIdSchema.parse(recoverId.trim()); const restored = await getReceipt(id); remember(restored); setCupId(restored.receipt.cupId); setSignature(readSaved<string>(`signature:${id}`) ?? '');
          })}>Öffnen</button></div></details>
        </div>
      </section>

      <section className="how" id="how"><div className="how-title"><span className="eyebrow">SO EINFACH GEHT MEHRWEG</span><h2>Drei Schritte. Ein Kreislauf.</h2></div><div className="how-steps">
        <article><span className="step-number">01</span><h3>Mitnehmen.</h3><p>QR-Code mit deiner Handykamera öffnen oder Behälter-Nummer eingeben. Pfand hinterlegen.</p></article>
        <article><span className="step-number">02</span><h3>Genießen.</h3><p>Kaffee, Festival, Mittagspause. Dein Beleg hält fest, welcher Behälter zu deinem Pfand gehört.</p></article>
        <article><span className="step-number">03</span><h3>Weitergeben.</h3><p>An einer Pilot-Stelle abgeben. Nach Bestätigung geht das Pfand an die ursprüngliche Wallet zurück.</p></article>
      </div></section>
      <section className="pilot"><div><MapPin size={19} /><span>Ein kleiner Pilot. Ein gemeinsamer Kreislauf.</span></div><p>Café Morgenrot + Wiesenklang Festival <span>Fiktive Demo-Standorte</span></p></section>
    </main>
    <footer><a className="brand" href="/"><RefreshCw size={19} />pfandloop.</a><span>Wiederverwenden fühlt sich besser an.</span><a href="https://solana.com" target="_blank" rel="noreferrer">Built for Solana <ArrowUpRight size={14} /></a></footer>
    <dialog ref={dialog} className="qr-dialog"><button className="dialog-close" aria-label="QR-Code schließen" onClick={() => dialog.current?.close()}><X size={22} /></button><span className="eyebrow">DEIN BEHÄLTER-LINK</span><h2>{cupId}</h2>{qr && <img src={qr} width="256" height="256" alt={`QR-Code zum Öffnen von ${cupId}`} />}<p>Mit der Handykamera öffnen. Der Code identifiziert den Behälter und autorisiert keine Rückzahlung.</p><p className="fineprint">Auf localhost funktioniert dieser Link nur auf diesem Computer. Für einen Handy-Test braucht die App eine erreichbare HTTPS-Adresse.</p><button className="primary" onClick={() => dialog.current?.close()}>Verstanden <Check size={17} /></button></dialog>
  </>;
}
