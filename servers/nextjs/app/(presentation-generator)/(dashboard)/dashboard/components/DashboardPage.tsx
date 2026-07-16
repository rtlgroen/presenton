"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import { LegacyPresentationsTable } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/LegacyPresentationsTable";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownUp, ArrowUp } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname } from "next/navigation";

const GITHUB_REPOSITORY_URL = "https://github.com/presenton/presenton";
const DISCORD_INVITE_URL = "https://discord.com/invite/9ZsKKxudNE";
const APP_UPDATE_URL = "https://presenton.ai/download";

const actionCardBase =
  "absolute aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] border border-white/50 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(16,24,40,0.18)] transition-all duration-500 ease-out opacity-100 translate-y-0 scale-100";

const dashboardHeaderPill =
  "inline-flex shrink-0 items-center justify-center rounded-full text-[#191919] transition-colors hover:bg-[#F8F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2";

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

function formatGitHubStars(stars: number) {
  if (stars >= 1_000_000) {
    return `${(stars / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (stars >= 1_000) {
    return `${(stars / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return stars.toLocaleString();
}

function DashboardHeader() {
  const pathname = usePathname();
  const [githubStars, setGithubStars] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchGitHubStars() {
      try {
        const response = await fetch("/api/github-stars");
        if (!response.ok) return;
        const data = (await response.json()) as { stars?: number };
        if (isMounted && typeof data.stars === "number") {
          setGithubStars(formatGitHubStars(data.stars));
        }
      } catch {
        if (isMounted) setGithubStars(null);
      }
    }

    void fetchGitHubStars();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 flex min-h-[98px] w-full items-center justify-between gap-6 bg-white px-6 py-7 max-lg:flex-col max-lg:items-start">
      <h1 className="font-unbounded text-[28px] font-normal leading-none tracking-[-0.84px] text-[#101323]">
        Dashboard
      </h1>

      <div className="max-w-full overflow-x-auto hide-scrollbar lg:overflow-visible">
        <div className="flex h-9 w-max max-w-none items-center gap-2.5">
          <div className="flex h-9 items-center gap-3 rounded-full border border-[#EDEEEF] px-3 py-1">
            <Link
              href="/settings"
              className={`${dashboardHeaderPill} h-[26px] gap-1.5 px-1.5 py-1.5`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: "/settings",
                  source: "dashboard_header_settings",
                })
              }
            >
              <span className="relative -my-1 flex h-[34.1px] w-[39.78px] shrink-0 items-center rounded-full">
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
              <span className="font-syne text-xs font-medium leading-none">
                Settings
              </span>
            </Link>

            <span className="h-5 w-px shrink-0 bg-[#EDEEEF]" aria-hidden="true" />

            <Link
              href={GITHUB_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className={`${dashboardHeaderPill} h-[29.6px] gap-1.5 px-1.5 py-1.5`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: GITHUB_REPOSITORY_URL,
                  source: "dashboard_header_github",
                })
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                <g clipPath="url(#clip0_7636_715)">
                  <path d="M2.67188 11.5293C2.69367 11.6104 2.71125 11.6923 2.72363 11.7754C2.71122 11.6921 2.69362 11.6102 2.67188 11.5293ZM1.66211 10.2041C1.70759 10.2308 1.75247 10.2582 1.7959 10.2881C1.7524 10.2582 1.70751 10.2307 1.66211 10.2041ZM0.830078 9.91895C0.923725 9.93097 1.01611 9.94969 1.10742 9.97363C1.01639 9.94976 0.924015 9.93101 0.830078 9.91895ZM7.15039 13.1992L7.15723 13.0166C7.19241 12.5935 7.35026 12.1882 7.61328 11.8516L8.20215 11.0977L7.25488 10.9678C6.4647 10.8593 5.74053 10.4689 5.21582 9.86816C4.69116 9.26736 4.4015 8.49685 4.40039 7.69922V7.15527C4.4063 6.5658 4.56241 5.98709 4.85547 5.47559L4.97461 5.26855L4.9043 5.04004C4.75868 4.57031 4.71146 4.07462 4.7666 3.58594C4.82178 3.09739 4.97805 2.62556 5.22461 2.2002V2.19922H5.22656C5.78115 2.19812 6.32815 2.32722 6.82422 2.5752C7.32049 2.82333 7.75201 3.18433 8.08398 3.62891L8.24902 3.84961H10.4512L10.6152 3.62891C10.9471 3.18442 11.3789 2.82333 11.875 2.5752C12.3712 2.32709 12.9189 2.19809 13.4736 2.19922H13.4756V2.2002C13.7222 2.6255 13.8775 3.09742 13.9326 3.58594C13.9876 4.07455 13.9407 4.56947 13.7949 5.03906L13.7246 5.26855L13.8438 5.47656C14.1371 5.98748 14.294 6.56519 14.2998 7.1543V7.69922L14.2861 7.99609C14.2229 8.68635 13.9436 9.34229 13.4844 9.86816C12.9597 10.4689 12.2355 10.8593 11.4453 10.9678L10.4971 11.0977L11.0859 11.8516C11.3866 12.2363 11.5501 12.7109 11.5498 13.1992V15.9492H7.15039V13.1992Z" stroke="#191919" strokeWidth="1.1" />
                </g>
                <defs>
                  <clipPath id="clip0_7636_715">
                    <rect width="17.6" height="17.6" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span className="flex items-center gap-1.5 font-syne text-xs font-normal leading-none text-[#191919]">
                Star
                <span className="h-[2.2px] w-[2.2px] rounded-full bg-[#C3C3CB]" />
                <span className="min-w-[28px] font-medium">
                  {githubStars ?? "--"}
                </span>
              </span>
            </Link>

            <span className="h-5 w-px shrink-0 bg-[#EDEEEF]" aria-hidden="true" />

            <Link
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              className={`${dashboardHeaderPill} h-[29.6px] gap-1.5 px-1.5 py-1.5`}
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: DISCORD_INVITE_URL,
                  source: "dashboard_header_discord",
                })
              }
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <g clipPath="url(#clip0_7636_722)">
                    <path d="M11.3667 12.8336C12.1 13.9336 12.7111 14.4225 13.2 14.6669C14.1778 14.4225 16.1333 13.3469 16.1333 11.0003C16.1333 8.65359 15.1556 5.37804 14.6667 4.03359C13.2 3.15359 11.6111 2.93359 11 2.93359L10.4119 4.10981C9.83657 3.87745 9.09759 3.85347 8.80001 3.87052C8.50242 3.85347 7.76344 3.87745 7.18812 4.10981L6.60001 2.93359C5.9889 2.93359 4.40001 3.15359 2.93334 4.03359C2.44445 5.37804 1.46667 8.65359 1.46667 11.0003C1.46667 13.3469 3.42223 14.4225 4.40001 14.6669C4.8889 14.4225 5.50001 13.9336 6.23334 12.8336" stroke="#7A5AF8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.7345 8.43249C12.7345 9.24253 12.1599 9.89915 11.4511 9.89915C10.7424 9.89915 10.1678 9.24253 10.1678 8.43249C10.1678 7.62245 10.7424 6.96582 11.4511 6.96582C12.1599 6.96582 12.7345 7.62245 12.7345 8.43249Z" stroke="#7A5AF8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7.33336 8.43249C7.33336 9.24253 6.75879 9.89915 6.05003 9.89915C5.34126 9.89915 4.76669 9.24253 4.76669 8.43249C4.76669 7.62245 5.34126 6.96582 6.05003 6.96582C6.75879 6.96582 7.33336 7.62245 7.33336 8.43249Z" stroke="#7A5AF8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12.8334 12.0996C12.0283 12.7572 10.5235 13.1996 8.80003 13.1996C7.07655 13.1996 5.57178 12.7572 4.76669 12.0996" stroke="#7A5AF8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <defs>
                    <clipPath id="clip0_7636_722">
                      <rect width="17.6" height="17.6" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </span>
              <span className="font-syne text-xs font-normal leading-none text-[#191919]">
                Join Discord
              </span>
            </Link>
          </div>

          <Link
            href={APP_UPDATE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Update Presenton"
            title="Update Presenton"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D9D6FE] bg-[#FAFAFF] text-[#7A5AF8] transition-colors hover:bg-[#F3F0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2"
            onClick={() =>
              trackEvent(MixpanelEvent.Navigation, {
                from: pathname,
                to: APP_UPDATE_URL,
                source: "dashboard_header_update_app",
                app_version:
                  typeof window !== "undefined" ? window.env?.APP_VERSION : undefined,
              })
            }
          >
            <ArrowUp className="h-4 w-4" strokeWidth={1.33} aria-hidden="true" />
            <span className="absolute right-[-1px] top-[-1px] flex h-[11px] w-[11px] items-center justify-center rounded-full border border-[#D9D6FE] bg-white">
              <span className="h-[7px] w-[7px] rounded-full bg-[#7A5AF8]" />
            </span>
          </Link>
        </div>
      </div>
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
