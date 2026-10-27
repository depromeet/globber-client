import type { Continent } from "@globber/shared/types/record";
import { sendGAEvent } from "@next/third-parties/google";

interface ContinentFilterProps {
  continents: Continent[];
  continentStats: Record<Continent, number>;
  selectedContinent: Continent;
  onContinentChange: (continent: Continent) => void;
}

export function ContinentFilter({
  continents,
  continentStats,
  selectedContinent,
  onContinentChange,
}: ContinentFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
      {continents.map(continent => {
        const count = continentStats[continent];
        const isSelected = selectedContinent === continent;
        const isDisabled = count === 0;
        return (
          <button
            type="button"
            key={continent}
            onClick={() => {
              sendGAEvent("event", "record_filter_select", {
                flow: "editor",
                screen: "record",
                click_code: "editor.record.filter.item",
                continent,
              });
              onContinentChange(continent);
            }}
            className={`shrink-0 inline-flex justify-center items-center gap-1 rounded-xl ${
              isSelected
                ? "px-3.5 py-2 bg-state-enabled"
                : isDisabled
                  ? "px-3.5 py-2 outline-1 -outline-offset-1 outline-border-absolutewhite--8"
                  : "px-3.5 py-2 outline-1 -outline-offset-1 outline-border-absolutewhite--16"
            }`}
            disabled={isDisabled}
          >
            <span
              className={`${
                isSelected
                  ? "text-text-inverseprimary text-sm font-bold leading-5"
                  : isDisabled
                    ? "text-text-inversesecondary text-sm font-medium leading-5"
                    : "text-white text-sm font-medium leading-5"
              }`}
            >
              {continent}
            </span>
            {!isDisabled && continent !== "전체" && (
              <span
                className={`${
                  isSelected
                    ? "text-text-inverseprimary text-sm font-bold leading-5"
                    : "text-white text-sm font-medium leading-5"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
