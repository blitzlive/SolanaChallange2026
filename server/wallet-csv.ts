import { formatUsdc, locations, type DemoWallet } from '../shared/model';

export function walletCsv(wallet: DemoWallet): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const site = (id: string | null) => locations.find(location => location.id === id)?.name ?? '';
  const rows = [
    ['Nutzer-ID', 'Ausleihe-ID', 'Becher-ID', 'Bezeichnung', 'Status', 'Pfand EUR (Simulation)', 'Ausgeliehen am', 'Ausgabeort', 'Zurückgegeben am', 'Rückgabeort'],
    ...wallet.loans.map(loan => [wallet.userId, loan.loanId, loan.cupId, loan.name, loan.status,
      formatUsdc(loan.depositAtomic), loan.borrowedAt, site(loan.borrowLocation), loan.returnedAt, site(loan.returnLocation)]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
