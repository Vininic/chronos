export let dragCommitmentInfo: { id: string; dur: number } | null = null;

export function setDragCommitmentInfo(info: { id: string; dur: number } | null) {
  dragCommitmentInfo = info;
}

export function getDragCommitmentInfo() {
  return dragCommitmentInfo;
}
