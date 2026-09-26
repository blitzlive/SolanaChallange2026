import { EXAMPLE_EUR_PER_SOL, formatSolEstimate } from '../shared/model';

export function SolEstimate({ amount }: { amount: number }) {
  return <span className="sol-estimate">≈ {formatSolEstimate(amount)} SOL <small>Beispielkurs: 1 SOL = {EXAMPLE_EUR_PER_SOL} € · kein Livekurs</small></span>;
}
