import test from "node:test";
import assert from "node:assert/strict";

import { isPrivateOrLocalAddress } from "../server/network.js";

test("isPrivateOrLocalAddress accepts localhost and RFC1918 addresses", () => {
  assert.equal(isPrivateOrLocalAddress("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalAddress("::1"), true);
  assert.equal(isPrivateOrLocalAddress("::ffff:192.168.31.44"), true);
  assert.equal(isPrivateOrLocalAddress("10.0.2.15"), true);
  assert.equal(isPrivateOrLocalAddress("172.16.8.20"), true);
  assert.equal(isPrivateOrLocalAddress("172.31.255.9"), true);
  assert.equal(isPrivateOrLocalAddress("fd12:3456:789a::1"), true);
  assert.equal(isPrivateOrLocalAddress("fe80::1"), true);
});

test("isPrivateOrLocalAddress rejects public addresses", () => {
  assert.equal(isPrivateOrLocalAddress("8.8.8.8"), false);
  assert.equal(isPrivateOrLocalAddress("1.1.1.1"), false);
  assert.equal(isPrivateOrLocalAddress("172.15.0.1"), false);
  assert.equal(isPrivateOrLocalAddress("2001:4860:4860::8888"), false);
});
