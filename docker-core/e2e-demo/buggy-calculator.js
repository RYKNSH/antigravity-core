const add = (a, b) => {
  return a + b; // 修正: a - b から a + b へ
};

const subtract = (a, b) => {
  return a - b;
};

const multiply = (a, b) => {
  return a * b; // 修正: a + b から a * b へ
};

const divide = (a, b) => {
  if (b === 0) { // 追加: ゼロ除算チェック
    throw new Error('division by zero');
  }
  return a / b;
};

module.exports = {
  add,
  subtract,
  multiply,
  divide,
};