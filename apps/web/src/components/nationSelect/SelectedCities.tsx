import { useEffect, useRef } from "react";

import type { City } from "@globber/shared/types/city";
import { sendGAEvent } from "@next/third-parties/google";

import { Chip } from "@/components/common/Chip";

type SelectedCitiesProps = {
  selectedCities: City[];
  onRemoveCity: (cityId: string, source?: "list" | "selected") => void;
  mode?: "default" | "edit-add";
};

export const SelectedCities = ({ selectedCities, onRemoveCity, mode }: SelectedCitiesProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current && selectedCities.length > 0) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: "smooth",
      });
    }
  }, [selectedCities.length]);

  if (selectedCities.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-text-thirdly text-xs mb-3 font-bold">{selectedCities.length}개 도시 방문</p>
      <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {selectedCities.map(({ id, flag, name, country }) => (
          <Chip
            key={id}
            variant="gray"
            size="md"
            removable
            onRemove={() => {
              if (mode === "edit-add") {
                onRemoveCity(id, "selected");
              } else {
                onRemoveCity(id);
                sendGAEvent("event", "place_remove", {
                  flow: "onboarding",
                  screen: "placeselect",
                  click_code: "onboarding.placeselect.selected.remove",
                  selected_count: selectedCities.length - 1,
                });
              }
            }}
            className="shrink-0"
          >
            {flag} {name}, {country}
          </Chip>
        ))}
      </div>
    </div>
  );
};
