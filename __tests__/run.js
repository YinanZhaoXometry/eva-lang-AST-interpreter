const Eva = require('../Eva');

const tests = [
  // require('./block-test'),
  // require('./if-test'),
  // require('./while-test'),
  // require('./built-in-funciton-test'),
  // require('./user-defined-function-test'),
  // require('./lambda-function-test'),
  // require('./switch-test'),
  // require('./for-test'),
  // require('./increment-decrement-sytactic-sugar-test'),
  // require('./class-test'),
  // require('./module-test'),
  require('./import-test'),
];

const eva = new Eva();

tests.forEach((test) => test(eva));

console.log('All assertions passed!');
