import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
