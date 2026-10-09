/** Touch keeps vertical scrolling native; only a deliberate horizontal gesture turns the view. */
export function createRaftLookGesture() {
  let press: { id: number; x: number; y: number; lastX: number; lastY: number; touch: boolean; dragging: boolean } | null = null;
  return {
    begin(id: number, x: number, y: number, touch: boolean) { press = { id, x, y, lastX: x, lastY: y, touch, dragging: false }; },
    move(id: number, x: number, y: number): { yaw: number; pitch: number } | null {
      if (!press || id !== press.id) return null;
      const dx = x - press.x, dy = y - press.y;
      if (!press.dragging) {
        if (Math.hypot(dx, dy) < 6) return null;
        if (press.touch && Math.abs(dy) > Math.abs(dx)) { press = null; return null; }
        press.dragging = true;
      }
      const change = { yaw: -(x - press.lastX) * .004, pitch: press.touch ? 0 : (y - press.lastY) * .003 };
      press.lastX = x; press.lastY = y; return change;
    },
    end(id: number) { const tap = Boolean(press && press.id === id && !press.dragging); press = null; return tap; },
    cancel() { press = null; },
  };
}
