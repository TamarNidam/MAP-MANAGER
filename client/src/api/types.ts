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

export type MapObjectDto = {
  id: string;
  name: string;
  objectType: string;
  layerId: string;
  createdBy: string;
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
  coordinates: [number, number];
};

export type CreatePolygonRequest = {
  name: string;
  layerId: string;
  createdBy: string;
  coordinates: number[][][];
};

export type DeleteResultDto = { deletedCount: number };

export type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
};