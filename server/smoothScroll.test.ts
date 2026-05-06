import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterRouteScroll, navigateWithSmoothScroll, smoothScrollToElement, smoothScrollToHash, smoothScrollToTop } from "../client/src/lib/smoothScroll";

describe("shared smooth-scroll helpers", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalPopStateEvent = globalThis.PopStateEvent;
  const scrollTo = vi.fn();
  const pushState = vi.fn();
  const dispatchEvent = vi.fn();
  const matchMedia = vi.fn();
  const getElementById = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollTo.mockReset();
    pushState.mockReset();
    dispatchEvent.mockReset();
    matchMedia.mockReset();
    getElementById.mockReset();
    matchMedia.mockReturnValue({ matches: false });

    vi.stubGlobal("PopStateEvent", class MockPopStateEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    });
    vi.stubGlobal("window", {
      scrollY: 240,
      scrollTo,
      setTimeout,
      matchMedia,
      history: { pushState },
      dispatchEvent,
    });
    vi.stubGlobal("document", { getElementById });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.stubGlobal("window", originalWindow);
    vi.stubGlobal("document", originalDocument);
    vi.stubGlobal("PopStateEvent", originalPopStateEvent);
  });

  it("scrolls to the top with smooth behaviour by default", () => {
    smoothScrollToTop(25);

    expect(scrollTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
  });

  it("uses automatic scrolling when reduced motion is preferred", () => {
    matchMedia.mockReturnValue({ matches: true });

    smoothScrollToTop();
    vi.runOnlyPendingTimers();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("scrolls to an element using the configured header offset", () => {
    getElementById.mockReturnValue({ getBoundingClientRect: () => ({ top: 500 }) });

    smoothScrollToElement("shop-checkout", 10, 100);
    vi.advanceTimersByTime(10);

    expect(getElementById).toHaveBeenCalledWith("shop-checkout");
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, left: 0, behavior: "smooth" });
  });

  it("falls back to top scrolling when a hash target is missing", () => {
    getElementById.mockReturnValue(null);

    smoothScrollToHash("#missing-section");
    vi.runOnlyPendingTimers();
    vi.runOnlyPendingTimers();

    expect(getElementById).toHaveBeenCalledWith("missing-section");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
  });

  it("navigates with a router setter and schedules the destination hash scroll", () => {
    const setLocation = vi.fn();
    getElementById.mockReturnValue({ getBoundingClientRect: () => ({ top: 300 }) });

    navigateWithSmoothScroll("/shop#shop-checkout", setLocation, 15);
    vi.advanceTimersByTime(15);

    expect(setLocation).toHaveBeenCalledWith("/shop#shop-checkout");
    expect(pushState).not.toHaveBeenCalled();
    expect(getElementById).toHaveBeenCalledWith("shop-checkout");
    expect(scrollTo).toHaveBeenCalledWith({ top: 428, left: 0, behavior: "smooth" });
  });

  it("pushes browser history when no router setter is supplied", () => {
    navigateWithSmoothScroll("/booking", undefined, 5);
    vi.advanceTimersByTime(5);

    expect(pushState).toHaveBeenCalledWith({}, "", "/booking");
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "popstate" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
  });

  it("routes without a hash scroll to the top", () => {
    afterRouteScroll("/reviews", 20);
    vi.advanceTimersByTime(20);

    expect(getElementById).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
  });
});
