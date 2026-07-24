export interface CanvasOptions {
  width?: number;
  height?: number;
  className?: string;
}

export function createCanvasElement(
  options: CanvasOptions = {},
): HTMLCanvasElement {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return {
      width: options.width ?? 1280,
      height: options.height ?? 720,
      style: {},
      className: options.className ?? '',
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: options.width ?? 1280,
        height: options.height ?? 720,
      }),
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as HTMLCanvasElement;
  }

  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 1280;
  canvas.height = options.height ?? 720;
  canvas.className = options.className ?? '';
  canvas.style.touchAction = 'none';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  return canvas;
}
