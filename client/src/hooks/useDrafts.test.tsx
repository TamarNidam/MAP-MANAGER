// @vitest-environment jsdom
// Verifies that retrying Save after a lost response does not duplicate records.
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDrafts } from "./useDrafts";

type StoredObject = { id: string; clientId: string };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderDrafts() {
  return renderHook(() => useDrafts({
    activeLayerId: "layer",
    objectTypes: [{ id: "jeep", label: "Jeep" }],
    savedItems: [],
    setSelected: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshPolygonsAndMapData: vi.fn().mockResolvedValue(undefined),
  }));
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("saveDrafts", () => {
  it("does not create duplicates when the first POST response is lost", async () => {
    vi.useFakeTimers();
    const store = new Map<string, StoredObject>();
    let loseResponses = true;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const { items } = JSON.parse(init.body as string) as { items: { clientId: string }[] };
      const created = items.map((item) => {
        if (!store.has(item.clientId)) store.set(item.clientId, { id: `server-${store.size}`, clientId: item.clientId });
        return store.get(item.clientId)!;
      });
      if (loseResponses) throw new TypeError("Failed to fetch");
      return jsonResponse(201, created);
    }));

    const { result } = renderDrafts();
    act(() => result.current.addObject({ id: "draft-1", objectType: "jeep", point: [32, 34] }));
    const setError = vi.fn();

    const first = act(() => result.current.saveDrafts(setError));
    await act(() => vi.runAllTimersAsync());
    await first;
    expect(result.current.objects).toHaveLength(1);
    expect(setError).toHaveBeenLastCalledWith(expect.stringContaining("Objects were not saved"));

    loseResponses = false;
    await act(() => result.current.saveDrafts(setError));

    expect(store.size).toBe(1);
    expect(result.current.objects).toHaveLength(0);
  });

  it("keeps only the failed part of a batch and does not roll back the saved part", async () => {
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/api/objects")
      ? jsonResponse(201, [{ id: "o1" }])
      : jsonResponse(400, { title: "Invalid" }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderDrafts();
    act(() => {
      result.current.addObject({ id: "draft-1", objectType: "jeep", point: [32, 34] });
      result.current.addPolygon({ id: "draft-2", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]], center: { lat: 0, lon: 0 } });
    });
    const setError = vi.fn();
    await act(() => result.current.saveDrafts(setError));

    expect(result.current.objects).toHaveLength(0);
    expect(result.current.polygons).toHaveLength(1);
    expect(setError).toHaveBeenLastCalledWith(expect.stringContaining("Polygons were not saved"));
    expect(fetchMock.mock.calls.some(([, init]) => (init as unknown as RequestInit).method === "DELETE")).toBe(false);
  });
});
