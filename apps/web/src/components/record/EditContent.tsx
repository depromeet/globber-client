"use client";

import { COUNTRY_CODE_TO_FLAG, getCountryName } from "@globber/shared/constants/countryMapping";

import { ICPlusIcon, ICXIcon } from "@/assets/icons";

interface EditContentProps {
  cities: { id: string; name: string; countryCode: string; isNew?: boolean }[];
  onAddClick?: () => void;
  onRemoveClick?: (cityId: string, isNew?: boolean) => void;
}

export function EditContent({ cities, onAddClick, onRemoveClick }: EditContentProps) {
  return (
    <div>
      <div className="mt-5 mb-8">
        <button
          type="button"
          className="w-full px-5 py-3 bg-surface-inverseprimary rounded-xl inline-flex justify-center items-center overflow-hidden"
          onClick={onAddClick}
        >
          <div className="flex justify-center items-center gap-1">
            <ICPlusIcon className="w-4 h-4" />
            <div className="justify-start text-text-inversesecondary text-sm font-bold leading-5">도시 추가</div>
          </div>
        </button>
      </div>

      <div className="self-stretch justify-start text-text-primary text-base font-medium leading-5 mb-4">
        다녀온 도시
      </div>

      <div className="flex flex-col gap-2 pb-12">
        {cities.map(c => {
          const flag = COUNTRY_CODE_TO_FLAG[c.countryCode] || "🌍";
          const countryName = getCountryName(c.countryCode);
          return (
            <div
              key={c.id}
              className={`w-full px-5 py-3 rounded-2xl inline-flex justify-between items-center overflow-hidden ${
                c.isNew
                  ? "bg-surface-placeholder--4 outline outline-[0.70px] outline-border-thirdly"
                  : "bg-surface-placeholder--4"
              }`}
            >
              <div className="justify-start text-text-primary text-sm font-medium leading-5">
                {flag} {c.name}, {countryName}
              </div>
              <button
                type="button"
                onClick={() => onRemoveClick?.(c.id, c.isNew)}
                className="w-4 h-4 flex items-center justify-center text-text-secondary"
              >
                <ICXIcon className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
