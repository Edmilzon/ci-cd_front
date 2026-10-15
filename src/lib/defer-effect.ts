/** Schedule effect work after React commits and keep its cleanup tied to unmounts. */
export function deferEffect(callback: () => void | (() => void)): () => void {
  let cleanup: (() => void) | undefined;
  const timer = window.setTimeout(() => {
    cleanup = callback() ?? undefined;
  }, 0);
  return () => {
    window.clearTimeout(timer);
    cleanup?.();
  };
}
