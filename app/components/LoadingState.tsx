export default function LoadingState({ label = "Loading your financial overview" }: { label?: string }) {
  return <div className="loading-skeleton" role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className="skeleton-line skeleton-title" aria-hidden="true" />
    <div className="skeleton-line skeleton-subtitle" aria-hidden="true" />
    <div className="grid g3" aria-hidden="true">{[0, 1, 2].map(item => <div className="card" key={item}><div className="skeleton-line" /><div className="skeleton-line skeleton-figure" /><div className="skeleton-line" /></div>)}</div>
    <div className="card skeleton-chart" aria-hidden="true"><div className="skeleton-line skeleton-subtitle" /></div>
  </div>;
}
