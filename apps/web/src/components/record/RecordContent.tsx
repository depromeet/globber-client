"use client";

import { useMemo } from "react";

import { createZeroCounts, RECORD_CONTINENT_ORDER } from "@globber/shared/constants/continent";
import type { Continent, RecordResponse } from "@globber/shared/types/record";
import {
  calculateContinentStats,
  filterRegionsByContinent,
  sortContinentsByCount,
} from "@globber/shared/utils/recordUtils";

import { CityList } from "./CityList";
import { ContinentFilter } from "./ContinentFilter";
import { RecordHeaderText } from "./RecordHeaderText";

type RecordContentProps = {
  initialData: RecordResponse | null;
  selectedContinent: Continent;
  onContinentChange: (continent: Continent) => void;
};

export const RecordContent = ({ initialData, selectedContinent, onContinentChange }: RecordContentProps) => {
  const { filteredRegions, continentStats } = useMemo(() => {
    if (!initialData?.data) {
      return { filteredRegions: [], continentStats: createZeroCounts(RECORD_CONTINENT_ORDER) };
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
};
