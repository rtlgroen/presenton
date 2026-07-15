"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import { LegacyPresentationsTable } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/LegacyPresentationsTable";
import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname } from "next/navigation";

const actionCardBase =
  "absolute aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] border border-white/50 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(16,24,40,0.18)] transition-all duration-500 ease-out opacity-100 translate-y-0 scale-100";

const FloatingActionCards = () => (
  <div className="pointer-events-none absolute right-[14px] top-[-36px] z-0 block h-[64px] w-[158px]">
    <div
      className={`${actionCardBase} left-0 top-0 border-none group-hover/action:-translate-x-2 group-hover/action:-rotate-3 group-focus-visible/action:-translate-x-2 group-focus-visible/action:-rotate-3`}
      style={{
        backgroundImage: "url('/create_presentation_card_3.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[39px] top-1 z-10 border-none group-hover/action:-translate-y-1 group-hover/action:scale-105 group-focus-visible/action:-translate-y-1 group-focus-visible/action:scale-105`}
      style={{
        backgroundImage: "url('/create_presentation_card_2.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[76px] top-0 border-none group-hover/action:translate-x-2 group-hover/action:rotate-3 group-focus-visible/action:translate-x-2 group-focus-visible/action:rotate-3`}
      style={{
        backgroundImage: "url('/create_presentation_card_1.png')",
      }}
    />
  </div>
);

const GridViewIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.33333"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path
      d="M6 2H2.66667C2.29848 2 2 2.29848 2 2.66667V6C2 6.36819 2.29848 6.66667 2.66667 6.66667H6C6.36819 6.66667 6.66667 6.36819 6.66667 6V2.66667C6.66667 2.29848 6.36819 2 6 2Z"
    />
    <path
      d="M13.3333 2H10C9.63181 2 9.33333 2.29848 9.33333 2.66667V6C9.33333 6.36819 9.63181 6.66667 10 6.66667H13.3333C13.7015 6.66667 14 6.36819 14 6V2.66667C14 2.29848 13.7015 2 13.3333 2Z"
    />
    <path
      d="M13.3333 9.33333H10C9.63181 9.33333 9.33333 9.63181 9.33333 10V13.3333C9.33333 13.7015 9.63181 14 10 14H13.3333C13.7015 14 14 13.7015 14 13.3333V10C14 9.63181 13.7015 9.33333 13.3333 9.33333Z"
    />
    <path
      d="M6 9.33333H2.66667C2.29848 9.33333 2 9.63181 2 10V13.3333C2 13.7015 2.29848 14 2.66667 14H6C6.36819 14 6.66667 13.7015 6.66667 13.3333V10C6.66667 9.63181 6.36819 9.33333 6 9.33333Z"
    />
  </svg>
);

const ListViewIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.33333"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M2 3.33333H2.00625" />
    <path d="M2 8H2.00625" />
    <path d="M2 12.6667H2.00625" />
    <path d="M5.33333 3.33333H14" />
    <path d="M5.33333 8H14" />
    <path d="M5.33333 12.6667H14" />
  </svg>
);

function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 flex min-h-[98px] w-full items-center justify-between gap-6 bg-white px-6 py-7 max-lg:flex-col max-lg:items-start">
      <h1 className="font-unbounded text-[28px] font-normal leading-none tracking-[-0.84px] text-[#101323]">
        Dashboard
      </h1>
      {/* 
      <div className="max-w-full overflow-x-auto hide-scrollbar lg:overflow-visible">
        <div className="flex h-[42.24px] w-[500.22px] max-w-none items-center gap-3 rounded-full border border-[#EDEEEF] pl-3">
          <div className="flex h-[42.24px] items-center gap-[18px] rounded-full border border-[#EDEEEF] px-3 py-1">
            <Link
              href="/settings"
              className={`${dashboardHeaderPill} h-[26.1px] gap-[6px] px-[6px] py-[6px]`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "/settings",
                  source: "dashboard_header_settings",
                })
              }
            >
              <span className="relative -my-1 flex h-[34.1px] w-[39.78px] shrink-0 items-center rounded-full border border-[#EDEEEF] bg-[#EDEEEF]">
                <span className="absolute left-0 top-[6px] flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full border border-[#EDEEEF] bg-white">
                  <Image
                    src="/providers/OpenAI-black.png"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={14}
                    className="h-[14px] w-[14px] object-contain"
                  />
                </span>
                <span className="absolute left-[17.6px] top-[6px] flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full border border-[#EDEEEF] bg-white">
                  <Image
                    src="/providers/gemini-color.svg"
                    alt=""
                    aria-hidden="true"
                    width={14}
                    height={14}
                    className="h-[14px] w-[14px] object-contain"
                  />
                </span>
              </span>
              <span className="font-syne text-sm font-medium leading-[17.6px] tracking-[0.56px]">
                Settings
              </span>
            </Link>

            <span className="h-5 w-px shrink-0 bg-[#EDEEEF]" aria-hidden="true" />

            <Link
              href="https://github.com/presenton/presenton"
              target="_blank"
              rel="noreferrer"
              className={`${dashboardHeaderPill} h-[29.6px] gap-[8.8px] px-[6px] py-[6px]`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "https://github.com/presenton/presenton",
                  source: "dashboard_header_github",
                })
              }
            >
              <Github className="h-[17.6px] w-[17.6px] text-[#191919]" strokeWidth={1.1} />
              <span className="flex items-center gap-[6.6px] font-syne text-sm font-normal leading-none tracking-[-0.14px] text-[#191919]">
                Star
                <span className="h-[2.2px] w-[2.2px] rounded-full bg-[#C3C3CB]" />
                <span className="text-xs font-medium tracking-[-0.12px]">57.4k</span>
              </span>
            </Link>

            <span className="h-5 w-px shrink-0 bg-[#EDEEEF]" aria-hidden="true" />

            <Link
              href="https://discord.com/invite/9ZsKKxudNE"
              target="_blank"
              rel="noreferrer"
              className={`${dashboardHeaderPill} h-[29.6px] gap-[8.8px] px-[6px] py-[6px]`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "https://discord.com/invite/9ZsKKxudNE",
                  source: "dashboard_header_discord",
                })
              }
            >
              <span className="flex h-[17.6px] w-[17.6px] items-center justify-center">
                <Image
                  src="/discord.png"
                  alt=""
                  aria-hidden="true"
                  width={18}
                  height={18}
                  className="h-[17.6px] w-[17.6px] rounded-full object-cover"
                />
              </span>
              <span className="font-syne text-sm font-normal leading-none tracking-[-0.14px] text-[#191919]">
                Join Discord
              </span>
            </Link>
          </div>

          <Link
            href="/upload"
            aria-label="Create presentation"
            className="relative flex h-[42.24px] w-[42.24px] shrink-0 items-center justify-center rounded-full border border-[#D9D6FE] bg-[#FAFAFF] text-[#7A5AF8] transition-colors hover:bg-[#F3F0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2"
            onClick={() =>
              trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, {
                pathname,
                source: "dashboard_header_create",
              })
            }
          >
            <Plus className="h-4 w-4" strokeWidth={1.33} aria-hidden="true" />
            <span className="absolute right-[1.28px] top-[-1px] flex h-[13.2px] w-[13.2px] items-center justify-center rounded-full border border-[#D9D6FE] bg-white">
              <span className="h-[7.92px] w-[7.92px] rounded-full bg-[#7A5AF8]" />
            </span>
          </Link>
        </div>
      </div> */}
    </header>
  );
}

