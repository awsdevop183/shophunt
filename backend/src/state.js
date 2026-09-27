'use strict';
// In-memory lab state (captures from the blind-XSS collector / admin bot).
// Reset on backend restart or via Reset Lab. Viewable in instructor mode.
const captures = [];
function addCapture(entry) {
  captures.unshift({ at: new Date().toISOString(), ...entry });
  if (captures.length > 200) captures.pop();
}
function clearCaptures() { captures.length = 0; }
module.exports = { captures, addCapture, clearCaptures };
