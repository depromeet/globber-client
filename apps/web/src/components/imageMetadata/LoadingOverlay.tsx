import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export const LoadingOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div role="status" aria-label="처리 중" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );
};
