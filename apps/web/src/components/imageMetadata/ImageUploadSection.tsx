"use client";

import { useRef, useState } from "react";

import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ImageTag } from "@globber/shared/types/imageMetadata";
import { PlusIcon } from "lucide-react";

import type { UploadMetadata } from "./hooks/useImageMetadata";
import { ImageCarousel } from "./ImageCarousel";
import type { LocationSelection } from "./LocationSelectBottomSheet";

interface ImageUploadSectionProps {
  metadataList: UploadMetadata[];
  fileUploadId: string;
  handleRemove: (id: string) => void;
  handleImageUpdate: (id: string, url: string) => void;
  handleTagChange: (id: string, tag: ImageTag | null) => void;
  handleDateChange: (id: string, date: string | null) => void;
  handleLocationChange: (id: string, location: LocationSelection | null) => void;
  handleReorder?: (oldIndex: number, newIndex: number) => void;
}

interface SortableImageCardProps {
  id: string;
  isPressing: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

const SortableImageCard = ({
  id,
  isPressing,
  onPressStart,
  onPressEnd,
  scrollContainerRef,
  children,
}: SortableImageCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const touchStartXRef = useRef(0);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 0 : 1,
    touchAction: "none" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onTouchStart={e => {
        touchStartXRef.current = e.touches[0].clientX;
        onPressStart();
        listeners?.onTouchStart?.(e);
      }}
      onTouchMove={e => {
        if (!isDragging && scrollContainerRef.current) {
          const dx = e.touches[0].clientX - touchStartXRef.current;
          scrollContainerRef.current.scrollLeft -= dx;
          touchStartXRef.current = e.touches[0].clientX;
        }
      }}
      onTouchEnd={e => {
        onPressEnd();
        listeners?.onTouchEnd?.(e);
      }}
      onTouchCancel={e => {
        onPressEnd();
        listeners?.onTouchCancel?.(e);
      }}
      onContextMenu={e => e.preventDefault()}
      className="shrink-0 outline-none select-none relative dnd-no-image-menu"
    >
      <div
        style={{
          transform: isPressing && !isDragging ? "scale(0.96)" : "scale(1)",
          transition: "transform 0.2s ease, filter 0.2s ease",
          borderRadius: "0.75rem",
        }}
        className="relative origin-center"
      >
        {isPressing && !isDragging && (
          <div className="absolute inset-0 bg-black/40 rounded-xl z-20 pointer-events-none" />
        )}
        {children}
      </div>
    </div>
  );
};

export const ImageUploadSection = ({
  metadataList,
  fileUploadId,
  handleRemove,
  handleImageUpdate,
  handleTagChange,
  handleDateChange,
  handleLocationChange,
  handleReorder,
}: ImageUploadSectionProps) => {
  const hasImages = metadataList.length > 0;
  const MAX_IMAGES = 3;
  const metadataCount = metadataList.length;
  const placeholderCount = Math.max(0, MAX_IMAGES - metadataCount - (hasImages ? 0 : 1));

  const [activeId, setActiveId] = useState<string | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 15,
      },
    })
  );

  const triggerFileInput = () => {
    document.getElementById(fileUploadId)?.click();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setPressingId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setPressingId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = metadataList.findIndex(item => item.id === active.id);
      const newIndex = metadataList.findIndex(item => item.id === over.id);
      if (handleReorder) {
        handleReorder(oldIndex, newIndex);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setPressingId(null);
  };

  const activeMetadata = metadataList.find(m => m.id === activeId);
  const isDndEnabled = metadataList.length > 1;

  const renderContent = () => (
    <div
      ref={scrollContainerRef}
      className="flex gap-4 overflow-x-auto px-4 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ touchAction: "pan-x", minHeight: hasImages ? undefined : "460px" }}
    >
      {!hasImages && (
        <div className="shrink-0">
          <button
            type="button"
            onClick={triggerFileInput}
            aria-label="사진 추가 (최대 3장)"
            className="relative select-none w-[250.784px] mx-auto cursor-pointer block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <div className="overflow-hidden rounded-xl border border-[#272727] bg-[#141414] hover:bg-black/40 transition-colors">
              <div className="w-[251px] h-[445px] flex flex-col items-center justify-center gap-3 px-6 text-center">
                <PlusIcon size={32} aria-hidden />
                <p className="text-sm text-white/60 leading-relaxed">
                  사진은 최대 3장까지
                  <br />
                  업로드할 수 있어요.
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {isDndEnabled ? (
        <SortableContext items={metadataList.map(m => m.id)} strategy={horizontalListSortingStrategy}>
          {metadataList.map(metadata => (
            <SortableImageCard
              key={metadata.id}
              id={metadata.id}
              isPressing={pressingId === metadata.id}
              onPressStart={() => setPressingId(metadata.id)}
              onPressEnd={() => {
                if (pressingId === metadata.id) setPressingId(null);
              }}
              scrollContainerRef={scrollContainerRef}
            >
              <ImageCarousel
                image={metadata}
                onRemove={handleRemove}
                onImageUpdate={handleImageUpdate}
                onTagChange={tag => handleTagChange(metadata.id, tag)}
                onDateChange={yearMonth => handleDateChange(metadata.id, yearMonth)}
                onLocationChange={location => handleLocationChange(metadata.id, location)}
              />
            </SortableImageCard>
          ))}
        </SortableContext>
      ) : (
        metadataList.map(metadata => (
          <div key={metadata.id} className="shrink-0">
            <ImageCarousel
              image={metadata}
              onRemove={handleRemove}
              onImageUpdate={handleImageUpdate}
              onTagChange={tag => handleTagChange(metadata.id, tag)}
              onDateChange={yearMonth => handleDateChange(metadata.id, yearMonth)}
              onLocationChange={location => handleLocationChange(metadata.id, location)}
            />
          </div>
        ))
      )}

      {Array.from({ length: placeholderCount }).map((_, index) => (
        <div key={`empty-${index}`} className="shrink-0">
          <button
            type="button"
            onClick={triggerFileInput}
            aria-label="사진 추가"
            className="relative select-none w-[250.784px] mx-auto cursor-pointer block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <div className="overflow-hidden rounded-xl border border-[#272727] bg-[#141414] hover:bg-black/40 transition-colors">
              <div className="w-[251px] h-[445px] flex flex-col items-center justify-center gap-3">
                <PlusIcon size={32} aria-hidden />
              </div>
            </div>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {isDndEnabled ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {renderContent()}
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: "1",
                  },
                },
              }),
            }}
          >
            {activeMetadata ? (
              <div
                style={{
                  transform: "scale(1.08) rotate(-2deg)",
                  transformOrigin: "center center",
                  transition: "none",
                }}
                className="shrink-0 relative outline-none select-none dnd-no-image-menu"
              >
                <div className="absolute inset-0 border-2 border-[#0097C1] rounded-xl z-20 pointer-events-none" />
                <ImageCarousel
                  image={activeMetadata}
                  onRemove={() => {}}
                  onImageUpdate={handleImageUpdate}
                  onTagChange={() => {}}
                  onDateChange={() => {}}
                  onLocationChange={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        renderContent()
      )}
    </>
  );
};
