/**
 * calculator.test.js — MS 6.1.8 E2E デモ テストスイート
 * node:test + assert を使用（外部依存なし）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { add, subtract, multiply, divide } = require('./buggy-calculator');

test('add: 1 + 2 = 3', () => {
  assert.strictEqual(add(1, 2), 3);
});

test('add: negative numbers', () => {
  assert.strictEqual(add(-1, -2), -3);
});

test('subtract: 5 - 3 = 2', () => {
  assert.strictEqual(subtract(5, 3), 2);
});

test('multiply: 3 * 4 = 12', () => {
  assert.strictEqual(multiply(3, 4), 12);
});

test('multiply: 0 * 5 = 0', () => {
  assert.strictEqual(multiply(0, 5), 0);
});

test('divide: 10 / 2 = 5', () => {
  assert.strictEqual(divide(10, 2), 5);
});

test('divide: throws on zero division', () => {
  assert.throws(() => divide(5, 0), /zero|division|divide/i);
});
