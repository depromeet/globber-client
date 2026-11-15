export const GlobeLoadingState = () => (
  <div
    role="status"
    aria-live="polite"
    className="min-h-dvh w-full flex flex-col items-center justify-center gap-4 bg-surface-secondary text-text-secondary"
  >
    <div aria-hidden="true" className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <p>지구본을 불러오는 중</p>
  </div>
);
