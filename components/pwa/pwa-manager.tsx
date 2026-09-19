"use client";

import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaManager() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setOnline(navigator.onLine));
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    const onOnline = () => { setOnline(true); navigator.serviceWorker.controller?.postMessage({ type: "FLUSH_QUEUE" }); };
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((value) => {
      registration = value;
      if (value.waiting) setWaiting(value.waiting);
      value.addEventListener("updatefound", () => {
        const worker = value.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); });
      });
    });
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("beforeinstallprompt", onInstall);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      void registration;
    };
  }, []);

  if (dismissed || (online && !installPrompt && !waiting)) return null;
  return <div className="fixed bottom-24 left-1/2 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border bg-card p-3 text-card-foreground shadow-2xl lg:bottom-5">
    {!online ? <WifiOff className="size-5 text-amber-600" /> : waiting ? <RefreshCw className="size-5 text-primary" /> : <Download className="size-5 text-primary" />}
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{!online ? "You’re offline" : waiting ? "Update ready" : "Install SonicPages"}</p><p className="truncate text-xs text-muted-foreground">{!online ? "Saved documents remain available." : waiting ? "Refresh to use the latest version." : "Read saved documents like an app."}</p></div>
    {waiting ? <Button size="sm" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Update</Button> : installPrompt ? <Button size="sm" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}>Install</Button> : null}
    {online ? <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} aria-label="Dismiss"><X className="size-4" /></Button> : null}
  </div>;
}
