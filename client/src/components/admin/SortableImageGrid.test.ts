import { moveImageId } from "./SortableImageGrid";
import { describe, expect, it } from "vitest";

describe("moveImageId", () => {
  it("moves a dragged image to the target position", () => {
    expect(moveImageId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
    expect(moveImageId([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("keeps the order when source or target is missing", () => {
    const ids = ["a", "b", "c"];
    expect(moveImageId(ids, "a", "missing")).toEqual(ids);
    expect(moveImageId(ids, "missing", "b")).toEqual(ids);
    expect(moveImageId(ids, "b", "b")).toEqual(ids);
  });
});
