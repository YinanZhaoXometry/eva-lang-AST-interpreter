const { test } = require('./test-util');

module.exports = (eva) => {
  test(
    eva,
    `
			(begin
				(var x 1)
				(++ x)
			)
		`,
    2
  );

  test(
    eva,
    `
			(begin
				(var x 1)
				(+= x 5)
				(+= x 5)
			)
		`,
    11
  );

  test(
    eva,
    `
			(begin
				(var x 2)
				(-- x)
				(-- x)
			)
		`,
    0
  );

  test(
    eva,
    `
			(begin
				(var x 11)
				(-= x 5)
				(-= x 5)
			)
		`,
    1
  );
};
