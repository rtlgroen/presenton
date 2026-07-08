"use client";
import React, { useCallback, useEffect, memo, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TemplateService, { TemplateListItem } from "../../services/api/template";
import {
  TemplatePreviewStage,
  LayoutsBadge,
  TemplateThumbnailPreview,
} from "../../components/TemplatePreviewComponents";
import { partitionTemplatesByDefault } from "../../utils/partitionTemplates";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";

const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: TemplateListItem;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
}) {
  const handleClick = useCallback(
    () => onSelect(template.id),
    [onSelect, template.id]
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onSelect(template.id);
    },
    [onSelect, template.id]
  );

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select ${template.name} template`}
      className={cn(
        "cursor-pointer relative transition-all duration-200 group overflow-hidden rounded-[22px] bg-white border outline-none",
        "hover:-translate-y-1 hover:border-[#7A5AF8] hover:ring-2 hover:ring-[#7A5AF8]/20 hover:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
        "focus-visible:-translate-y-1 focus-visible:border-[#7A5AF8] focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/30 focus-visible:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
        isSelected
          ? " border-[#7A5AF8] ring-2 ring-[#7A5AF8]/25 shadow-[0_14px_34px_rgba(34,31,54,0.12)]"
          : " border-[#E8E9EC]"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 z-30 rounded-[22px] bg-[#7A5AF8]/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      {isSelected && (
        <span className="absolute right-4 top-3.5 z-50 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#7A5AF8] text-white shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}
      <TemplatePreviewStage>
        <LayoutsBadge count={template.layout_count ?? 0} />
        <TemplateThumbnailPreview
          thumbnail={template.thumbnail}
          templateName={template.name}
        />
      </TemplatePreviewStage>
      <div className="flex items-center justify-between px-6 py-5 bg-white border-t border-[#EDEEEF] relative z-40">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900 capitalize font-syne">
            {template.name}
          </h3>
          {template.description && (
            <p className="text-xs text-gray-600 line-clamp-2 font-syne">
              {template.description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
});

function TemplateSection({
  title,
  templates,
  selectedTemplateId,
  onSelectTemplateId,
  showCreateCard = false,
}: {
  title: string;
  templates: TemplateListItem[];
  selectedTemplateId: string | null;
  onSelectTemplateId: (templateId: string) => void;
  showCreateCard?: boolean;
}) {
  if (!showCreateCard && templates.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-3 font-syne">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {showCreateCard && <CreateCustomTemplate />}
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onSelect={onSelectTemplateId}
          />
        ))}
      </div>
    </div>
  );
}

interface TemplateSelectionProps {
  selectedTemplateId: string | null;
  onSelectTemplateId: (templateId: string) => void;
}

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(
  function TemplateSelection({ selectedTemplateId, onSelectTemplateId }) {
    const [templates, setTemplates] = useState<TemplateListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const existingScript = document.querySelector(
        'script[src*="tailwindcss.com"]'
      );
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
      }
    }, []);

    useEffect(() => {
      let cancelled = false;

      const loadTemplates = async () => {
        setLoading(true);
        try {
          const response = await TemplateService.getTemplateSummaries();
          if (!cancelled) {
            setTemplates(response.items ?? []);
          }
        } catch (error) {
          console.error("Failed to load templates", error);
          if (!cancelled) {
            toast.error("Failed to load templates");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      loadTemplates();
      return () => {
        cancelled = true;
      };
    }, []);

    const { defaultTemplates, customTemplates } = useMemo(
      () => partitionTemplatesByDefault(templates),
      [templates]
    );

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 font-syne">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading templates...</span>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="space-y-[30px] mb-4">
          <TemplateSection
            title="Custom"
            templates={[]}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplateId={onSelectTemplateId}
            showCreateCard
          />
          <div className="flex items-center justify-center py-8 font-syne text-gray-600">
            No templates available.
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-[30px] mb-4">
        <TemplateSection
          title="Custom"
          templates={customTemplates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplateId={onSelectTemplateId}
          showCreateCard
        />
        <TemplateSection
          title="Built-in"
          templates={defaultTemplates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplateId={onSelectTemplateId}
        />
      </div>
    );
  }
);

export default TemplateSelection;
