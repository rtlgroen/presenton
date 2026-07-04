export function withHash(color: string) {
  return color.startsWith("#") ? color : `#${color}`;
}

export function withoutHash(color: string) {
  return color.replace("#", "").toUpperCase();
}
