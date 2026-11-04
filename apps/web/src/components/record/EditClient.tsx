"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getCountryName } from "@globber/shared/constants/countryMapping";
import type { City } from "@globber/shared/types/city";
import type { CreateTravelRecordsResponse } from "@globber/shared/types/member";
import { sendGAEvent } from "@next/third-parties/google";

import { IconExclamationCircleMonoIcon } from "@/assets/icons";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/common/Dialog";
import { Header } from "@/components/common/Header";
import { LoadingOverlay } from "@/components/imageMetadata/LoadingOverlay";
import { useCreateMemberTravelsMutation, useDeleteMemberTravelMutation } from "@/hooks/mutation/useMemberMutation";
import { getAuthInfo } from "@/utils/cookies";

import { EditContent } from "./EditContent";
import { EditToastContainer, toast } from "./EditToast";

interface EditClientProps {
  cities: {
    id: string;
    name: string;
    countryCode: string;
    lat: number;
    lng: number;
    cityId?: number;
    isNew?: boolean;
  }[];
  deletedCities?: {
    id: string;
    name: string;
    countryCode: string;
    lat: number;
    lng: number;
    cityId?: number;
  }[];
}

export function EditClient({ cities, deletedCities = [] }: EditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [current, setCurrent] = useState(cities);
  const base = useMemo(() => cities.filter(c => !c.isNew), [cities]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialCityCount = useRef(cities.length);
  const hasSavedRef = useRef(false);
  const isChangedRef = useRef(false);
  const { mutateAsync: createMemberTravels } = useCreateMemberTravelsMutation();
  const { mutateAsync: deleteMemberTravel } = useDeleteMemberTravelMutation();

  // 삭제된 도시 정보 저장 (삭제 시점의 도시 정보를 저장)
  const [deletedCitiesInfo, setDeletedCitiesInfo] = useState<
    Map<
      string,
      {
        id: string;
        name: string;
        countryCode: string;
        lat: number;
        lng: number;
        cityId?: number;
      }
    >
  >(new Map());

  // 삭제된 도시 ID 목록
  const removedIds = useMemo(() => {
    const removedParam = searchParams.get("removed");
    if (removedParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(removedParam));
        if (Array.isArray(decoded)) {
          return new Set(decoded.map(String));
        }
      } catch {}
    }
    return new Set<string>();
  }, [searchParams]);

  // 전달받은 삭제된 도시 정보를 deletedCitiesInfo에 저장
  useEffect(() => {
    if (deletedCities.length > 0) {
      setDeletedCitiesInfo(prev => {
        const updated = new Map(prev);
        deletedCities.forEach(city => {
          updated.set(city.id, city);
        });
        return updated;
      });
    }
  }, [deletedCities]);

  // cities prop이 처음 로드될 때 삭제된 도시가 아닌 기존 도시들을 deletedCitiesInfo에 저장 (필요시)
  useEffect(() => {
    const existingCities = cities.filter(c => !c.isNew && !removedIds.has(c.id));
    setDeletedCitiesInfo(prev => {
      const updated = new Map(prev);
      existingCities.forEach(city => {
        if (!updated.has(city.id)) {
          updated.set(city.id, city);
        }
      });
      return updated;
    });
  }, [cities, removedIds]);

  // cities prop이 변경될 때 current state 업데이트 (하지만 삭제된 도시는 제외)
  useEffect(() => {
    // 삭제된 도시를 제외한 도시들만 current에 유지
    const filteredCities = cities.filter(c => !removedIds.has(c.id));

    // 기존 current에서 삭제된 도시 제거하고 새 도시 추가
    setCurrent(prev => {
      const prevIds = new Set(prev.map(c => c.id));
      const newCities = filteredCities.filter(c => !prevIds.has(c.id));

      // 삭제된 도시 제거
      const updated = prev.filter(c => !removedIds.has(c.id));

      // 새 도시 추가
      return [...newCities, ...updated];
    });
  }, [cities, removedIds]);

  const baseIds = useMemo(() => new Set(base.map(c => c.id)), [base]);
  const currentIds = useMemo(() => new Set(current.map(c => c.id)), [current]);
  const isChanged = useMemo(() => {
    // 삭제된 도시가 있으면 변경된 것
    if (removedIds.size > 0) return true;

    // 추가된 도시가 있으면 변경된 것
    if (current.some(c => c.isNew)) return true;

    // 개수나 ID가 다르면 변경된 것
    if (current.length !== base.length) return true;
    if (baseIds.size !== currentIds.size) return true;
    for (const id of baseIds) {
      if (!currentIds.has(id)) return true;
    }
    return false;
  }, [base.length, baseIds, current, currentIds, removedIds.size]);

  // isChangedRef 동기화
  useEffect(() => {
    isChangedRef.current = isChanged;
  }, [isChanged]);

  // cityedit_view / cityedit_exit
  useEffect(() => {
    sendGAEvent("event", "cityedit_view", {
      flow: "editor",
      screen: "cityedit",
    });

    return () => {
      sendGAEvent("event", "cityedit_exit", {
        flow: "editor",
        screen: "cityedit",
        has_changed: isChangedRef.current,
        has_saved: hasSavedRef.current,
      });
    };
  }, []);

  // 브라우저 뒤로가기 감지
  useEffect(() => {
    const handlePopState = () => {
      router.push("/record");
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [router]);

  const handleBack = () => {
    router.push("/record");
  };

  const handleRemove = (cityId: string, isNew?: boolean) => {
    // 마지막 1개 남은 도시를 삭제하려고 하는 경우
    if (current.length === 1) {
      setShowCannotDeleteModal(true);
      return;
    }

    const cityToRemove = current.find(c => c.id === cityId);
    sendGAEvent("event", "cityedit_delete_trigger", {
      flow: "editor",
      screen: "cityedit",
      click_code: "editor.cityedit.list.item.remove",
      city_id: cityToRemove?.cityId ?? cityId,
      current_city_count: current.length,
    });

    if (isNew) {
      // 새로 추가한 도시 삭제 - current에서 제거하고 URL도 업데이트
      const updatedCurrent = current.filter(c => c.id !== cityId);
      setCurrent(updatedCurrent);

      // 현재 남아있는 새로 추가한 도시들로 added 파라미터 업데이트
      const remainingNewCities = updatedCurrent
        .filter(c => c.isNew)
        .map(({ id, name, countryCode, lat, lng }) => {
          const countryName = getCountryName(countryCode);
          return { id, name, country: countryName, countryCode, lat, lng };
        });

      const removedParam = searchParams.get("removed");
      let newUrl = "/record/edit";
      const params = new URLSearchParams();

      if (remainingNewCities.length > 0) {
        params.set("added", encodeURIComponent(JSON.stringify(remainingNewCities)));
      }

      if (removedParam) {
        params.set("removed", removedParam);
      }

      if (params.toString()) {
        newUrl += `?${params.toString()}`;
      }

      router.push(newUrl);
      toast.success("도시가 삭제되었습니다. 저장 시 변경사항이 반영됩니다");
    } else {
      setConfirmId(cityId);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmId) return;

    const cityToDelete = current.find(c => c.id === confirmId);
    if (!cityToDelete) return;

    sendGAEvent("event", "cityedit_delete_confirm", {
      flow: "editor",
      screen: "cityedit",
      click_code: "editor.cityedit.delete.modal.confirm",
      city_id: cityToDelete.cityId ?? confirmId,
      previous_city_count: current.length,
      current_city_count: current.length - 1,
    });

    // 삭제된 도시 정보 저장 (저장 시 서버에 전송하기 위해)
    setDeletedCitiesInfo(prev => {
      const updated = new Map(prev);
      updated.set(confirmId, cityToDelete);
      return updated;
    });

    // 현재 목록에서 제거
    const updatedCurrent = current.filter(c => c.id !== confirmId);
    setCurrent(updatedCurrent);
    setConfirmId(null);

    // 삭제된 도시 ID를 쿼리 파라미터에 추가
    const currentRemoved = Array.from(removedIds);
    if (!removedIds.has(confirmId)) {
      currentRemoved.push(confirmId);
    }

    // 현재 남아있는 새로 추가한 도시들로 added 파라미터 업데이트
    const remainingNewCities = updatedCurrent
      .filter(c => c.isNew)
      .map(({ id, name, countryCode, lat, lng }) => {
        const countryName = getCountryName(countryCode);
        return { id, name, country: countryName, countryCode, lat, lng };
      });

    const removedParam = encodeURIComponent(JSON.stringify(currentRemoved));

    let newUrl = "/record/edit";
    const params = new URLSearchParams();

    if (remainingNewCities.length > 0) {
      params.set("added", encodeURIComponent(JSON.stringify(remainingNewCities)));
    }

    if (currentRemoved.length > 0) {
      params.set("removed", removedParam);
    }

    if (params.toString()) {
      newUrl += `?${params.toString()}`;
    }

    router.push(newUrl);

    toast.success("도시가 삭제되었습니다. 저장 시 변경사항이 반영됩니다");
  };

  const handleCancelDelete = () => setConfirmId(null);

  const handleSave = async () => {
    if (isSaving) return;

    const { token } = getAuthInfo();
    if (!token) {
      router.push("/login");
      return;
    }

    sendGAEvent("event", "cityedit_save_click", {
      flow: "editor",
      screen: "cityedit",
      click_code: "editor.cityedit.header.save",
      initial_city_count: initialCityCount.current,
      current_city_count: current.length,
    });

    setIsSaving(true);
    const startTime = Date.now();
    const minLoadingDuration = 1300; // 최소 1.3초

    try {
      // 추가된 도시들 (current에 있지만 base에 없거나 isNew인 것)
      const addedCities = current.filter(c => !baseIds.has(c.id) || c.isNew);

      // 삭제된 도시들 (removedIds에 있는 ID들에 해당하는 삭제된 도시 정보 찾기)
      const deletedCities = Array.from(removedIds)
        .map(id => deletedCitiesInfo.get(id))
        .filter((city): city is NonNullable<typeof city> => city !== undefined);

      console.log(`[Save] 추가할 도시:`, addedCities);
      console.log(`[Save] 삭제할 도시:`, deletedCities);

      // 추가된 도시들을 City 타입으로 변환 (배열로 한번에 전송)
      const citiesToAdd: City[] = addedCities.map(city => ({
        id: city.id,
        name: city.name,
        country: getCountryName(city.countryCode),
        flag: "", // 필요 없음
        lat: city.lat,
        lng: city.lng,
        countryCode: city.countryCode,
      }));

      // 삭제된 도시들을 DeleteTravelRecord 타입으로 변환
      const deletePromises = deletedCities.map(city => {
        const deleteRecord = {
          countryCode: city.countryCode,
          cityName: city.name,
          lat: city.lat,
          lng: city.lng,
        };
        console.log(`[Save] 도시 삭제 요청:`, deleteRecord);
        return deleteMemberTravel({ travelRecord: deleteRecord, token });
      });

      // 추가 요청 (배열로 한번에 전송)
      let addPromise: Promise<CreateTravelRecordsResponse> | null = null;
      if (citiesToAdd.length > 0) {
        console.log(`[Save] 도시 추가 요청:`, citiesToAdd);
        addPromise = createMemberTravels({ cities: citiesToAdd });
      }

      console.log(`[Save] 총 ${citiesToAdd.length}개 추가, ${deletePromises.length}개 삭제 요청 시작`);

      // 모든 API 호출 실행
      const promises: Promise<unknown>[] = [...deletePromises];
      if (addPromise) {
        promises.push(addPromise);
      }
      await Promise.all(promises);
      hasSavedRef.current = true;

      console.log(`[Save] 모든 요청 성공`);

      // 최소 1.3초 동안 로딩 표시 보장
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingDuration - elapsedTime);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setIsSaving(false);
      // 성공 시 record 페이지로 이동
      router.push("/record");
    } catch (error) {
      console.error("Failed to save cities:", error);

      // 최소 1.3초 동안 로딩 표시 보장 (에러 발생 시에도)
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingDuration - elapsedTime);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setIsSaving(false);
      setShowErrorModal(true);
    }
  };

  const handleAddClick = () => {
    sendGAEvent("event", "cityedit_add_entry_click", {
      flow: "editor",
      screen: "cityedit",
      click_code: "editor.cityedit.add.entry",
      current_city_count: current.length,
    });

    // 현재 추가된 도시들(isNew: true)과 삭제된 도시 ID를 쿼리로 전달
    const newCities = current.filter(c => c.isNew);
    const removedParam =
      Array.from(removedIds).length > 0 ? encodeURIComponent(JSON.stringify(Array.from(removedIds))) : null;

    let newUrl = "/record/edit/select";
    const params = new URLSearchParams();

    if (newCities.length > 0) {
      const payload = newCities.map(({ id, name, countryCode, lat, lng }) => {
        const countryName = getCountryName(countryCode);
        return { id, name, country: countryName, countryCode, lat, lng };
      });
      params.set("added", encodeURIComponent(JSON.stringify(payload)));
    }

    if (removedParam) {
      params.set("removed", removedParam);
    }

    if (params.toString()) {
      newUrl += `?${params.toString()}`;
    }

    router.push(newUrl);
  };

  return (
    <main className="flex items-center justify-center min-h-dvh w-full bg-surface-secondary">
      <div className="bg-surface-secondary relative w-full max-w-[512px] h-dvh flex flex-col">
        <EditToastContainer />
        <LoadingOverlay show={isSaving} />

        <div className="max-w-[512px] mx-auto w-full">
          <Header
            variant="navy"
            leftIcon="back"
            onLeftClick={handleBack}
            title="도시 편집"
            rightButtonTitle="저장"
            rightButtonDisabled={!isChanged || isSaving}
            onRightClick={handleSave}
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 20,
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 flex justify-center">
          <div className="w-full max-w-lg">
            <EditContent cities={current} onAddClick={handleAddClick} onRemoveClick={handleRemove} />
          </div>
        </div>
      </div>
      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent className="w-72 bg-[#0F1A26] rounded-2xl shadow-[0px_2px_20px_0px_rgba(0,0,0,0.25)]">
          <DialogBody className="flex flex-col items-center px-5 pt-7 pb-5 gap-2.5">
            <DialogHeader className="items-center gap-1">
              <IconExclamationCircleMonoIcon className="w-10 h-10 mb-1.5" />
              <DialogTitle className="text-center text-text-primary text-lg font-bold leading-6">
                정말 삭제하시겠어요?
              </DialogTitle>
              <DialogDescription className="text-center text-text-primary text-xs font-medium leading-5">
                도시를 삭제하면, 기록도 함께 사라져요.
              </DialogDescription>
            </DialogHeader>
            <div className="w-full flex gap-2.5 mt-2.5">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-5 py-3 bg-surface-placeholder--8 rounded-2xl flex justify-center items-center"
                type="button"
              >
                <span className="text-center text-text-primary text-sm font-bold leading-5">취소</span>
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-5 py-3 bg-state-warning rounded-2xl outline-1 -outline-offset-1 outline-border-absolutewhite--4 flex justify-center items-center"
                type="button"
              >
                <span className="text-center text-text-primary text-sm font-bold leading-5">삭제</span>
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorModal} onOpenChange={() => setShowErrorModal(false)}>
        <DialogContent className="w-72 bg-[#0F1A26] rounded-2xl shadow-[0px_2px_20px_0px_rgba(0,0,0,0.25)]">
          <DialogBody className="flex flex-col items-center px-5 pt-7 pb-5 gap-2.5">
            <DialogHeader className="items-center gap-1">
              <IconExclamationCircleMonoIcon className="w-10 h-10 mb-1.5" />
              <DialogTitle className="text-center text-text-primary text-lg font-bold leading-6">
                저장에 실패했습니다.
              </DialogTitle>
              <DialogDescription className="text-center text-text-primary text-xs font-medium leading-5">
                다시 시도해주세요.
              </DialogDescription>
            </DialogHeader>
            <button
              onClick={() => setShowErrorModal(false)}
              className="w-full px-5 py-3 bg-surface-placeholder--8 rounded-2xl flex justify-center items-center mt-2.5"
              type="button"
            >
              <span className="text-center text-text-primary text-sm font-bold leading-5">닫기</span>
            </button>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={showCannotDeleteModal} onOpenChange={() => setShowCannotDeleteModal(false)}>
        <DialogContent className="w-72 bg-[#0F1A26] rounded-2xl shadow-[0px_2px_20px_0px_rgba(0,0,0,0.25)]">
          <DialogBody className="flex flex-col items-center px-5 pt-7 pb-5 gap-2.5">
            <DialogHeader className="items-center gap-1">
              <IconExclamationCircleMonoIcon className="w-10 h-10 mb-1.5" />
              <DialogTitle className="text-center text-text-primary text-lg font-bold leading-6">
                이 도시를 지울 수 없어요
              </DialogTitle>
              <DialogDescription className="text-center text-text-primary text-xs font-medium leading-5">
                지구본을 유지하려면 최소 1개의 도시가 필요해요
              </DialogDescription>
            </DialogHeader>
            <button
              onClick={() => setShowCannotDeleteModal(false)}
              className="w-full px-5 py-3 bg-surface-placeholder--16 rounded-2xl flex justify-center items-center mt-2.5"
              type="button"
            >
              <span className="text-center text-text-primary text-sm font-bold leading-5">확인</span>
            </button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </main>
  );
}
