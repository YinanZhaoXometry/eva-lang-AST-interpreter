/**
 * AST Transformer.
 */
class Transformer {
  /**
   * Translates `def`-expression (function declaration)
   * into a variable declaration with a lambda expression.
   */
  transformDefToLambda(defExp) {
    const [_tag, name, params, body] = defExp;
    return ['var', name, ['lambda', params, body]];
  }

  /**
   * Transforms `switch` to nested `if`-expressions.
   */
  transformSwitchToIf(switchExp) {
    const [_tag, ...cases] = switchExp;

    const ifExp = ['if', null, null, null];

    let current = ifExp;

    for (let i = 0; i < cases.length - 1; i++) {
      const [currentCond, currentBlock] = cases[i];

      current[1] = currentCond;
      current[2] = currentBlock;

      const next = cases[i + 1];
      const [nextCond, nextBlock] = next;

      current[3] = nextCond === 'else' ? nextBlock : ['if'];

      current = current[3];
    }

    return ifExp;
  }

  /**
   * Transforms `for` to `while`
   */
  transformForToWhile(forExp) {
    const [_tag, init, condition, modifier, body] = forExp;
    const whileExp = [
      'begin',
      init,
      ['while', condition, ['begin', body, modifier]],
    ];
    return whileExp;
  }

  /**
   * Transforms `increment` to `set`
   */
  transformIncToSet(incExp) {
    const [_tag, body, inc] = incExp;
    return ['set', body, ['+', body, inc || 1]];
  }
  /**
   * Transforms `decrement` to `set`
   */
  transformDecToSet(decExp) {
    const [_tag, body, dec] = decExp;
    return ['set', body, ['-', body, dec || 1]];
  }
}

module.exports = Transformer;
