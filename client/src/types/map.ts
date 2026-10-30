import type { GeoPointDto, MapObjectDto, PolygonDto } from "../api/types";
import type { DrawingShape } from "../map/coords";

export type ItemKind = "object" | "polygon";
export type Selection = { kind: ItemKind; id: string } | null;
export type { DrawingShape };

export type PendingObject = {
  id: string;
  objectType: string;
  point: [number, number];
};

export type PendingPolygon = {
  id: string;
  coordinates: number[][][];
  center: [number, number];
};

export type TableItem = {
  id: string;
  kind: ItemKind;
  label: string;
  center: GeoPointDto;
  createdAt: string;
  saved: boolean;
};

export type MapObject = MapObjectDto & { kind: "object" };
export type MapPolygon = PolygonDto & { kind: "polygon" };