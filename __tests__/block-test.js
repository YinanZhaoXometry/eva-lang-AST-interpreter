const assert = require('assert');
const { test } = require('./test-util');

module.exports = (eva) => {
  // Blocks
  assert.strictEqual(
    eva.eval(['begin', ['var', 'x', 5], ['var', 'y', 6], ['+', 'x', 'y']]),
    11
  );
  assert.strictEqual(
    eva.eval(['begin', ['var', 'x', 5], ['begin', ['var', 'x', 10], 'x'], 'x']),
    5
  );
  assert.strictEqual(
    eva.eval([
      'begin',
      ['var', 'x', 5],
      ['var', 'result', ['begin', ['var', 'y', ['+', 'x', 10]], 'y']],
      'result',
    ]),
    15
  );
  assert.strictEqual(
    eva.eval([
      'begin',
      ['var', 'data', 10],
      ['begin', ['set', 'data', 100]],
      'data',
    ]),
    100
  );

  test(
    eva,
    `
		(begin
			(var x 10)
			(var y 20)
			(+ (* x 10) y))
	`,
    120
  );
};
