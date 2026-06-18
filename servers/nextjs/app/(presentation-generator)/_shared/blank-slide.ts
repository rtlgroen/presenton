export const BLANK_SLIDE_LAYOUT_ID = "__blank_slide__";

export const BLANK_TEMPLATE_V2_LAYOUT = {
  id: BLANK_SLIDE_LAYOUT_ID,
  description: "Empty slide.",
  elements: [
    {
      type: "rectangle",
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
      fill: { color: "#FFFFFF" },
      fixed: true,
    },
  ],
};

export function isBlankPresentationSlide(slide: {
  layout?: unknown;
} | null | undefined) {
  if (!slide || typeof slide.layout !== "string") return false;

  return (
    slide.layout === BLANK_SLIDE_LAYOUT_ID ||
    slide.layout.endsWith(`:${BLANK_SLIDE_LAYOUT_ID}`)
  );
}
