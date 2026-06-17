type Listener = (count: number) => void;
let _count = 0;
const listeners = new Set<Listener>();

export function setAetherisCount(count: number) {
  _count = count;
  listeners.forEach((fn) => fn(count));
}

export function getAetherisCount(): number {
  return _count;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
