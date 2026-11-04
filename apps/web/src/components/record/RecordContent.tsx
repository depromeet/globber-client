"use client";

import { useMemo } from "react";

import type { Continent, RecordResponse } from "@globber/shared/types/record";
import {
  calculateContinentStats,
  filterRegionsByContinent,
  sortContinentsByCount,
} from "@globber/shared/utils/recordUtils";

import { CityList } from "./CityList";
import { ContinentFilter } from "./ContinentFilter";
import { RecordHeaderText } from "./RecordHeaderText";

interface RecordContentProps {
  initialData: RecordResponse | null;
  selectedContinent: Continent;
  onContinentChange: (continent: Continent) => void;
}

export function RecordContent({ initialData, selectedContinent, onContinentChange }: RecordContentProps) {
  const { filteredRegions, continentStats } = useMemo(() => {
    if (!initialData?.data) {
      const emptyStats: Record<Continent, number> = {
        전체: 0,
        아시아: 0,
        유럽: 0,
        북미: 0,
        남미: 0,
        아프리카: 0,
        오세아니아: 0,
      };
      return { filteredRegions: [], continentStats: emptyStats };
    }

    const { regions } = initialData.data;
    const stats = calculateContinentStats(regions);
    const filtered = filterRegionsByContinent(regions, selectedContinent);

    return { filteredRegions: filtered, continentStats: stats };
  }, [initialData, selectedContinent]);

  const sortedContinents = useMemo(() => sortContinentsByCount(continentStats), [continentStats]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 space-y-8 mb-8">
        <RecordHeaderText />
        <ContinentFilter
          continents={sortedContinents}
          continentStats={continentStats}
          selectedContinent={selectedContinent}
          onContinentChange={onContinentChange}
        />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <CityList filteredRegions={filteredRegions} />
      </div>
    </div>
  );
}