const DashboardPage: React.FC = () => {
  const pathname = usePathname();
  const [presentations, setPresentations] = useState<PresentationResponse[]>([]);
  const [legacyPresentations, setLegacyPresentations] = useState<
    PresentationResponse[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deckSortDirection, setDeckSortDirection] = useState<"desc" | "asc">(
    "asc"
  );
  const [deckViewMode, setDeckViewMode] = useState<"grid" | "list">("grid");

  const sortedPresentations = useMemo(() => {
    return [...presentations].sort((a, b) => {
      const comparison = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      return deckSortDirection === "asc" ? comparison : -comparison;
    });
  }, [presentations, deckSortDirection]);

  const sortedLegacyPresentations = useMemo(
    () =>
      [...legacyPresentations].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", undefined, {
          sensitivity: "base",
        })
      ),
    [legacyPresentations]
  );

  const fetchPresentations = useCallback(async () => {
    let fetchedCount = 0;
    let hasError = false;
    try {
      setIsLoading(true);
      setError(null);
      const [supported, legacy] = await Promise.all([
        DashboardApi.getPresentations("v2-standard"),
        DashboardApi.getPresentations("v1-standard", { includeSlides: false }),
      ]);
      fetchedCount = supported.length + legacy.length;
      setPresentations(supported);
      setLegacyPresentations(legacy);
    } catch {
      hasError = true;
      setError(null);
      setPresentations([]);
      setLegacyPresentations([]);
    } finally {
      trackEvent(MixpanelEvent.Dashboard_Page_Viewed, {
        pathname,
        presentation_count: fetchedCount,
        load_failed: hasError,
      });
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void fetchPresentations();
  }, [fetchPresentations]);

  const removePresentation = (presentationId: string) => {
    setPresentations((prev) => prev.filter((p) => p.id !== presentationId));
    setLegacyPresentations((prev) =>
      prev.filter((p) => p.id !== presentationId)
    );
  };

  const removeLegacyPresentations = (presentationIds: string[]) => {
    const deletedIds = new Set(presentationIds);
    setLegacyPresentations((prev) =>
      prev.filter((presentation) => !deletedIds.has(presentation.id))
    );
  };

  return (
    <div className="relative min-h-screen w-full pb-10">
      <DashboardHeader />
      <section className="relative z-10 overflow-visible px-3 sm:px-6">
        <h2 className="font-syne text-base bg-transparent font-medium pb-3.5  text-[#333333] ">
          Actions
        </h2>
        <Link
          href="/upload"
          onClick={() =>
            trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, {
              pathname,
              source: "dashboard_actions_card",
            })
          }
          className="group/action bg-white z-50 mt-2  relative  block w-[304px] max-w-full overflow-visible rounded-[10.8px] outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-4 cursor-pointer"
          aria-label="Create presentation"
        >
          <FloatingActionCards />

          <img
            src="/create_presentation_bg.png"
            alt="Background of the create presentation card"
            className="relative bg-white z-10 h-[89.983px] w-[304px] max-w-full rounded-[10.8px] object-cover"
          />
          <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center font-syne text-sm font-medium text-[#191919]">
            Create Presentation
          </span>
        </Link>
      </section>
      <section className="relative z-10 mt-[46px] px-3 sm:px-6">
        <div className="mb-[14px] flex items-center justify-between gap-4">
          <h2 className="font-syne text-base font-medium text-[#191919]">
            Decks
          </h2>
          <div className="flex items-center gap-[17px]">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded text-[13px] font-medium tracking-[-0.39px] text-[#191919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"
              title="Toggle alphabetical deck order"
              aria-label={`Sort decks ${deckSortDirection === "asc" ? "Z to A" : "A to Z"}`}
              onClick={() =>
                setDeckSortDirection((current) =>
                  current === "asc" ? "desc" : "asc"
                )
              }
            >
              {deckSortDirection === "asc" ? "A to Z" : "Z to A"}
              <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className="h-5 w-px bg-[#EDEEEF]" aria-hidden="true" />
            <div className="flex items-center rounded border border-[#EDEEEF] p-1">
              <button
                type="button"
                onClick={() => setDeckViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={deckViewMode === "grid"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] ${deckViewMode === "grid" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <GridViewIcon />
              </button>
              <button
                type="button"
                onClick={() => setDeckViewMode("list")}
                aria-label="List view"
                aria-pressed={deckViewMode === "list"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] ${deckViewMode === "list" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <ListViewIcon />
              </button>
            </div>
          </div>
        </div>
        <PresentationGrid
          presentations={sortedPresentations}
          viewMode={deckViewMode}
          isLoading={isLoading}
          error={error}
          onPresentationDeleted={removePresentation}
          onPresentationDuplicated={(presentation) =>
            setPresentations((prev) => [presentation, ...prev])
          }
        />
      </section>
      {!isLoading && sortedLegacyPresentations.length > 0 && (
        <div className="relative z-10 mt-[46px] px-3 sm:px-6">
          <LegacyPresentationsTable
            presentations={sortedLegacyPresentations}
            onPresentationsDeleted={removeLegacyPresentations}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
