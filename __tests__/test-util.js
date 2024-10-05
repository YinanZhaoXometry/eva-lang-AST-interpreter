const assert = require('assert');
const evaParser = require('../parser/evaParser');

module.exports = {
  test(eva, code, expected) {
    try {
      const exp = evaParser.parse(`(begin ${code})`);
      assert.strictEqual(eva.evalGlobal(exp), expected);
    } catch (error) {
      console.log('error: ', error);
    }
  },
};
