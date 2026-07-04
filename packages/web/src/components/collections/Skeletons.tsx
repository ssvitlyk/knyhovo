/**
 * Warm loading skeletons for the Collections pages (`--surface-accent`
 * surfaces, never cold grey — frozen loading rule). Class recipes live in
 * `styles/collections.css` (`.cskel*`).
 */

function SkeletonCards({ count }: { readonly count: number }): React.JSX.Element {
  return (
    <div className="cskel-shelf" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="cskel cskel--card" />
      ))}
    </div>
  );
}

/** Hub (`/dobirky`) loading state: hero band + two shelves. */
export function HubSkeleton(): React.JSX.Element {
  return (
    <main className="dobirky-scope" aria-busy="true">
      <div className="cskel cskel--hero" />
      <div className="cskel cskel--sechead" />
      <SkeletonCards count={6} />
      <div className="cskel cskel--sechead" />
      <SkeletonCards count={6} />
    </main>
  );
}

/** Collection Details loading state: title row + description + grid. */
export function DetailsSkeleton(): React.JSX.Element {
  return (
    <main className="dobirky-scope" aria-busy="true">
      <div className="cskel cskel--title" />
      <div className="cskel cskel--desc" />
      <div className="cd-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="cskel cskel--card" />
        ))}
      </div>
    </main>
  );
}
