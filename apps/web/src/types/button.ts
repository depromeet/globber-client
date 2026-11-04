import type { GlobeRef } from "@/components/globe/Globe";

// BackButton Component
export interface BackButtonProps {
  isZoomed: boolean;
  globeRef: React.RefObject<GlobeRef | null>;
  onReset: () => void;
}
