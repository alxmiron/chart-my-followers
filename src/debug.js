const enableDebug = true;

exports.debug = (...args) => {
  if (!enableDebug) return;
  console.log(...args); // eslint-disable-line no-console
};

exports.debugDir = (...args) => {
  if (!enableDebug) return;
  console.dir(...args); // eslint-disable-line no-console
};
