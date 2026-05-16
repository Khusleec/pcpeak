const { EventEmitter } = require('events');

/** In-process pub/sub. For multiple API replicas, replace with Redis pub/sub so all nodes broadcast. */
const bus = new EventEmitter();
bus.setMaxListeners(0);

function channel(cafeId) {
  return `cafe-inventory:${cafeId}`;
}

/** Notify all SSE subscribers for this cafe that PC availability / tier data may have changed. */
function notifyCafeInventoryChanged(cafeId, reason = 'update') {
  const id = parseInt(cafeId, 10);
  if (!Number.isFinite(id) || id < 1) return;
  bus.emit(channel(id), { reason: String(reason).slice(0, 64), ts: Date.now() });
}

function subscribeCafeInventory(cafeId, listener) {
  const id = parseInt(cafeId, 10);
  if (!Number.isFinite(id) || id < 1) return () => {};
  const ch = channel(id);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

module.exports = {
  notifyCafeInventoryChanged,
  subscribeCafeInventory,
};
