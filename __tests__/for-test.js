const { test } = require('./test-util');

module.exports = (eva) => {
  test(
    eva,
    `
		(begin
			(var value 0)
			(for (var i 0) (< i 3) (set i (+ i 1)) (set value (+ value 2)))
			value)
	`,
    6
  );
};
