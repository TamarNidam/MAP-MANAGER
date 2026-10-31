export type GeoPointDto = { lat: number; lon: number };

export type ObjectTypeDto = { id: string; label: string };

export type LayerDto = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LayerRequest = { name: string; color: string };

export type MapObjectDto = {
  id: string;
  name: string;
  objectType: string;
  layerId: string;
  createdBy: string;
  color?: string | null;
  coordinates: [number, number];
  center: GeoPointDto;
  createdAt: string;
  updatedAt: string;
};

export type PolygonDto = {
  id: string;
  name: string;
  layerId: string;
  createdBy: string;
  color?: string | null;
  shape?: "polygon" | "rectangle" | "circle";
  radiusMeters?: number | null;
  coordinates: number[][][];
  center: GeoPointDto;
  createdAt: string;
  updatedAt: string;
};

export type CreateMapObjectRequest = {
  name: string;
  objectType: string;
  layerId: string;
  createdBy: string;
  color?: string;
  coordinates: [number, number];
};

export type CreatePolygonRequest = {
  name: string;
  layerId: string;
  createdBy: string;
  color?: string;
  shape?: "polygon" | "rectangle" | "circle";
  radiusMeters?: number;
  coordinates: number[][][];
};

export type UpdateMapObjectRequest = {
  name: string;
  objectType: string;
  layerId: string;
  color?: string;
  coordinates: [number, number];
};

export type UpdatePolygonRequest = {
  name: string;
  layerId: string;
  color?: string;
  shape: "polygon" | "rectangle" | "circle";
  radiusMeters?: number;
  coordinates: number[][][];
};

export type DeleteResultDto = { deletedCount: number };

export type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
};

export type MapDataItemDto =
  | (MapObjectDto & { kind: "object" })
  | (PolygonDto & { kind: "polygon" });

export type MapDataPageDto = {
  items: MapDataItemDto[];
  nextCursor: string | null;
};

export type MapDataQuery = {
  type?: string;
  creator?: string;
  createdWithinDays?: number;
  within?: string;
  q?: string;
  bbox?: string;
  limit: number;
  cursor?: string;
};