// Verifies timeout, network translation, retry policy, DELETE 404 handling, and conflict handling.
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";
import { CONFLICT_MESSAGE, rethrowConflict } from "./conflict";
import { withRetry } from "./retry";

const noDelay = () => 0;
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("request errors", () => {
  it("translates a network failure into ApiError status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.getLayers()).rejects.toMatchObject({ status: 0, message: "Cannot reach the server" });
  });

  it("times out a stalled request", async () => {
    // AbortSignal.timeout uses a native timer that fake timers cannot advance, so drive it by hand.
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    })));
    const result = expect(api.getLayers()).rejects.toMatchObject({ status: 0, message: "The server took too long to respond" });
    timeout.abort();
    await result;
    expect(AbortSignal.timeout).toHaveBeenCalledWith(10_000);
  });
});

describe("withRetry", () => {
  it("retries 503 and then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(503, { title: "Unavailable" }))
      .mockResolvedValueOnce(json(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await expect(withRetry(() => api.getLayers(), noDelay)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network errors", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await expect(withRetry(() => api.getLayers(), noDelay)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(400, { title: "Bad request" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(withRetry(() => api.getLayers(), noDelay)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after three retries", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(withRetry(() => api.getLayers(), noDelay)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("delete", () => {
  it("treats 404 as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => json(404, { title: "Not found" })));
    await expect(api.deleteObject("a")).resolves.toBeUndefined();
    await expect(api.deletePolygon("b")).resolves.toBeUndefined();
  });

  it("still fails on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => json(400, { title: "Bad" })));
    await expect(api.deleteObject("a")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("conflicts", () => {
  it("turns a 409 into the conflict message, refetches, and does not retry", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(409, { title: "Conflict" }));
    vi.stubGlobal("fetch", fetchMock);
    const refetch = vi.fn().mockResolvedValue(undefined);
    const body = { name: "n", objectType: "jeep", layerId: "l", coordinates: [0, 0] as [number, number], version: 1 };
    await expect(
      withRetry(() => api.updateObject("a", body), noDelay).catch((error) => rethrowConflict(error, refetch)),
    ).rejects.toThrow(CONFLICT_MESSAGE);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).version).toBe(1);
  });
});
