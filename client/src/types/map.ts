import type { GeoPointDto, MapObjectDto, PolygonDto } from "../api/types";
import type { DrawingShape } from "../map/coords";
import type { LeafletPosition } from "../map/coords";

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
  center: GeoPointDto;
};

type TableItemBase = {
  id: string;
  label: string;
  name: string;
  center: GeoPointDto;
  createdAt: string;
};

export type TableItem =
  | (MapObjectDto & TableItemBase & { kind: "object"; saved: true })
  | (PolygonDto & TableItemBase & { kind: "polygon"; saved: true })
  | (PendingObject & TableItemBase & { kind: "object"; saved: false; point: LeafletPosition })
  | (PendingPolygon & TableItemBase & { kind: "polygon"; saved: false });