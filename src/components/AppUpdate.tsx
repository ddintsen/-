import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { t, useLocale } from "../i18n";

/** Updates are explicit: never reload another tab, a draft or an XR session automatically. */
export function AppUpdate() {
  useLocale();
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const applying = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      import.meta.env.MODE === "standalone" ||
      !("serviceWorker" in navigator)
    )
      return;
    let disposed = false;
    let controller = navigator.serviceWorker.controller;
    const url = new URL(location.href);
    if (url.searchParams.get("orbita-update") === "1") {
      url.searchParams.delete("orbita-update");
      history.replaceState(history.state, "", url);
    }
    const showWaiting = () => {
      if (!disposed && registration.current?.waiting) setReady(true);
    };
    const onUpdateFound = () => {
      const worker = registration.current?.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          showWaiting();
      });
    };
    const onControllerChange = () => {
      const previous = controller;
      controller = navigator.serviceWorker.controller;
      if (!previous || disposed) return;
      if (applying.current) location.reload();
      else setReady(true);
    };
    const check = () => {
      if (document.visibilityState === "visible")
        void registration.current?.update().catch(() => {});
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((value) => {
        if (disposed) return;
        registration.current = value;
        value.addEventListener("updatefound", onUpdateFound);
        onUpdateFound();
        showWaiting();
        check();
      })
      .catch(() => {}); // An unavailable offline worker must not block the dashboard.
    return () => {
      disposed = true;
      registration.current?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!ready) return null;
  return (
    <div className="app-update" role="status">
      {error ? <p>{t("Не удалось обновить. Повторите.")}</p> : null}
      <Button
        variant="primary"
        busy={busy}
        disabled={busy}
        onClick={() => {
          const worker = registration.current?.waiting;
          if (!worker) {
            location.reload();
            return;
          }
          setError(false);
          setBusy(true);
          applying.current = true;
          try {
            worker.postMessage({ type: "SKIP_WAITING" });
          } catch {
            applying.current = false;
            setBusy(false);
            setError(true);
          }
        }}
      >
        {t("Обновить приложение")}
      </Button>
    </div>
  );
}
