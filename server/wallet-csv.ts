import { formatUsdc, locations, type DemoWallet } from '../shared/model';

export function walletCsv(wallet: DemoWallet): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const site = (id: string | null) => locations.find(location => location.id === id)?.name ?? '';
  const rows = [
    ['User ID', 'Loan ID', 'Cup ID', 'Description', 'Status', 'Deposit EUR (MVP)', 'Borrowed At', 'Issue Location', 'Returned At', 'Return Location'],
    ...wallet.loans.map(loan => [wallet.userId, loan.loanId, loan.cupId, loan.name, loan.status,
      formatUsdc(loan.depositAtomic), loan.borrowedAt, site(loan.borrowLocation), loan.returnedAt, site(loan.returnLocation)]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
