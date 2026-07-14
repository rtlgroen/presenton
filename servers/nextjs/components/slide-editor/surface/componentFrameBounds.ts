import type Konva from "konva";

type ClientRectConfig = Parameters<Konva.Group["getClientRect"]>[0];

const frameBoundNodes = new WeakSet<Konva.Group>();

export function constrainComponentTransformBounds(node: Konva.Group) {
  if (frameBoundNodes.has(node)) return;
  frameBoundNodes.add(node);

  // Konva ignores a Group's width/height when measuring it and unions all of
  // its descendants instead. Transformer requests a skip-transform rect, so
  // answer that query with the component frame to keep layout overflow from
  // feeding back into the next resize sample.
  const getRenderedClientRect = node.getClientRect.bind(node);
  node.getClientRect = ((config: ClientRectConfig = {}) => {
    if (config.skipTransform) {
      return {
        x: 0,
        y: 0,
        width: node.width(),
        height: node.height(),
      };
    }
    return getRenderedClientRect(config);
  }) as Konva.Group["getClientRect"];
}
