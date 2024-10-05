const Environment = require('./Environment');
const Transformer = require('./transform/Transformer');
const evaParser = require('./parser/evaParser');
const fs = require('fs');

/**
 * Eva interpreter
 */
module.exports = class Eva {
  /**
   * Create and Eva instance with the global environment
   */
  constructor(global = GlobalEnvironment) {
    this.global = global;
    this._transformer = new Transformer();
  }

  /**
   * Evaluates global code wrapping into a block
   */
  evalGlobal(exp) {
    return this._evalBlock(exp, this.global);
  }

  /**
   * Evaluates an expression in the given environment
   */
  eval(exp, env = GlobalEnvironment) {
    if (this._isNumber(exp)) {
      return exp;
    }
    if (this._isString(exp)) {
      return exp.slice(1, -1);
    }

    if (exp[0] === 'var') {
      const [_, name, value] = exp;
      return env.define(name, this.eval(value, env));
    }

    if (exp[0] === 'set') {
      const [_, ref, value] = exp;

      // Assignment to a property
      if (ref[0] === 'prop') {
        const [_tag, instance, propName] = ref;
        const instanceEnv = this.eval(instance, env);

        return instanceEnv.define(propName, this.eval(value, env));
      }
      // simple assignment
      return env.assign(ref, this.eval(value, env));
    }

    if (this._isVariableName(exp)) {
      return env.lookup(exp);
    }

    if (exp[0] === 'begin') {
      const blockEnv = new Environment({}, env);
      return this._evalBlock(exp, blockEnv);
    }
    if (exp[0] === 'if') {
      const [_, condition, consequent, alternate] = exp;
      if (this.eval(condition, env)) {
        return this.eval(consequent, env);
      }
      return this.eval(alternate, env);
    }
    if (exp[0] === 'while') {
      const [_tag, condition, body] = exp;
      let result;
      while (this.eval(condition, env)) {
        result = this.eval(body, env);
      }
      return result;
    }
    // -------------------
    // For-loop: (for init condition modifier body)
    //
    // Syntactic sugar for: (begin init (while condition (begin body modifier)))
    if (exp[0] === 'for') {
      const whileExp = this._transformer.transformForToWhile(exp);
      return this.eval(whileExp, env);
    }
    // -------------------
    // Increment: (++ foo)
    //
    // Syntactic sugar for: (set foo (+ foo 1))
    if (exp[0] === '++') {
      const setExp = this._transformer.transformIncToSet(exp);
      return this.eval(setExp, env);
    }
    // -------------------
    // Decrement: (-- foo)
    //
    // Syntactic sugar for: (set foo (- foo 1))
    if (exp[0] === '--') {
      const setExp = this._transformer.transformDecToSet(exp);
      return this.eval(setExp, env);
    }
    // -------------------
    // Increment: (+= foo inc)
    //
    // Syntactic sugar for: (set foo (+ foo inc))
    if (exp[0] === '+=') {
      const setExp = this._transformer.transformIncToSet(exp);
      return this.eval(setExp, env);
    }
    // -------------------
    // Decrement: (-= foo dec)
    //
    // Syntactic sugar for: (set foo (- foo dec))
    if (exp[0] === '-=') {
      const setExp = this._transformer.transformDecToSet(exp);
      return this.eval(setExp, env);
    }

    // -------------------
    // Function delcaration: (def square (x) (* x x))
    //
    // Syntactic sugar for: (var square (lambda (x) (* x x)))
    if (exp[0] === 'def') {
      // JIT-transpile to a variable declaration
      const varExp = this._transformer.transformDefToLambda(exp);
      return this.eval(varExp, env);
    }

    // ------------------
    // Lambda function: (lambda (x) (* x x))
    if (exp[0] === 'lambda') {
      const [_tag, params, body] = exp;
      return {
        params,
        body,
        env,
      };
    }

    //-------------------
    // Switch-expression: (switch (cond1, block1) ... )
    //
    // Syntactic sugar for nested if-expressions
    if (exp[0] === 'switch') {
      const ifExp = this._transformer.transformSwitchToIf(exp);
      return this.eval(ifExp, env);
    }

    // -------------------
    // Class declaration: (class <Name> <Parent> <Body>)
    if (exp[0] === 'class') {
      const [_tag, name, parent, body] = exp;
      // A class is an environment! -- a storage of methods and shared properties
      const parentEnv = this.eval(parent, env) || env;
      const classEnv = new Environment({}, parentEnv);

      // Body is evaluated in the class environment
      this._evalBody(body, classEnv);
      // Class is accessible by name
      return env.define(name, classEnv);
    }

    // -------------------
    // Super expressions: (super <ClassName>)
    if (exp[0] === 'super') {
      const [_tag, className] = exp;
      return this.eval(className, env).parent;
    }

    // -------------------
    // Class instantiation: (new <Class> <Arguments>...)
    if (exp[0] === 'new') {
      const classEnv = this.eval(exp[1], env);
      // An instance of a class is an environment!
      // The `parent` component of the instance environment
      // is set to its class
      const instanceEnv = new Environment({}, classEnv);

      const args = exp.slice(2).map((arg) => this.eval(arg, env));

      this._callUserDefinedFunction(classEnv.lookup('constructor'), [
        instanceEnv,
        ...args,
      ]);

      return instanceEnv;
    }

    // -------------------
    // Property access: (prop <instance> <name>)
    if (exp[0] === 'prop') {
      const [_tag, instance, name] = exp;

      const instanceEnv = this.eval(instance, env);
      return instanceEnv.lookup(name);
    }

    // -------------------
    // Module declaration: (module <name> <body>)
    if (exp[0] === 'module') {
      const [_tag, name, body] = exp;

      const moduleEnv = new Environment({}, env);

      this._evalBody(body, moduleEnv);

      return env.define(name, moduleEnv);
    }

    // -------------------
    // Module import:
    // (import <name>)
    // (import (abs square) <name>)
    if (exp[0] === 'import') {
      const [_tag, names, module] = exp;
      const name = Array.isArray(names) ? module : names;

      if (this._isCachedModule(exp, env)) {
        return env.lookup(name);
      }

      const moduleSrc = fs.readFileSync(
        `${__dirname}/modules/${name}.eva`,
        'utf-8'
      );

      const body = evaParser.parse(`(begin ${moduleSrc})`);

      const moduleExp = ['module', name, body];

      return this.eval(moduleExp, this.global);
    }

    // -------------------
    // Function calls:
    // e.g.
    // (print "Hello World")
    // (+ x 5)
    // (> foo bar)
    if (Array.isArray(exp)) {
      const fn = this.eval(exp[0], env);
      const args = exp.slice(1).map((arg) => this.eval(arg, env));

      // 1. Native function
      if (typeof fn === 'function') {
        return fn(...args);
      }
      // 2. User-defined functions
      return this._callUserDefinedFunction(fn, args);
    }
    throw `Unimplemented: ${JSON.stringify(exp)}`;
  }

  _evalBlock(block, env) {
    let result;
    const [_tag, ...expressions] = block;
    expressions.forEach((exp) => {
      result = this.eval(exp, env);
    });
    return result;
  }

  _evalBody(body, env) {
    if (body[0] === 'begin') {
      return this._evalBlock(body, env);
    }
    return this.eval(body, env);
  }

  _isNumber(exp) {
    return typeof exp === 'number';
  }
  _isString(exp) {
    return typeof exp === 'string' && exp[0] === '"' && exp.slice(-1) === '"';
  }
  _isVariableName(exp) {
    return (
      typeof exp === 'string' &&
      /^(?:[+\-*/=a-zA-Z]|>=?|<=?)[a-zA-z0-9_]*$/.test(exp)
    );
  }

  _isCachedModule(exp, env) {
    const [_tag, name] = exp;
    try {
      return env.lookup(name) !== null;
    } catch (error) {
      return false;
    }
  }

  _callUserDefinedFunction(fn, args) {
    const activationRecord = {}; // Sorage of the Activation Environment
    fn.params.forEach((param, index) => {
      activationRecord[param] = args[index];
    });
    const activationEnv = new Environment(activationRecord, fn.env);
    return this._evalBody(fn.body, activationEnv);
  }
};

/**
 * Default Global Environment
 */
const GlobalEnvironment = new Environment({
  null: null,
  true: true,
  false: false,

  VERSION: '0.1',

  '+'(op1, op2) {
    return op1 + op2;
  },
  '-'(op1, op2 = null) {
    if (op2 === null) {
      return -op1;
    }
    return op1 - op2;
  },
  '*'(op1, op2) {
    return op1 * op2;
  },
  '/'(op1, op2) {
    return op1 / op2;
  },
  '>'(op1, op2) {
    return op1 > op2;
  },
  '<'(op1, op2) {
    return op1 < op2;
  },
  '>='(op1, op2) {
    return op1 >= op2;
  },
  '<='(op1, op2) {
    return op1 <= op2;
  },
  '='(op1, op2) {
    return op1 === op2;
  },
  print(...args) {
    console.log(...args);
  },
});
