// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const managementState = vi.hoisted(() => ({
  query: null as any,
  upload: vi.fn(),
  setActive: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
  reorder: vi.fn(),
  saveSettings: vi.fn(),
  invalidateAdmin: vi.fn(),
  invalidatePublic: vi.fn(),
  cancelAdmin: vi.fn(),
  setAdminData: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      carousel: {
        adminView: {
          invalidate: managementState.invalidateAdmin,
          cancel: managementState.cancelAdmin,
          getData: () => managementState.query?.data,
          setData: managementState.setAdminData,
        },
        publicView: { invalidate: managementState.invalidatePublic },
      },
    }),
    carousel: {
      adminView: { useQuery: () => managementState.query },
      upload: { useMutation: () => ({ mutateAsync: managementState.upload, isPending: false }) },
      setActive: { useMutation: () => ({ mutate: managementState.setActive, isPending: false }) },
      remove: { useMutation: () => ({ mutate: managementState.remove, isPending: false }) },
      removeMany: { useMutation: () => ({ mutate: managementState.removeMany, isPending: false }) },
      reorder: { useMutation: () => ({ mutate: managementState.reorder, isPending: false }) },
      updateSettings: { useMutation: () => ({ mutate: managementState.saveSettings, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: managementState.toastError,
    success: managementState.toastSuccess,
  },
}));

import { CarouselManagement } from "./CarouselManagement";

const slide = {
  id: 7,
  url: "/banner.png",
  storageKey: "carousel-images/banner.png",
  fileName: "banner.png",
  mimeType: "image/png",
  isActive: false,
  sortOrder: 3,
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
};

describe("CarouselManagement component", () => {
  beforeEach(() => {
    managementState.query = {
      data: {
        settings: { isVisible: false, autoplay: true, intervalMs: 1000 },
        slides: [slide],
      },
      isError: false,
      isLoading: false,
      error: null,
    };
    for (const mock of [
      managementState.upload,
      managementState.setActive,
      managementState.remove,
      managementState.removeMany,
      managementState.reorder,
      managementState.saveSettings,
      managementState.invalidateAdmin,
      managementState.invalidatePublic,
      managementState.cancelAdmin,
      managementState.setAdminData,
      managementState.toastError,
      managementState.toastSuccess,
    ]) mock.mockReset();
    managementState.upload.mockResolvedValue(slide);
    managementState.invalidateAdmin.mockResolvedValue(undefined);
    managementState.invalidatePublic.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders settings and saves visibility, autoplay, and a half-second interval", async () => {
    render(createElement(CarouselManagement));

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.change(screen.getByLabelText("換圖間隔（秒）"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存輪播設定" }));

    await waitFor(() => expect(managementState.saveSettings).toHaveBeenCalledWith({
      isVisible: true,
      autoplay: false,
      intervalSeconds: 1.5,
    }));
  });

  it("reports an unsupported upload format before calling the API", async () => {
    const { container } = render(createElement(CarouselManagement));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<svg />"], "vector.svg", { type: "image/svg+xml" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(managementState.toastError).toHaveBeenCalledWith(
      "vector.svg 格式不支援",
      { description: "請使用 JPG、PNG、WebP、GIF 或 AVIF" },
    ));
    expect(managementState.upload).not.toHaveBeenCalled();
  });

  it("calls the up/down, single delete and selected batch delete mutations for a slide", () => {
    render(createElement(CarouselManagement));

    fireEvent.click(screen.getByRole("button", { name: "上架" }));
    expect(managementState.setActive).toHaveBeenCalledWith({ id: 7, isActive: true });

    fireEvent.click(screen.getByRole("button", { name: "刪除 banner.png" }));
    expect(globalThis.confirm).toHaveBeenCalledWith("確定刪除此輪播圖片？刪除後無法復原。");
    expect(managementState.remove).toHaveBeenCalledWith({ id: 7 });

    fireEvent.click(screen.getByLabelText("選取 banner.png"));
    fireEvent.click(screen.getByRole("button", { name: "刪除已選（1）" }));
    expect(globalThis.confirm).toHaveBeenCalledWith("確定刪除已選取的 1 張輪播圖片？刪除後無法復原。");
    expect(managementState.removeMany).toHaveBeenCalledWith({ ids: [7] });
  });
});
