import type { CountryData, TravelPattern } from "./travelPatterns";

export type ClusterData = {
  id: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  color: string;
  items: CountryData[];
  count: number;
};

export type ReactGlobeProps = {
  travelPatterns: TravelPattern[];
  currentGlobeIndex: number;
  selectedCountry: string | null;
  onCountrySelect: (countryId: string | null) => void;
  onZoomChange: (zoomLevel: number) => void;
  onClusterSelect?: (cluster: ClusterData) => void;
  clusteredData: ClusterData[];
  shouldShowClusters: boolean;
  zoomLevel: number;
  selectedClusterData?: CountryData[];
  snapZoomTo?: number | null;
};
