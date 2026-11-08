import { memo } from "react";

import { Button } from "@/components/common/Button";
import type { City } from "@/types/city";

import { SelectedCities } from "./SelectedCities";

type NationSelectFooterProps = {
  selectedCities: City[];
  onRemoveCity: (cityId: string, source?: "list" | "selected") => void;
  onCreateGlobe: () => void;
  isSubmitting?: boolean;
  buttonLabel?: string;
  mode?: "default" | "edit-add";
};

export const NationSelectFooter = memo(
  ({
    selectedCities,
    onRemoveCity,
    onCreateGlobe,
    isSubmitting = false,
    buttonLabel,
    mode,
  }: NationSelectFooterProps) => {
    const isButtonEnabled = selectedCities.length > 0 && !isSubmitting;

    return (
      <div className="sticky bottom-0 flex justify-center">
        <div className="bg-surface-thirdly w-full max-w-lg px-4 py-6">
          <SelectedCities selectedCities={selectedCities} onRemoveCity={onRemoveCity} mode={mode} />

          <Button
            variant={isButtonEnabled ? "primary" : "disabled"}
            size="lg"
            className="w-full"
            disabled={!isButtonEnabled}
            onClick={onCreateGlobe}
          >
            {buttonLabel || "내 지구본 생성하기"}
          </Button>
        </div>
      </div>
    );
  }
);

NationSelectFooter.displayName = "NationSelectFooter";
