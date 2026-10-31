import type {
  CreateMapObjectRequest,
  CreatePolygonRequest,
  DeleteResultDto,
  LayerDto,
  LayerRequest,
  MapDataPageDto,
  MapDataQuery,
  MapObjectDto,
  ObjectTypeDto,
  PolygonDto,
  ProblemDetails,
  UpdateMapObjectRequest,
  UpdatePolygonRequest,
} from "./types";

const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5080").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let problem: ProblemDetails = {};
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = {};
    }
    const validationErrors = Object.entries(problem.errors ?? {}).flatMap(([field, messages]) =>
      messages.map((message) => `${field}: ${message}`));
    const message = [...[problem.title, problem.detail].filter(Boolean), ...validationErrors].join(": ") || response.statusText;
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getMapData: (query: MapDataQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return request<MapDataPageDto>(`/api/map-data?${params.toString()}`, { signal });
  },
  getObjectTypes: () => request<ObjectTypeDto[]>("/api/object-types"),
  getLayers: () => request<LayerDto[]>("/api/layers"),
  createLayer: (layer: LayerRequest) =>
    request<LayerDto>("/api/layers", { method: "POST", body: JSON.stringify(layer) }),
  updateLayer: (id: string, layer: LayerRequest) =>
    request<LayerDto>(`/api/layers/${id}`, { method: "PUT", body: JSON.stringify(layer) }),
  deleteLayer: (id: string) => request<void>(`/api/layers/${id}`, { method: "DELETE" }),
  getPolygons: () => request<PolygonDto[]>("/api/polygons?limit=1000"),
  createObjects: (items: CreateMapObjectRequest[]) =>
    request<MapObjectDto[]>("/api/objects", { method: "POST", body: JSON.stringify({ items }) }),
  createPolygons: (items: CreatePolygonRequest[]) =>
    request<PolygonDto[]>("/api/polygons", { method: "POST", body: JSON.stringify({ items }) }),
  updateObject: (id: string, item: UpdateMapObjectRequest) =>
    request<MapObjectDto>(`/api/objects/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  updatePolygon: (id: string, item: UpdatePolygonRequest) =>
    request<PolygonDto>(`/api/polygons/${id}`, { method: "PUT", body: JSON.stringify(item) }),
  deleteObject: (id: string) => request<void>(`/api/objects/${id}`, { method: "DELETE" }),
  deletePolygon: (id: string) => request<void>(`/api/polygons/${id}`, { method: "DELETE" }),
  deleteAllPolygons: () => request<DeleteResultDto>("/api/polygons", { method: "DELETE" }),
};