import { formatSolEstimate } from '../shared/model';
import { useSolPrice } from './useSolPrice';

export function SolEstimate({ amount, customPrice }: { amount: number; customPrice?: number }) {
  const { priceEur, isLive } = useSolPrice(customPrice);

  return (
    <span className="sol-estimate" title={`Real-time conversion: 1 SOL = €${priceEur.toFixed(2)}`}>
      ≈ {formatSolEstimate(amount, priceEur)} SOL
      <small style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isLive ? '#22c55e' : '#f59e0b',
            boxShadow: isLive ? '0 0 6px rgba(34, 197, 94, 0.6)' : undefined,
          }}
          aria-hidden="true"
        />
        {isLive ? 'Live rate' : 'Est. rate'}: 1 SOL = €{priceEur.toFixed(2)}
      </small>
    </span>
  );
}
