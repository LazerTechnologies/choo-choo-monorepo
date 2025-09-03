export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

export const isAndroid = () => /Android/.test(navigator.userAgent);
