import assert from "node:assert/strict";
import { test } from "node:test";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
});

const { createHomeScreenMethods19 } =
  await import("../js/ui/screens/home/homeScreenMethods-19-handle-home-dpad.js");

function node(row, rowKey) {
  return {
    dataset: { navRow: String(row), navCol: "0", navRowKey: rowKey },
    classList: { contains: () => false }
  };
}

test("Up reaches the top navigation only after Continue Watching", () => {
  const hero = node(0, "__hero__");
  const continueCard = node(1, "continue_watching");
  const collectionCard = node(2, "new_latest");
  const focused = [];
  let opened = 0;
  const context = {
    navModel: { rows: [[hero], [continueCard], [collectionCard]], sidebar: [] },
    container: { querySelector: (selector) => (selector === ".nuvio-top-navigation" ? {} : null) },
    current: collectionCard,
    getCurrentFocusedNode() {
      return this.current;
    },
    isMainNode: () => true,
    isNodeWithinMainViewport: () => true,
    isSidebarNode: () => false,
    getNodeRowKey: (target) => target.dataset.navRowKey,
    resolvePreferredNodeForRow: (rowNodes) => rowNodes[0],
    focusNode(current, target) {
      focused.push([current, target]);
      this.current = target;
      return true;
    },
    openSidebar() {
      opened += 1;
      return true;
    }
  };
  const event = { keyCode: 38, preventDefault() {} };
  const { handleHomeDpad } = createHomeScreenMethods19();

  assert.equal(handleHomeDpad.call(context, event), true);
  assert.deepEqual(focused, [[collectionCard, continueCard]]);
  assert.equal(opened, 0);

  assert.equal(handleHomeDpad.call(context, event), true);
  assert.equal(opened, 1);
  assert.equal(context.lastMainFocus, continueCard);
  assert.equal(focused.length, 1);
});

test("holding Up at the first content row stops fast scrolling and opens navigation", () => {
  const continueCard = node(0, "continue_watching");
  let fastScrollStopped = false;
  let opened = false;
  const context = {
    navModel: { rows: [[continueCard]], sidebar: [] },
    container: { querySelector: (selector) => (selector === ".nuvio-top-navigation" ? {} : null) },
    modernVerticalFastScrollState: { direction: -1 },
    getCurrentFocusedNode: () => continueCard,
    isMainNode: () => true,
    isNodeWithinMainViewport: () => true,
    isSidebarNode: () => false,
    getNodeRowKey: (target) => target.dataset.navRowKey,
    endModernVerticalFastScroll({ land }) {
      fastScrollStopped = land === false;
    },
    openSidebar() {
      opened = true;
      return true;
    }
  };
  const handled = createHomeScreenMethods19().handleHomeDpad.call(context, {
    keyCode: 38,
    repeat: true,
    preventDefault() {}
  });
  assert.equal(handled, true);
  assert.equal(fastScrollStopped, true);
  assert.equal(opened, true);
});
