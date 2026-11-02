import { useCallback, useEffect, useState } from "react";
import { adminRequest } from "./api";

/** Loads an admin endpoint and re-fetches when the path changes. */
export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    adminRequest<T>(path)
      .then((payload) => {
        if (active) {
          setData(payload);
          setError(null);
        }
      })
      .catch((requestError: Error) => {
        if (active) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [path, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { data, error, isLoading, reload };
}
