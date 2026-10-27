import { SearchInput } from "@/components/common/Input";
import type { SearchProps } from "@/types/components";

type NationSelectHeaderProps = SearchProps;

export const NationSelectHeader = ({ searchValue, onSearchChange }: NationSelectHeaderProps) => {
  return (
    <div className="pt-10 pb-7 flex flex-col gap-7">
      <h1 className="text-text-primary text-2xl font-bold leading-8">
        그동안 여행했던 도시들을
        <br />
        선택해보세요.
      </h1>

      <SearchInput
        placeholder="도시/나라를 검색해주세요."
        value={searchValue}
        onChange={e => onSearchChange(e.target.value)}
      />
    </div>
  );
};
