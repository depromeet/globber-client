// Google Places API 관련 타입 정의
export type PlaceGeometry = {
  location: {
    lat: number;
    lng: number;
  };
};

export type PlaceResult = {
  place_id: string;
  name?: string;
  geometry: PlaceGeometry;
  vicinity?: string;
};

export type GooglePlacesNearbyResponse = {
  results: PlaceResult[];
};

export type PlaceDetailsResult = {
  name: string;
  formatted_address?: string;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
};

export type GooglePlaceDetailsResponse = {
  result?: PlaceDetailsResult;
};

export type PlaceWithDistance = PlaceResult & { actualDistance: number };
