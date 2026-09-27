import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Download, Globe, Layers, Leaf, LoaderCircle, LogOut, MapPin, QrCode, RefreshCw, Send, ShieldCheck, Store, User, Users, Wallet, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { BorrowResult, Cup, DemoWallet, LocationId, MerchantSession, PublicConfig, Receipt, UserSession } from '../shared/model';
import { cupIdSchema, formatEuro, formatUsdc, isCupAllowedForLocation, loanIdSchema, MVP_USERS } from '../shared/model';
import { confirmPayment, getActiveLoans, getConfig, getDemoIdentity, getReceipt, readSaved, request, save, setDemoIdentity } from './api';
import { connectWallet, pay } from './wallet';
import { CupArt } from './CupArt';
import { Hero3DLoop } from './Hero3DLoop';
import { ReceiptCard } from './ReceiptCard';
import { MerchantLogin } from './MerchantLogin';
import { UserLogin } from './UserLogin';
import { SolEstimate } from './SolEstimate';

export function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const view = location.pathname.replace(/\/$/, '') === '/geschaeft' ? 'merchant' : 'dashboard';

  // Customer / User Authentication State
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const raw = localStorage.getItem('pfandloop_user_session');
      return raw ? (JSON.parse(raw) as UserSession) : null;
    } catch {
      return null;
    }
  });

  // Member / Customer State
  const [activeUserId, setActiveUserId] = useState<string>(() => userSession?.user.id ?? getDemoIdentity());
  const [walletData, setWalletData] = useState<DemoWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [wallet, setWallet] = useState('');
  const [memberQr, setMemberQr] = useState('');
  const [loanFilter, setLoanFilter] = useState<'all' | 'active'>('active');
  const [exportingCsv, setExportingCsv] = useState(false);

  // Merchant State
  const [merchantSession, setMerchantSession] = useState<MerchantSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('pfandloop_merchant_session');
      return raw ? (JSON.parse(raw) as MerchantSession) : null;
    } catch {
      return null;
    }
  });
  const [merchantTab, setMerchantTab] = useState<'issue' | 'return'>('issue');
  const [site, setSite] = useState<LocationId>(() => merchantSession?.location ?? 'cafe');
  const [issueCupId, setIssueCupId] = useState<string>('LOOP-001');
  const [issueUserId, setIssueUserId] = useState<string>(activeUserId);
  const [returnCupId, setReturnCupId] = useState<string>('LOOP-001');
  const [returnUserId, setReturnUserId] = useState<string>(activeUserId);
  const [received, setReceived] = useState(false);

  // Infinite Issuance & Multi-User State
  const [issueMode, setIssueMode] = useState<'single' | 'multiple'>('single');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([MVP_USERS[0].id]);
  const [quantityPerUser, setQuantityPerUser] = useState<number>(1);
  const [batchSummary, setBatchSummary] = useState<{ cupId: string; userName: string; deposit: number; signature: string | null }[]>([]);
  const [activeLoansCatalog, setActiveLoansCatalog] = useState<Receipt[]>([]);

  // Common UI State
  const [result, setResult] = useState<BorrowResult | null>(null);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cupQr, setCupQr] = useState('');
  const [activeQrCupId, setActiveQrCupId] = useState('LOOP-001');
  const [recoverId, setRecoverId] = useState('');
  const qrDialog = useRef<HTMLDialogElement>(null);

  const demo = config?.mode === 'demo';
  const merchantLocation = merchantSession?.location ?? site;
  const allowedCups = config?.cups.filter(c => isCupAllowedForLocation(c.id, merchantLocation)) ?? [];
  const selectedIssueCup = config?.cups.find(c => c.id === issueCupId) ?? allowedCups[0];
  const selectedReturnCup = config?.cups.find(c => c.id === returnCupId);
  const activeMember = MVP_USERS.find(u => u.id === activeUserId) ?? { id: activeUserId, name: 'Custom Member', username: 'member.sol' };

  async function reloadConfig() {
    setConfig(await getConfig());
  }

  async function loadActiveLoansList() {
    try {
      const active = await getActiveLoans();
      setActiveLoansCatalog(active);
    } catch {
      // Ignore background errors
    }
  }

  async function loadUserWallet(userId: string) {
    setWalletLoading(true);
    try {
      const data = await request<DemoWallet>('/demo-wallet', undefined, userId);
      setWalletData(data);
    } catch {
      // Wallet may be empty or offline
    } finally {
      setWalletLoading(false);
    }
  }

  function handleSwitchUser(userId: string) {
    const targetMember = MVP_USERS.find(u => u.id === userId) ?? { id: userId, name: 'Custom Member', username: 'member.sol' };
    setDemoIdentity(userId);
    setActiveUserId(userId);
    setIssueUserId(userId);
    setReturnUserId(userId);
    setUserSession(prev => {
      if (!prev) return null;
      const updated: UserSession = {
        ...prev,
        user: targetMember,
      };
      localStorage.setItem('pfandloop_user_session', JSON.stringify(updated));
      return updated;
    });
    void loadUserWallet(userId);
  }

  function handleUserLoginSuccess(session: UserSession) {
    setUserSession(session);
    localStorage.setItem('pfandloop_user_session', JSON.stringify(session));
    handleSwitchUser(session.user.id);
    setNotice(`Welcome back, ${session.user.name}!`);
  }

  function handleUserLogout() {
    setUserSession(null);
    localStorage.removeItem('pfandloop_user_session');
    setWalletData(null);
    setNotice('You have been signed out of your customer wallet.');
  }

  function handleMerchantLoginSuccess(session: MerchantSession) {
    setMerchantSession(session);
    sessionStorage.setItem('pfandloop_merchant_session', JSON.stringify(session));
    setSite(session.location);
    const firstAllowed = config?.cups.find(c => isCupAllowedForLocation(c.id, session.location));
    if (firstAllowed) setIssueCupId(firstAllowed.id);
    setResult(null);
    setReceived(false);
    setBatchSummary([]);
    void loadActiveLoansList();
    setNotice(`Logged in to ${config?.locations.find(l => l.id === session.location)?.name}`);
  }

  function handleMerchantLogout() {
    action(async () => {
      if (merchantSession) {
        try { await request('/merchant/logout', {}, merchantSession.token); } catch {}
      }
      setMerchantSession(null);
      sessionStorage.removeItem('pfandloop_merchant_session');
      setResult(null);
      setBatchSummary([]);
      setNotice('Signed out of partner merchant station.');
    });
  }

  useEffect(() => {
    let cancelled = false;
    getConfig().then(async next => {
      if (cancelled) return;
      setConfig(next);
      await loadUserWallet(activeUserId);
      await loadActiveLoansList();

      // Generate Member QR Code
      const qrData = await QRCode.toDataURL(activeUserId, {
        width: 180,
        margin: 2,
        color: { dark: '#173f35', light: '#ffffff' },
      });
      if (!cancelled) setMemberQr(qrData);

      const saved = readSaved<{ id: string; mode: string }>('receipt');
      if (saved?.mode === next.mode && loanIdSchema.safeParse(saved.id).success) {
        const restored = await getReceipt(saved.id);
        if (cancelled) return;
        setResult(restored);
        setSignature(readSaved<string>(`signature:${saved.id}`) ?? '');
      }
    }).catch(() => {
      if (!cancelled) setError('Could not connect to service. Please refresh.');
    });

    return () => { cancelled = true; };
  }, [activeUserId]);

  // Ensure current issueCupId is valid for merchant station
  useEffect(() => {
    if (merchantSession && allowedCups.length > 0) {
      if (!allowedCups.some(c => c.id === issueCupId)) {
        setIssueCupId(allowedCups[0].id);
      }
    }
  }, [merchantSession?.location, allowedCups]);

  async function action(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  // Merchant issues cup(s) to member(s) (Ausgabe) - Supports infinite cups and multiple users simultaneously!
  async function handleMerchantIssue() {
    if (!merchantSession) throw new Error('Please sign in to the merchant station.');
    const baseCup = selectedIssueCup?.id ?? 'LOOP-001';

    // Verify location restriction
    if (!isCupAllowedForLocation(baseCup, merchantSession.location)) {
      throw new Error(`This container type is not permitted for issuance at ${merchantSession.location}.`);
    }

    const recipients = issueMode === 'multiple' ? selectedUserIds : [issueUserId.trim()];
    if (recipients.length === 0) throw new Error('Please select at least one recipient customer.');

    const issuedItems: { cupId: string; userName: string; deposit: number; signature: string | null }[] = [];
    let lastResult: BorrowResult | null = null;

    for (const recipientId of recipients) {
      const userObj = MVP_USERS.find(u => u.id === recipientId);
      const recipientName = userObj ? userObj.name : `User (${recipientId.slice(0, 10)}…)`;

      for (let i = 0; i < quantityPerUser; i++) {
        // Generate unique instance ID so infinitely many cups can be in circulation
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const instanceCupId = `${baseCup}-${randomSuffix}`;

        const next = await request<BorrowResult>('/loans', {
          cupId: instanceCupId,
          payer: recipientId,
          location: merchantSession.location,
        });

        lastResult = next;
        issuedItems.push({
          cupId: instanceCupId,
          userName: recipientName,
          deposit: next.receipt.depositAtomic,
          signature: next.receipt.depositSignature,
        });
      }
    }

    if (lastResult) {
      setResult(lastResult);
      save('receipt', { id: lastResult.receipt.id, mode: lastResult.receipt.mode });
    }

    setBatchSummary(issuedItems);
    await reloadConfig();
    await loadUserWallet(activeUserId);
    await loadActiveLoansList();
    setNotice(`Successfully issued ${issuedItems.length} container(s) across ${recipients.length} member(s). Proof of Identity recorded on Solana Devnet.`);
  }

  // Merchant accepts return from member (Rücknahme)
  async function handleMerchantReturn() {
    if (!merchantSession) throw new Error('Please sign in to the merchant station.');
    const parsed = cupIdSchema.parse(returnCupId);
    const updated = await request<Receipt>(
      `/returns/${parsed}`,
      { location: merchantSession.location, physicallyReceived: received, userId: returnUserId.trim() || undefined },
      merchantSession.token,
    );
    setResult({ receipt: updated });
    await reloadConfig();
    await loadUserWallet(activeUserId);
    setReceived(false);
    setNotice(`Cup ${parsed} return confirmed. Deposit successfully refunded to customer wallet.`);
  }

  async function handleDownloadCsv() {
    setExportingCsv(true);
    setError('');
    try {
      const response = await fetch('/api/demo-wallet/export.csv', {
        headers: { Authorization: `Bearer ${activeUserId}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `pfandloop-cup-history-${activeMember.username}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Could not export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  }

  async function showCupQr(id: string) {
    setActiveQrCupId(id);
    const url = new URL(location.origin);
    url.searchParams.set('cup', id);
    setCupQr(await QRCode.toDataURL(url.toString(), {
      width: 256,
      margin: 2,
      color: { dark: '#173f35', light: '#ffffff' },
    }));
    qrDialog.current?.showModal();
  }

  const activeLoans = walletData?.loans.filter(l => l.status !== 'returned') ?? [];
  const displayLoans = loanFilter === 'active' ? activeLoans : walletData?.loans ?? [];

  return (
    <>
      {/* Status Bar */}
      <div className="mode-strip">
        <span className="status-dot" />
        <span>{config ? (demo ? 'INTERACTIVE MVP' : 'SOLANA DEVNET') : 'CONNECTING TO NETWORK'}</span>
        <span className="strip-divider">/</span>
        <span>Together for our environment · Solana-powered open deposit loop</span>
      </div>

      {/* Header */}
      <header className="header">
        <a className="brand" href="/" aria-label="PfandLoop Home">
          <RefreshCw size={26} strokeWidth={2.6} />
          pfandloop<span className="brand-dot">.</span>
        </a>

        <nav aria-label="Main Navigation">
          <a href="/" aria-current={view === 'dashboard' ? 'page' : undefined}>My Dashboard</a>
          <a href="/geschaeft" aria-current={view === 'merchant' ? 'page' : undefined}>Merchant Station</a>
          <a href="#outlook">Strategic Outlook <ArrowUpRight size={13} /></a>
          <a href="#how">How It Works <ArrowUpRight size={13} /></a>
        </nav>

        {view === 'dashboard' ? (
          userSession ? (
            <div className="auth-status-chip">
              <User size={15} />
              <span>{userSession.user.name}</span>
              <button className="auth-signout-btn" onClick={handleUserLogout} title="Sign Out">
                <LogOut size={13} style={{ verticalAlign: 'middle' }} /> Logout
              </button>
            </div>
          ) : (
            <span className="profile-label">Customer Portal</span>
          )
        ) : (
          merchantSession ? (
            <div className="auth-status-chip">
              <Store size={15} />
              <span>{config?.locations.find(l => l.id === merchantSession.location)?.name ?? 'Merchant'}</span>
              <button className="auth-signout-btn" onClick={handleMerchantLogout} title="Sign Out">
                <LogOut size={13} style={{ verticalAlign: 'middle' }} /> Logout
              </button>
            </div>
          ) : (
            <span className="profile-label">Merchant Station</span>
          )
        )}
      </header>

      <main>
        {/* Page Meta Navigation */}
        <div className="page-meta">
          <span>
            <span className="mini-loop">↻</span>
            {view === 'dashboard' ? 'MEMBER WALLET & CONTAINER DASHBOARD' : 'MERCHANT DESK: CUP ISSUANCE & RETURNS'}
          </span>
          <span className="pilot-tag">MVP / 2026</span>
        </div>

        <div className="workspace-navigation" aria-label="Switch View">
          <a href="/" aria-current={view === 'dashboard' ? 'page' : undefined}>Customer Dashboard</a>
          <a href="/geschaeft" aria-current={view === 'merchant' ? 'page' : undefined}>Merchant Station</a>
        </div>

        {/* Universal Partner Acceptance Notice */}
        <div className="partner-banner" role="region" aria-label="Partner Notice">
          <div className="partner-banner-icon">
            <Store size={22} />
          </div>
          <div>
            <strong>All participating partner stores accept reusable cup returns.</strong>
            <p>
              Take your reusable cup from Café Morgenrot, Wiesenklang Festival, or any future partner.
              Every registered merchant can scan and return your cup — your deposit is credited back to your wallet instantly.
            </p>
          </div>
        </div>

        {/* CUSTOMER DASHBOARD VIEW */}
        {view === 'dashboard' ? (
          !userSession ? (
            <section className="workspace">
              <div className="story">
                <div className="eyebrow"><Leaf size={15} /> CUSTOMER ACCESS · SOLANA MVP</div>
                <h1>
                  Your Coffee Goes.<br />
                  The Cup <em>Loops.</em>
                </h1>
                <p className="intro">
                  Welcome to the PfandLoop customer portal. Sign in to your member account to view your available balance, track your borrowed cups, and display your digital membership pass.
                </p>
                <div className="benefits" style={{ marginTop: '20px' }}>
                  <span><Check size={15} /> Instant Solana Micro-Deposits</span>
                  <span><Check size={15} /> Universal Partner Return Network</span>
                  <span><Check size={15} /> Proof of Identity on Blockchain</span>
                </div>

                {/* 3D Isometric Reusable Loop Scene */}
                <Hero3DLoop />
              </div>
              <div className="transaction-column">
                <UserLogin onLogin={handleUserLoginSuccess} />
              </div>
            </section>
          ) : (
            <section className="workspace">
              {/* Left Column: Member Card & Balance */}
              <div className="story">
                <div className="eyebrow"><Leaf size={15} /> REUSABLE LOOP · SOLANA MVP</div>
                <h1>
                  Your Coffee Goes.<br />
                  The Cup <em>Loops.</em>
                </h1>
                <p className="intro">
                  Welcome to your personal PfandLoop dashboard. Show your Member ID or digital card at any partner counter
                  when ordering a drink or returning a container.
                </p>

                {/* Digital Membership Card */}
                <div className="member-card-wrapper">
                  <div className="member-card-top">
                    <div className="member-profile-info">
                      <span className="eyebrow">DIGITAL MEMBERSHIP CARD</span>
                      <strong>{activeMember.name}</strong>
                      <span>@{activeMember.username}</span>
                    </div>
                    {memberQr && (
                      <img src={memberQr} width="72" height="72" alt="Member QR Code" style={{ borderRadius: '6px', border: '1px solid #dce1d1' }} />
                    )}
                  </div>

                  <div className="user-selector-bar">
                    <label htmlFor="user-switch" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)' }}>
                      Switch Test Account:
                    </label>
                    <select
                      id="user-switch"
                      value={activeUserId}
                      onChange={e => handleSwitchUser(e.target.value)}
                    >
                      {MVP_USERS.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="qr-badge">
                    <QrCode size={14} />
                    <span>Card scan simulation · In production: Instant scan via digital membership QR code</span>
                  </div>
                </div>

                {/* Wallet Balance Card */}
                <section className="wallet-balance" aria-label="Available Balance">
                  <span>Available MVP Balance</span>
                  <strong>{walletData ? formatEuro(walletData.availableAtomic) : '€20.00'}</strong>
                  <SolEstimate amount={walletData ? walletData.availableAtomic : 20_000_000} />
                  <div>
                    <span>In Active Cup Deposits</span>
                    <b>{walletData ? formatEuro(walletData.heldAtomic) : '€0.00'}</b>
                  </div>
                </section>

                <button
                  className="secondary wallet-refresh"
                  style={{ width: '100%', marginTop: '12px' }}
                  disabled={walletLoading}
                  onClick={() => void loadUserWallet(activeUserId)}
                >
                  <span>Refresh Balance & Cups</span>
                  <RefreshCw size={15} className={walletLoading ? 'spin' : ''} />
                </button>
              </div>

              {/* Right Column: Active Cups & Transaction History */}
              <div className="transaction-column">
                {/* Active Cups Card */}
                <section className="transaction-card" aria-label="Active Containers">
                  <div className="card-top">
                    <span className="eyebrow">CUPS IN CIRCULATION</span>
                    <span className="step-label">{activeLoans.length} HELD</span>
                  </div>
                  <h2>Your Borrowed Containers.</h2>
                  <p className="card-description">
                    These containers are currently in your possession. Return them at any partner store to unlock your deposit.
                  </p>

                  {activeLoans.length === 0 ? (
                    <div className="wallet-empty">
                      <RefreshCw size={24} />
                      <p>No containers currently held.</p>
                      <span>Visit any partner café or festival bar to pick up your reusable cup!</span>
                    </div>
                  ) : (
                    <ol className="loan-list">
                      {activeLoans.map(loan => (
                        <li key={loan.loanId}>
                          <div className="loan-heading">
                            <strong>{loan.name}</strong>
                            <span className={`loan-status ${loan.status}`}>With You</span>
                          </div>
                          <p>{loan.cupId} <span>· {formatEuro(loan.depositAtomic)} Deposit</span></p>
                          <dl>
                            <div>
                              <dt>Borrowed At</dt>
                              <dd>
                                {new Date(loan.borrowedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                <span>{config?.locations.find(l => l.id === loan.borrowLocation)?.name ?? loan.borrowLocation}</span>
                              </dd>
                            </div>
                          </dl>
                          {loan.depositSignature && (
                            <div style={{ marginTop: '8px' }}>
                              <a
                                href={`https://explorer.solana.com/tx/${loan.depositSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="tx-explorer-link"
                                title="View Proof of Identity on Solana Devnet Explorer"
                              >
                                <ShieldCheck size={12} />
                                <span>Proof of Identity</span>
                                <span className="tx-sig-code">({loan.depositSignature.slice(0, 4)}…{loan.depositSignature.slice(-4)})</span>
                                <ArrowUpRight size={11} />
                              </a>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                {/* Transactions / Movements Card */}
                <section className="transaction-card" style={{ marginTop: '20px' }} aria-label="Deposit Movements">
                  <div className="card-top">
                    <span className="eyebrow">TRANSACTION HISTORY</span>
                    <button className="text-button" disabled={exportingCsv || !walletData} onClick={() => void handleDownloadCsv()}>
                      <Download size={14} />
                      {exportingCsv ? 'Exporting …' : 'Export CSV'}
                    </button>
                  </div>
                  <h2>Deposit Movements.</h2>
                  <p className="card-description">
                    Every borrow debits your deposit; every return automatically refunds it to your wallet with on-chain Proof of Identity.
                  </p>

                  {walletData?.history && walletData.history.length > 0 ? (
                    <ol className="wallet-history">
                      {walletData.history.map(entry => (
                        <li key={`${entry.receiptId}:${entry.kind}`}>
                          <span className={`movement-icon ${entry.kind}`}>
                            {entry.kind === 'refund' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </span>
                          <div>
                            <strong>{entry.kind === 'refund' ? 'Deposit Refunded' : 'Deposit Debited'}</strong>
                            <span>
                              {entry.cupId} · {new Date(entry.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {entry.signature && (
                              <div>
                                <a
                                  href={`https://explorer.solana.com/tx/${entry.signature}?cluster=devnet`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="tx-explorer-link"
                                  title="View on Solana Explorer"
                                >
                                  <ShieldCheck size={11} />
                                  <span>View on Solana Explorer</span>
                                  <span className="tx-sig-code">({entry.signature.slice(0, 4)}…{entry.signature.slice(-4)})</span>
                                  <ArrowUpRight size={11} />
                                </a>
                              </div>
                            )}
                          </div>
                          <b>
                            {entry.kind === 'refund' ? '+' : '−'}
                            {formatEuro(entry.amountAtomic)}
                            <small>MVP</small>
                          </b>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="wallet-empty">
                      <p>No transaction history yet.</p>
                      <span>Your deposit transactions will appear here as soon as a partner store issues or returns a cup.</span>
                    </div>
                  )}
                </section>

                {/* Active / Recent Receipt if available */}
                {result && (
                  <div style={{ marginTop: '20px' }}>
                    <ReceiptCard receipt={result.receipt} busy={busy} onRefresh={() => action(reloadConfig)} />
                  </div>
                )}
              </div>
            </section>
          )
        ) : (
          /* MERCHANT STATION VIEW */
          <section className="workspace">
            <div className="story">
              <div className="eyebrow"><Store size={15} /> PARTNER MERCHANT STATION</div>
              <h1>
                Issue Cups.<br />
                Accept <em>Returns.</em>
              </h1>
              <p className="intro">
                Staff portal for partner cafés, festivals, and restaurants. Select customer Member ID to issue containers
                with instant deposit debit, or confirm physical receipt for instant deposit refund.
              </p>

              <div className="benefits">
                <span><Check size={15} /> Universal Return (All Cups Accepted)</span>
                <span><Check size={15} /> Infinite Container Issuance Volume</span>
                <span><Check size={15} /> Simultaneous Multi-Member Issuance</span>
                <span><Check size={15} /> On-Chain Proof of Identity</span>
              </div>

              <div className="illustration" style={{ marginTop: '28px' }}>
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="illustration-caption">DESIGNED FOR<br /><strong>zero waste.</strong></span>
                <div className="hero-cup">
                  <CupArt color={selectedIssueCup?.color} bowl={issueCupId.startsWith('LOOP-003')} festival={issueCupId.startsWith('LOOP-002')} />
                </div>
                <div className="floating-label">
                  <RefreshCw size={19} />
                  <div>Circular Economy<span>Partner Store Station</span></div>
                </div>
              </div>
            </div>

            <div className="transaction-column">
              {!merchantSession ? (
                config ? (
                  <MerchantLogin
                    demo={demo}
                    onLogin={handleMerchantLoginSuccess}
                  />
                ) : (
                  <p role="status">Loading merchant station …</p>
                )
              ) : (
                <>
                  {/* Logged-in Merchant Profile Header */}
                  <div className="merchant-profile">
                    <div>
                      <span className="eyebrow">LOGGED-IN STATION · {merchantSession.location.toUpperCase()}</span>
                      <strong>{config?.locations.find(l => l.id === merchantSession.location)?.name}</strong>
                      <small>
                        {merchantSession.location === 'cafe'
                          ? 'Café Station: Authorized for Coffee To-Go Cups & Lunch Bowls only.'
                          : 'Festival Station: Authorized for Festival Reusable Cups only.'}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={handleMerchantLogout}
                    >
                      Sign Out
                    </button>
                  </div>

                  {/* Merchant Action Card with Tabs */}
                  <section className="transaction-card" aria-label="Merchant Actions">
                    <div className="tab-bar">
                      <button
                        aria-pressed={merchantTab === 'issue'}
                        onClick={() => { setMerchantTab('issue'); setError(''); setNotice(''); }}
                      >
                        Issue Containers
                      </button>
                      <button
                        aria-pressed={merchantTab === 'return'}
                        onClick={() => {
                          setMerchantTab('return');
                          setError('');
                          setNotice('');
                          void loadActiveLoansList();
                        }}
                      >
                        Accept Returns
                      </button>
                    </div>

                    {merchantTab === 'issue' ? (
                      /* TAB 1: ISSUE CONTAINER */
                      <>
                        <div className="card-top">
                          <span className="eyebrow">STEP 01: SELECT AUTHORIZED CONTAINER</span>
                          <span className="step-label">UNLIMITED ISSUANCE</span>
                        </div>
                        <h2>Issue Containers to Members.</h2>
                        <p className="card-description">
                          {merchantSession.location === 'cafe'
                            ? 'Café Morgenrot is authorized to issue Coffee To-Go Cups and Lunch Bowls. Festival cups are restricted.'
                            : 'Wiesenklang Festival is authorized to issue Festival Cups. Coffee cups and bowls are restricted.'}
                        </p>

                        <div className="cup-options" aria-label="Select Container">
                          {allowedCups.map(cup => (
                            <button
                              key={cup.id}
                              className={`cup-option ${issueCupId === cup.id ? 'selected' : ''}`}
                              onClick={() => setIssueCupId(cup.id)}
                              disabled={busy}
                              aria-pressed={issueCupId === cup.id}
                            >
                              <CupArt color={cup.color} bowl={cup.id === 'LOOP-003'} festival={cup.id === 'LOOP-002'} small />
                              <span>{cup.id === 'LOOP-001' ? 'Coffee' : cup.id === 'LOOP-002' ? 'Festival Cup' : 'Lunch Bowl'}</span>
                              <span className="cup-price">{formatEuro(cup.depositAtomic)}</span>
                              <small>Allowed for {merchantSession.location}</small>
                              {issueCupId === cup.id && <Check className="selection-check" size={14} />}
                            </button>
                          ))}
                        </div>

                        {/* Issuance Mode Selection: Single vs Multi-Member */}
                        <div style={{ marginTop: '16px' }}>
                          <span className="eyebrow">STEP 02: RECIPIENT MODE</span>
                          <div className="tab-bar" style={{ marginTop: '8px' }}>
                            <button
                              type="button"
                              aria-pressed={issueMode === 'single'}
                              onClick={() => setIssueMode('single')}
                            >
                              Single Customer
                            </button>
                            <button
                              type="button"
                              aria-pressed={issueMode === 'multiple'}
                              onClick={() => setIssueMode('multiple')}
                            >
                              Simultaneous Multi-Member Batch
                            </button>
                          </div>
                        </div>

                        {issueMode === 'single' ? (
                          /* Single Customer Selection */
                          <div className="field" style={{ marginTop: '14px' }}>
                            <label htmlFor="issue-user">Customer Member ID / Account</label>
                            <select
                              id="issue-user"
                              value={issueUserId}
                              disabled={busy}
                              onChange={e => setIssueUserId(e.target.value)}
                            >
                              {MVP_USERS.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name} (@{u.username})
                                </option>
                              ))}
                            </select>
                            <div className="qr-badge">
                              <QrCode size={13} />
                              <span>Card scan simulation · In production: Instant scan via digital membership QR code</span>
                            </div>
                          </div>
                        ) : (
                          /* Multi-Member Selection */
                          <div className="field" style={{ marginTop: '14px' }}>
                            <label>Select Recipient Members (Simultaneous Issuance):</label>
                            <div className="multi-user-grid">
                              {MVP_USERS.map(u => {
                                const isChecked = selectedUserIds.includes(u.id);
                                return (
                                  <label key={u.id} className={`user-checkbox-item ${isChecked ? 'selected' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={busy}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setSelectedUserIds(prev => [...prev, u.id]);
                                        } else {
                                          setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                                        }
                                      }}
                                    />
                                    <div>
                                      <strong>{u.name}</strong> <span>(@{u.username})</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              className="text-button"
                              style={{ marginTop: '6px' }}
                              onClick={() => setSelectedUserIds(MVP_USERS.map(u => u.id))}
                            >
                              Select All Members
                            </button>
                          </div>
                        )}

                        {/* Quantity Selector */}
                        <div className="field" style={{ marginTop: '14px' }}>
                          <label htmlFor="issue-quantity">Quantity (Cups per Selected Member):</label>
                          <select
                            id="issue-quantity"
                            value={quantityPerUser}
                            disabled={busy}
                            onChange={e => setQuantityPerUser(Number(e.target.value))}
                          >
                            <option value={1}>1 Container each</option>
                            <option value={2}>2 Containers each</option>
                            <option value={3}>3 Containers each</option>
                            <option value={5}>5 Containers each (Group order)</option>
                            <option value={10}>10 Containers each (Bulk)</option>
                          </select>
                        </div>

                        {/* Deposit Summary */}
                        <div className="deposit-summary">
                          <div>
                            <span>Total Deposit Required</span>
                            <p>
                              {selectedIssueCup?.name} · {quantityPerUser} per user × {issueMode === 'multiple' ? selectedUserIds.length : 1} user(s)
                            </p>
                          </div>
                          <div className="deposit-value">
                            <strong>
                              {selectedIssueCup
                                ? formatEuro(selectedIssueCup.depositAtomic * quantityPerUser * (issueMode === 'multiple' ? selectedUserIds.length : 1))
                                : '—'}
                            </strong>
                            {selectedIssueCup && (
                              <SolEstimate
                                amount={selectedIssueCup.depositAtomic * quantityPerUser * (issueMode === 'multiple' ? selectedUserIds.length : 1)}
                              />
                            )}
                          </div>
                        </div>

                        <div className="qr-badge" style={{ background: '#eef3eb', color: '#274b3d', borderColor: '#b7d0c3' }}>
                          <ShieldCheck size={14} />
                          <span>Infinite container capacity enabled · Proof of Identity recorded on Solana Devnet</span>
                        </div>

                        <button
                          className="primary"
                          disabled={busy || !selectedIssueCup || (issueMode === 'multiple' && selectedUserIds.length === 0)}
                          onClick={() => action(handleMerchantIssue)}
                          style={{ marginTop: '14px' }}
                        >
                          <span>
                            {busy
                              ? 'Issuing on Solana Devnet …'
                              : `Issue ${quantityPerUser * (issueMode === 'multiple' ? selectedUserIds.length : 1)} Container(s) & Record on Blockchain`}
                          </span>
                          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={19} />}
                        </button>

                        {/* Batch Issuance Results */}
                        {batchSummary.length > 0 && (
                          <div style={{ marginTop: '18px' }}>
                            <span className="eyebrow">LAST ISSUANCE BATCH ({batchSummary.length} CONTAINERS)</span>
                            <ul className="batch-results-list">
                              {batchSummary.map(item => (
                                <li key={item.cupId}>
                                  <div>
                                    <strong>{item.cupId}</strong> → {item.userName}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{formatEuro(item.deposit)}</span>
                                    {item.signature && (
                                      <a
                                        href={`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: 'var(--forest)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                        title="View Proof of Identity on Solana Devnet"
                                      >
                                        Proof <ArrowUpRight size={12} />
                                      </a>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      /* TAB 2: ACCEPT RETURN (RÜCKNAHME) */
                      <>
                        <div className="card-top">
                          <span className="eyebrow">STEP 02: CONFIRM RETURN</span>
                          <span className="step-label">UNIVERSAL REFUND</span>
                        </div>
                        <h2>Accept Return & Refund Deposit.</h2>
                        <p className="card-description">
                          Universal acceptance: Any registered container can be returned here, regardless of which partner location issued it.
                        </p>

                        {/* Active Containers Quick Return Table */}
                        <div style={{ margin: '14px 0' }}>
                          <span className="eyebrow">ACTIVE CONTAINERS IN CIRCULATION</span>
                          {activeLoansCatalog.length > 0 ? (
                            <div style={{ overflowX: 'auto', marginTop: '6px' }}>
                              <table className="active-cups-table">
                                <thead>
                                  <tr>
                                    <th>Container ID</th>
                                    <th>Issued By</th>
                                    <th>Deposit</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeLoansCatalog.map(loan => (
                                    <tr key={loan.id}>
                                      <td><strong>{loan.cupId}</strong></td>
                                      <td>{loan.borrowLocation === 'cafe' ? 'Café Morgenrot' : 'Wiesenklang Festival'}</td>
                                      <td>{formatEuro(loan.depositAtomic)}</td>
                                      <td>
                                        <button
                                          type="button"
                                          className="quick-return-btn"
                                          disabled={busy}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReturnCupId(loan.cupId);
                                            setReceived(true);
                                            action(async () => {
                                              const updated = await request<Receipt>(
                                              `/returns/${loan.cupId}`,
                                              { location: merchantSession.location, physicallyReceived: true },
                                              merchantSession.token,
                                            );
                                            setResult({ receipt: updated });
                                            await reloadConfig();
                                            await loadUserWallet(activeUserId);
                                            await loadActiveLoansList();
                                            setNotice(`Container ${loan.cupId} successfully returned. Deposit refunded with on-chain Proof of Identity.`);
                                           }); }}
                                        >
                                          Return & Refund
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                              No borrowed containers currently in circulation. Issue containers first!
                            </p>
                          )}
                        </div>

                        {/* Manual / Scan Container Field */}
                        <div className="field" style={{ marginTop: '16px' }}>
                          <label htmlFor="return-cup">Or Enter / Scan Container Barcode ID</label>
                          <input
                            id="return-cup"
                            type="text"
                            value={returnCupId}
                            disabled={busy}
                            onChange={e => setReturnCupId(e.target.value.toUpperCase())}
                            placeholder="e.g. LOOP-001-A482"
                          />
                        </div>

                        <div className="staff-fields" style={{ marginTop: '12px' }}>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={received}
                              onChange={e => setReceived(e.target.checked)}
                              disabled={busy}
                            />
                            <span>I have physically received the container in reusable, undamaged condition.</span>
                          </label>
                        </div>

                        <button
                          className="primary"
                          disabled={busy || !returnCupId.trim() || !received}
                          onClick={() => action(handleMerchantReturn)}
                          style={{ marginTop: '14px' }}
                        >
                          <span>
                            {busy
                              ? 'Refunding Deposit on Solana …'
                              : !received
                              ? 'Check physical receipt box'
                              : 'Confirm Return & Refund Deposit'}
                          </span>
                          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={19} />}
                        </button>
                      </>
                    )}
                  </section>
                </>
              )}

              {/* Feedback messages */}
              <div className="feedback" aria-live="polite">
                {error && <div className="error" role="alert">{error}</div>}
                {notice && <div className="notice"><Check size={17} />{notice}</div>}
              </div>

              {/* Receipt display if available */}
              {result && (
                <div style={{ marginTop: '20px' }}>
                  <ReceiptCard receipt={result.receipt} busy={busy} onRefresh={() => action(reloadConfig)} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* STRATEGIC OUTLOOK SECTION */}
        <section className="outlook-section" id="outlook">
          <div className="how-title">
            <div>
              <span className="eyebrow"><Globe size={15} /> STRATEGIC OUTLOOK & COOPERATION</span>
              <h2>Scaling Reusable Ecosystems with Solana.</h2>
            </div>
          </div>

          <div className="outlook-grid">
            <div className="outlook-card">
              <span className="eyebrow">COOPERATION WITH ESTABLISHED NETWORKS</span>
              <h3>Interoperability with RECUP, FairCup & Relevo</h3>
              <p>
                In Germany alone, systems like <strong>RECUP</strong> operate across 20,000+ cafés and restaurants.
                However, today's deposit networks suffer from proprietary silos, trapped customer balances,
                and costly inter-merchant clearing reconciliations.
              </p>
              <p>
                PfandLoop provides the open, decentralized settlement protocol that connects existing networks without replacing their physical inventory.
                Any partner café, food truck, or municipal festival can issue and accept standard reusable containers with instant, trustless deposit settlement.
              </p>
              <div className="partner-tags">
                <span className="partner-tag">RECUP Compatible</span>
                <span className="partner-tag">FairCup Protocol</span>
                <span className="partner-tag">Municipal Catering</span>
                <span className="partner-tag">Festival Stations</span>
              </div>
            </div>

            <div className="outlook-card">
              <span className="eyebrow">WHY SOLANA MAKES IT VIABLE</span>
              <h3>Sub-Cent Microtransactions & Sub-Second Finality</h3>
              <p>
                Traditional blockchains cannot support €1.00 - €2.00 deposit refunds due to high gas fees and multi-minute confirmations.
                Solana's high-speed architecture unlocks the true potential of physical reusable container loops:
              </p>
              <ul style={{ fontSize: '12px', lineHeight: '1.8', color: 'var(--muted)', paddingLeft: '18px' }}>
                <li><strong>Sub-cent transaction fees (&lt;$0.001):</strong> Economic viability for everyday coffee micro-deposits.</li>
                <li><strong>400ms finality:</strong> Instant checkout speed matching point-of-sale terminal requirements.</li>
                <li><strong>Open standard:</strong> Eliminates vendor lock-in and enables universal cross-merchant cup returns.</li>
                <li><strong>Verifiable ESG Impact:</strong> Tamper-proof on-chain audit of single-use cups saved.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="how" id="how">
          <div className="how-title">
            <span className="eyebrow">HOW REUSABLE LOOPS WORK</span>
            <h2>Three Simple Steps. One Sustainable Loop.</h2>
          </div>
          <div className="how-steps">
            <article>
              <span className="step-number">01</span>
              <h3>Pick Up & Scan.</h3>
              <p>
                Order at any partner café or festival stand. Present your Member ID or QR code; staff assigns your container,
                and your deposit is recorded.
              </p>
            </article>
            <article>
              <span className="step-number">02</span>
              <h3>Enjoy Anywhere.</h3>
              <p>
                Enjoy your coffee, meal, or festival drink. Your personal dashboard tracks your active containers and verified deposits.
              </p>
            </article>
            <article>
              <span className="step-number">03</span>
              <h3>Return Everywhere.</h3>
              <p>
                Return your cup at <em>any</em> participating partner location. Upon physical receipt, your deposit is refunded
                directly to your wallet.
              </p>
            </article>
          </div>
        </section>

        {/* Pilot Footprint Notice */}
        <section className="pilot">
          <div>
            <MapPin size={19} />
            <span>Open Reusable Network · Together for our environment.</span>
          </div>
          <p>
            Café Morgenrot + Wiesenklang Festival
            <span>Participating MVP Partner Locations</span>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <a className="brand" href="/">
          <RefreshCw size={19} />
          pfandloop.
        </a>
        <span>Together for our environment · Circular reusable loops powered by Solana.</span>
        <a href="https://solana.com" target="_blank" rel="noreferrer">
          Built for Solana <ArrowUpRight size={14} />
        </a>
      </footer>

      {/* QR Dialog */}
      <dialog ref={qrDialog} className="qr-dialog">
        <button className="dialog-close" aria-label="Close QR Code" onClick={() => qrDialog.current?.close()}>
          <X size={22} />
        </button>
        <span className="eyebrow">CONTAINER QR CODE</span>
        <h2>{activeQrCupId}</h2>
        {cupQr && <img src={cupQr} width="256" height="256" alt={`QR Code for ${activeQrCupId}`} />}
        <p>Scannable container ID. Scan at checkout to register the cup for issuance or return.</p>
        <button className="primary" onClick={() => qrDialog.current?.close()}>
          Got it <Check size={17} />
        </button>
      </dialog>
    </>
  );
}
