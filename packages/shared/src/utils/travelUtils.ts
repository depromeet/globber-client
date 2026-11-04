import type { City } from "../types/city";
import type { MemberTravelsResponse, TravelRecord } from "../types/member";
import type { RecordResponse } from "../types/record";

// City 타입을 TravelRecord로 변환하는 함수
export const convertCitiesToTravelRecords = (cities: City[]): TravelRecord[] => {
  return cities.map(city => ({
    countryName: city.country,
    cityName: city.name,
    lat: city.lat,
    lng: city.lng,
    countryCode: city.countryCode,
  }));
};

// MemberTravelsResponse를 RecordResponse로 변환하는 함수
export const convertMemberTravelsToRecordResponse = (memberTravels: MemberTravelsResponse): RecordResponse => {
  // 모든 여행의 도시들을 평탄화
  const allCities = memberTravels.data.travels.flatMap(travel => travel.cities);

  // 국가별로 그룹화 (countryName과 countryCode를 저장)
  const citiesByCountry = allCities.reduce(
    (acc, { countryCode, countryName, cityId, cityName, lat, lng }) => {
      if (!acc[countryCode]) {
        acc[countryCode] = {
          countryName,
          cities: [],
        };
      }
      acc[countryCode].cities.push({
        cityId,
        name: cityName,
        lat,
        lng,
        countryCode,
      });
      return acc;
    },
    {} as Record<
      string,
      {
        countryName: string;
        cities: Array<{
          cityId: number;
          name: string;
          lat: number;
          lng: number;
          countryCode: string;
        }>;
      }
    >
  );

  // regions 배열로 변환 (국가별로 정렬)
  const regions = Object.entries(citiesByCountry)
    .map(([_countryCode, { countryName, cities }]) => {
      return {
        regionName: countryName,
        cityCount: cities.length,
        cities: cities.sort((a, b) => a.name.localeCompare(b.name, "ko")), // 도시명 가나다 순 정렬
      };
    })
    .sort((a, b) => a.regionName.localeCompare(b.regionName, "ko")); // 국가명 가나다 순 정렬

  // 전체 도시 수 계산
  const cityCount = allCities.length;

  // 전체 국가 수 계산 (고유한 countryCode 수)
  const countryCount = new Set(allCities.map(city => city.countryCode)).size;

  return {
    status: memberTravels.status,
    data: {
      cityCount,
      countryCount,
      regions,
    },
  };
};
