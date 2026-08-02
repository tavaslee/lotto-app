import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const HISTORY_MARKER = "__caishenMobileLeaveGuard";

export function MobileLeaveGuard({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const marker = { ...(window.history.state ?? {}), [HISTORY_MARKER]: true };
    if (!window.history.state?.[HISTORY_MARKER]) {
      window.history.pushState(marker, "", window.location.href);
    }
    const handleBack = () => {
      if (leavingRef.current) return;
      if (
        document.body.dataset.caishenImageViewerOpen === "true" ||
        document.body.dataset.caishenImageViewerClosing === "true" ||
        document.body.dataset.caishenContactDialogOpen === "true" ||
        document.body.dataset.caishenContactDialogClosing === "true"
      ) return;
      window.history.pushState(marker, "", window.location.href);
      setOpen(true);
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", handleBack);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", handleBack);
    };
  }, [enabled]);

  const confirmLeave = () => {
    leavingRef.current = true;
    setOpen(false);
    if (window.history.length > 2) {
      window.history.go(-2);
      return;
    }
    window.close();
  };

  if (!enabled) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 font-bold text-stone-500 shadow-sm transition-colors hover:border-red-200 hover:text-red-700"
      >
        <LogOut className="size-3.5" />離開網站
      </button>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl border-orange-100 sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-xl font-black text-stone-900">
            是否離開本網站
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            選擇「是」將返回瀏覽器原本頁面；選擇「否」可繼續留在財神。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <AlertDialogAction
            onClick={confirmLeave}
            className="rounded-xl bg-gradient-to-r from-red-600 to-orange-500 font-black text-white hover:from-red-700 hover:to-orange-600"
          >
            是
          </AlertDialogAction>
          <AlertDialogCancel className="mt-0 rounded-xl font-black">否</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
