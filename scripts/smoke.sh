#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://localhost:8080}"
docker compose up -d --build --wait
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

status="$(curl --silent --show-error --output "$tmp_dir/object-types.json" --write-out '%{http_code}' "$base_url/api/object-types")"
if [ "$status" != "200" ]; then
  echo "GET /api/object-types returned $status" >&2
  exit 1
fi

status="$(curl --silent --show-error --output "$tmp_dir/layers.json" --write-out '%{http_code}' "$base_url/api/layers")"
if [ "$status" != "200" ]; then
  echo "GET /api/layers returned $status" >&2
  exit 1
fi

layer_id="$(python3 -c 'import json,sys; print(next(layer["id"] for layer in json.load(open(sys.argv[1])) if layer["isDefault"]))' "$tmp_dir/layers.json")"
polygon_name="Smoke polygon $(date +%s)"
payload="{\"items\":[{\"name\":\"$polygon_name\",\"layerId\":\"$layer_id\",\"createdBy\":\"smoke\",\"coordinates\":[[[34,32],[35,32],[35,33],[34,33],[34,32]]]}]}"
status="$(curl --silent --show-error --output "$tmp_dir/created.json" --write-out '%{http_code}' \
  --header 'Content-Type: application/json' --data "$payload" "$base_url/api/polygons")"
if [ "$status" != "201" ]; then
  echo "POST /api/polygons returned $status" >&2
  cat "$tmp_dir/created.json" >&2
  exit 1
fi

status="$(curl --silent --show-error --get --output "$tmp_dir/map-data.json" --write-out '%{http_code}' \
  --data-urlencode 'type=polygon' --data-urlencode "q=$polygon_name" "$base_url/api/map-data")"
if [ "$status" != "200" ]; then
  echo "GET /api/map-data returned $status" >&2
  cat "$tmp_dir/map-data.json" >&2
  exit 1
fi

python3 -c 'import json,sys; name=sys.argv[2]; items=json.load(open(sys.argv[1]))["items"]; sys.exit(0 if any(item["name"] == name for item in items) else "created polygon missing from map data")' "$tmp_dir/map-data.json" "$polygon_name"
echo "Smoke test passed through $base_url"
