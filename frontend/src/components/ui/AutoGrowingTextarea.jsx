import React, { useLayoutEffect, useRef } from "react";

export function resizeTextareaToContent(textarea, maxRows = 4) {
  if (!textarea) {
    return;
  }

  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
  const verticalPadding =
    (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0);
  const verticalBorders =
    (Number.parseFloat(styles.borderTopWidth) || 0) + (Number.parseFloat(styles.borderBottomWidth) || 0);
  const maxHeight = lineHeight * maxRows + verticalPadding + verticalBorders;

  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

export default function AutoGrowingTextarea({ maxRows = 4, value, ...props }) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    resizeTextareaToContent(textareaRef.current, maxRows);
  }, [maxRows, value]);

  useLayoutEffect(() => {
    const resize = () => resizeTextareaToContent(textareaRef.current, maxRows);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [maxRows]);

  return <textarea ref={textareaRef} value={value} {...props} />;
}
