import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import React, { useEffect, useRef } from "react";

export const LINE_OFFICIAL_URL = "https://lin.ee/qH2pGrv";
export const LINE_QR_URL = "/manus-storage/caishen-line-qr_81229f12.png";
const CONTACT_HISTORY_MARKER = "__caishenContactDialog";
const CONTACT_OPEN_BODY_FLAG = "caishenContactDialogOpen";
const CONTACT_CLOSING_BODY_FLAG = "caishenContactDialogClosing";

export function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const historyEntryRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    document.body.dataset[CONTACT_OPEN_BODY_FLAG] = "true";
    if (!window.history.state?.[CONTACT_HISTORY_MARKER]) {
      window.history.pushState(
        { ...(window.history.state ?? {}), [CONTACT_HISTORY_MARKER]: true },
        "",
        window.location.href,
      );
    }
    historyEntryRef.current = true;

    const closeFromHistory = () => {
      if (!historyEntryRef.current) return;
      historyEntryRef.current = false;
      onOpenChangeRef.current(false);
    };
    window.addEventListener("popstate", closeFromHistory);

    return () => {
      historyEntryRef.current = false;
      if (document.body.dataset[CONTACT_OPEN_BODY_FLAG] === "true") {
        delete document.body.dataset[CONTACT_OPEN_BODY_FLAG];
      }
      window.removeEventListener("popstate", closeFromHistory);
    };
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (historyEntryRef.current && window.history.state?.[CONTACT_HISTORY_MARKER]) {
      historyEntryRef.current = false;
      document.body.dataset[CONTACT_CLOSING_BODY_FLAG] = "true";
      const clearClosingFlag = () => {
        delete document.body.dataset[CONTACT_CLOSING_BODY_FLAG];
        window.removeEventListener("popstate", clearClosingFlag);
      };
      window.addEventListener("popstate", clearClosingFlag);
      window.setTimeout(clearClosingFlag, 750);
      onOpenChange(false);
      window.history.back();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-sm">
        <div className="bg-emerald-600 px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <MessageCircle className="size-5" />與我們聯絡
            </DialogTitle>
            <DialogDescription className="text-emerald-50">
              掃描或點擊 QR 碼，加入財神 LINE 官方帳號。
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 text-center">
          <a
            href={LINE_OFFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="前往財神 LINE 官方帳號"
            className="mx-auto block max-w-[280px] rounded-3xl bg-white p-3 shadow-lg ring-1 ring-stone-200 transition-transform active:scale-[.98]"
          >
            <img src={LINE_QR_URL} alt="財神 LINE 官方帳號 QR 碼" className="aspect-square w-full rounded-2xl" />
          </a>
          <p className="mt-4 text-sm font-semibold text-stone-600">點擊 QR 碼即可開啟 LINE</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
