import { COUNTRY_CODE_TO_FLAG } from "../constants/countryMapping";

/**
 * 백엔드 API에서 받은 도시 데이터를 프론트엔드에서 사용하는 City 타입으로 변환합니다.
 * @param apiData 백엔드 API에서 받은 도시 데이터
 * @returns 프론트엔드에서 사용하는 City 객체
 */
export const transformApiDataToCity = (apiData: {
  cityId: number;
  cityName: string;
  countryName: string;
  lat: number;
  lng: number;
  countryCode: string;
}) => {
  return {
    id: apiData.cityId.toString(),
    name: apiData.cityName,
    country: apiData.countryName,
    flag: COUNTRY_CODE_TO_FLAG[apiData.countryCode] || "🌍",
    lat: apiData.lat,
    lng: apiData.lng,
    countryCode: apiData.countryCode,
  };
};
