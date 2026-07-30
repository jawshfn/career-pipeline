import { useCallback, useEffect, useRef, useState } from "react";
import { fetchResource, getCachedResource, subscribeToResourceInvalidation } from "../services/staleResource.js";

export default function useStaleResource(resourceKey, loader, { initialErrorMessage, refreshErrorMessage }) {
  const [state, setState] = useState(() => {
    const data = getCachedResource(resourceKey);
    return { data, error: "", refreshError: "", isInitialLoading: !data };
  });
  const isMountedRef = useRef(false);
  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    const hasCachedData = Boolean(getCachedResource(resourceKey));
    setState((current) => ({ ...current, error: "", refreshError: "", isInitialLoading: !hasCachedData }));
    try {
      await fetchResource(resourceKey, loader);
      if (isMountedRef.current) setState((current) => ({ ...current, data: getCachedResource(resourceKey), isInitialLoading: false }));
    } catch (reason) {
      if (isMountedRef.current) setState((current) => ({
        ...current,
        error: hasCachedData ? "" : reason.message || initialErrorMessage,
        refreshError: hasCachedData ? refreshErrorMessage : "",
        isInitialLoading: false,
      }));
    }
  }, [initialErrorMessage, loader, refreshErrorMessage, resourceKey]);
  useEffect(() => {
    isMountedRef.current = true;
    refresh();
    const unsubscribe = subscribeToResourceInvalidation(resourceKey, refresh);
    return () => { isMountedRef.current = false; unsubscribe(); };
  }, [refresh, resourceKey]);
  return { ...state, refresh };
}
