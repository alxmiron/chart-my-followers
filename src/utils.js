const getDeviceRatio = ctx => {
  const devicePixelRatio = window.devicePixelRatio || 1;

  // determine the 'backing store ratio' of the canvas context
  const backingStoreRatio =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;

  // determine the actual ratio we want to draw at
  const ratio = devicePixelRatio / backingStoreRatio;
  return ratio;
};

const omitProps = (object, propNames) => {
  return Object.keys(object).reduce((acc, key) => {
    if (propNames.includes(key)) return acc;
    acc[key] = object[key];
    return acc;
  }, {});
};

// const pickProps = (object, propNames) => {
//   return propNames.reduce((acc, key) => {
//     acc[key] = object[key];
//     return acc;
//   }, {});
// };

const concatArrays = arrays => arrays.reduce((acc, arr) => acc.concat(arr), []);

module.exports = { getDeviceRatio, omitProps, concatArrays };
