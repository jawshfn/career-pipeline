import React, { useEffect, useRef, useState } from "react";

export default function ScrollableTable({ accessibleLabel, children }) {
  const scrollRef = useRef(null);
  const [scrollState, setScrollState] = useState({ hasOverflow: false, canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const update = () => {
      const hasOverflow = element.scrollWidth > element.clientWidth + 1;
      const canScrollLeft = hasOverflow && element.scrollLeft > 1;
      const canScrollRight = hasOverflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      setScrollState({ hasOverflow, canScrollLeft, canScrollRight });
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [children]);

  return <div className={`scrollable-table${scrollState.hasOverflow ? " scrollable-table-overflow" : ""}`}>
    {scrollState.hasOverflow ? <p aria-hidden="true" className="scrollable-table-hint">Scroll horizontally to view all metrics →</p> : null}
    <div aria-label={scrollState.hasOverflow ? accessibleLabel : undefined} className="insights-table-wrap" ref={scrollRef} tabIndex={scrollState.hasOverflow ? 0 : undefined} onScroll={() => {
      const element = scrollRef.current;
      if (!element) return;
      const hasOverflow = element.scrollWidth > element.clientWidth + 1;
      setScrollState({ hasOverflow, canScrollLeft: hasOverflow && element.scrollLeft > 1, canScrollRight: hasOverflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
    }}>
      {children}
    </div>
    {scrollState.canScrollLeft ? <span aria-hidden="true" className="scrollable-table-edge scrollable-table-edge-left" /> : null}
    {scrollState.canScrollRight ? <span aria-hidden="true" className="scrollable-table-edge scrollable-table-edge-right" /> : null}
  </div>;
}
