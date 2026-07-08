"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import CreateCustomTemplate from "./CreateCustomTemplate";
import TemplateService, { TemplateListItem } from "../../../services/api/template";
import {
  TemplatePreviewStage,
  LayoutsBadge,
  TemplateThumbnailPreview,
} from "../../../components/TemplatePreviewComponents";
import { partitionTemplatesByDefault } from "../../../utils/partitionTemplates";

const DashboardTemplateCard = React.memo(function DashboardTemplateCard({
  template,
  onOpen,
}: {
  template: TemplateListItem;
  onOpen: (templateId: string) => void;
}) {
  const handleOpen = useCallback(
    () => onOpen(template.id),
    [onOpen, template.id]
  );

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden rounded-[22px] border border-[#E8E9EC] bg-white shadow-none transition-all duration-200 hover:shadow-sm"
      onClick={handleOpen}
    >
      <TemplatePreviewStage>
        <LayoutsBadge count={template.layout_count ?? 0} />
        <TemplateThumbnailPreview
          thumbnail={template.thumbnail}
          templateName={template.name}
        />
      </TemplatePreviewStage>
      <div className="relative z-40 flex items-center justify-between gap-4 border-t border-[#EDEEEF] bg-white px-6 py-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold capitalize text-gray-900">
            {template.name}
          </h3>
          {template.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">
              {template.description}
            </p>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-purple-600" />
      </div>
    </Card>
  );
});

const LayoutPreview = () => {
  const [tab, setTab] = useState<"custom" | "default">("default");
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    trackEvent(MixpanelEvent.Templates_Page_Viewed);
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

  const handleOpenPreview = useCallback(
    (templateId: string) => {
      trackEvent(MixpanelEvent.Templates_Custom_Opened, {
        template_id: templateId,
      });
      router.push(`/template-preview?id=${templateId}`);
    },
    [router]
  );

  const activeTemplates =
    tab === "custom" ? customTemplates : defaultTemplates;

  const templateCards = useMemo(
    () =>
      activeTemplates.map((template) => (
        <DashboardTemplateCard
          key={template.id}
          template={template}
          onOpen={handleOpenPreview}
        />
      )),
    [activeTemplates, handleOpenPreview]
  );

  return (
    <div className="min-h-screen relative font-syne">
      <div className="sticky top-0 right-0 z-50 py-[28px] px-6 backdrop-blur">
        <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
          <h3 className="text-[28px] tracking-[-0.84px] font-unbounded font-normal text-[#101828] flex items-center gap-2">
            Templates
          </h3>
          <div className="flex gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
            <Link
              href="/custom-template"
              onClick={() =>
                trackEvent(MixpanelEvent.Templates_New_Template_Clicked)
              }
              className="inline-flex items-center font-syne font-semibold gap-2 rounded-xl px-4 py-2.5 text-black text-sm shadow-sm hover:shadow-md"
              aria-label="Create new template"
              style={{
                borderRadius: "48px",
                background:
                  "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
              }}
            >
              <span className="hidden md:inline">New Template</span>
              <span className="md:hidden">New</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="l mx-auto px-6 py-8">
        <div className="p-1 rounded-[40px] bg-[#ffffff] w-fit border border-[#EDEEEF] flex items-center justify-center">
          <button
            className="px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]"
            onClick={() => {
              trackEvent(MixpanelEvent.Templates_Tab_Switched, {
                tab: "custom",
              });
              setTab("custom");
            }}
            style={{
              background: tab === "custom" ? "#F4F3FF" : "transparent",
              color: tab === "custom" ? "#5146E5" : "#3A3A3A",
            }}
          >
            Custom
          </button>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-1"
            width="2"
            height="17"
            viewBox="0 0 2 17"
            fill="none"
          >
            <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
          </svg>
          <button
            className="px-5 py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]"
            onClick={() => {
              trackEvent(MixpanelEvent.Templates_Tab_Switched, {
                tab: "default",
              });
              setTab("default");
            }}
            style={{
              background: tab === "default" ? "#F4F3FF" : "transparent",
              color: tab === "default" ? "#5146E5" : "#3A3A3A",
            }}
          >
            Built-in
          </button>
        </div>

        <section className="my-12">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading templates...</span>
            </div>
          ) : tab === "custom" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 items-center lg:grid-cols-4 gap-6">
              <CreateCustomTemplate />
              {templateCards}
            </div>
          ) : activeTemplates.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-600">
              No built-in templates available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {templateCards}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LayoutPreview;
