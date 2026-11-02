// @vitest-environment jsdom
// Verifies the card keeps the user's edits visible when saving fails with a conflict.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFLICT_MESSAGE } from "../api/conflict";
import type { TableItem } from "../types/map";
import { DetailsCard } from "./DetailsCard";

afterEach(cleanup);

const item = {
  kind: "object", saved: true, id: "a", label: "Jeep 1", name: "Jeep 1", objectType: "jeep", layerId: "l",
  createdBy: "x", coordinates: [0, 0], center: { lat: 0, lon: 0 }, createdAt: "", updatedAt: "", version: 1,
} as TableItem;

describe("DetailsCard", () => {
  it("shows the conflict message, keeps edits, and disables buttons while saving", async () => {
    let reject!: (error: Error) => void;
    const onSaveChanges = vi.fn(() => new Promise<void>((_resolve, rej) => { reject = rej; }));
    render(
      <DetailsCard
        item={item} layers={[{ id: "l", name: "L", color: "#000000", isDefault: true, createdAt: "", updatedAt: "" }]}
        onSaveChanges={onSaveChanges} onDuplicate={vi.fn()} onDelete={vi.fn()}
        geometryMode={null} geometryPending={false} geometrySessionActive={false} resetToken={0}
        onStartGeometry={vi.fn()} onStopGeometryMode={vi.fn()} onCancel={vi.fn()} onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My edit" } });
    fireEvent.click(screen.getByText("Save changes"));

    expect(screen.getByText("Saving…")).toHaveProperty("disabled", true);
    expect(screen.getByText("Delete")).toHaveProperty("disabled", true);
    reject(new Error(CONFLICT_MESSAGE));

    expect((await screen.findByRole("alert")).textContent).toBe(CONFLICT_MESSAGE);
    await waitFor(() => expect(screen.getByText("Save changes")).toHaveProperty("disabled", false));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("My edit");
  });
});
