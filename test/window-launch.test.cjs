const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWindowUrl } = require("../window-launch.js");

test("builds a solo window URL for a note", () => {
  const url = buildWindowUrl({ isSolo: true, view: "notes", id: "note-123" });

  assert.match(url, /solo=1/);
  assert.match(url, /view=notes/);
  assert.match(url, /id=note-123/);
});

test("builds a regular window URL without launch params", () => {
  const url = buildWindowUrl({ isSolo: false });

  assert.doesNotMatch(url, /solo=/);
  assert.doesNotMatch(url, /view=/);
  assert.doesNotMatch(url, /id=/);
});
