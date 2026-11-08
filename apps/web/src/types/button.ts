import type { GlobeRef } from "@/components/globe/Globe";

// BackButton 컴포넌트
export type BackButtonProps = {
  isZoomed: boolean;
  globeRef: React.RefObject<GlobeRef | null>;
  onReset: () => void;
};
