"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowUpDown, ChevronDown } from "lucide-react";
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

const dashboardHeaderPill =
  "inline-flex shrink-0 items-center rounded-full border border-[#EDEEEF] bg-white text-[#191919] transition-colors hover:bg-[#FAFAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2";

function DashboardHeader({ pathname }: { pathname: string }) {
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
    "desc"
  );

  const sortedPresentations = useMemo(() => {
    return [...presentations].sort((a, b) => {
      const first = new Date(a.updated_at ?? a.created_at).getTime();
      const second = new Date(b.updated_at ?? b.created_at).getTime();

      return deckSortDirection === "desc" ? second - first : first - second;
    });
  }, [presentations, deckSortDirection]);

  const sortedLegacyPresentations = useMemo(() => {
    return [...legacyPresentations].sort((a, b) => {
      const first = new Date(a.updated_at ?? a.created_at).getTime();
      const second = new Date(b.updated_at ?? b.created_at).getTime();

      return deckSortDirection === "desc" ? second - first : first - second;
    });
  }, [legacyPresentations, deckSortDirection]);

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

  return (
    <div className="relative min-h-screen w-full pb-10">
      <DashboardHeader pathname={pathname} />
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
      <section className="relative z-10 mt-12 px-3 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-syne text-base font-medium  text-[#333333] ">
            Decks
          </h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#2F3033] transition-colors hover:bg-[#F3F3F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]"
            title="Toggle deck sort order"
            aria-label="Toggle deck sort order"
            onClick={() =>
              setDeckSortDirection((current) =>
                current === "desc" ? "asc" : "desc"
              )
            }
          >
            <ArrowUpDown
              className={`h-4 w-4 transition-transform duration-300 ${deckSortDirection === "asc" ? "rotate-180" : ""
                }`}
            />
          </button>
        </div>
        {!isLoading && sortedLegacyPresentations.length > 0 && (
          <details className="group/archive mb-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Archive className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-950">
                  Unsupported presentations
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs text-amber-900">
                    {sortedLegacyPresentations.length}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-amber-800">
                  These decks were created in an older version and cannot be opened here. Downgrade to a compatible Presenton version if you need to access them.
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-amber-700 transition-transform group-open/archive:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-amber-200 bg-white/70 p-4 sm:p-5">
              <PresentationGrid
                presentations={sortedLegacyPresentations}
                onPresentationDeleted={removePresentation}
              />
            </div>
          </details>
        )}
        <PresentationGrid
          presentations={sortedPresentations}
          isLoading={isLoading}
          error={error}
          onPresentationDeleted={removePresentation}
          onPresentationDuplicated={(presentation) =>
            setPresentations((prev) => [presentation, ...prev])
          }
        />
      </section>
    </div>
  );
};

export default DashboardPage;
