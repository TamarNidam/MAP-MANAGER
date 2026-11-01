// Renders the composed view model for the map workspace.
import { WorkspaceView } from "./WorkspaceView";
import { useWorkspaceViewModel } from "./hooks/useWorkspaceViewModel";

export default function Workspace() {
  return <WorkspaceView {...useWorkspaceViewModel()} />;
}
