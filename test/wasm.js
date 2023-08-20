import {test, assertEquals, assertThrows} from './_helpers.js';
import * as wasm from '../dist/wasm.js';

function mock(malloc = () => 1, free = () => {}) {
  const memory = new Uint8Array(2048);
  return {
    malloc,
    free,
    str_len: (ptr) => {
      let len = 0;
      for (let idx = ptr; memory.at(idx) != 0; idx++) len++;
      return len;
    },
    memory,
  };
}

test("round trip string", function () {
  const mockWasm = mock();
  const testCases = ["Hello world!", "Söme, fünky lëttêrß", "你好👋"];
  for (const input of testCases) {
    const output = wasm.setStr(mockWasm, input, (ptr) => {
      return wasm.getStr(mockWasm, ptr);
    });
    assertEquals(input, output);
  }
});

test("throws on allocation error", function () {
  const mockWasm = mock(() => 0);
  assertThrows(() => wasm.setStr(mockWasm, "Hello world!", (_) => null));
});
