import type { FocusEvent } from "react";

/**
 * Keeps fields visible when a mobile keyboard changes the visual viewport.
 * Forms in a locked dialog cannot rely on the document's native focus scroll.
 */
export function scrollFocusedFieldIntoView(event: FocusEvent<HTMLElement>) {
  const field = event.target;
  if (
    !(
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    )
  ) {
    return;
  }

  const scroll = () => {
    field.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  // The first frame handles ordinary focus. The second call runs after mobile
  // browsers have had a chance to resize the visual viewport for the keyboard.
  window.requestAnimationFrame(scroll);
  window.setTimeout(scroll, 300);
}
