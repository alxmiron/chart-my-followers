exports.getDeviceRatio = ctx => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const backingStoreRatio =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;
  const ratio = devicePixelRatio / backingStoreRatio;
  return ratio;
};

exports.createElement = (tag, { className, text, attributes }) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (attributes) {
    Object.keys(attributes).forEach(key => {
      element.setAttribute(key, attributes[key]);
      element[key] = attributes[key];
    });
  }
  if (text) element.appendChild(document.createTextNode(text));
  return element;
};

exports.clearNodeChildren = $node => {
  while ($node.firstChild) $node.removeChild($node.firstChild);
};

exports.omitProps = (object, propNames) => {
  return Object.keys(object).reduce((acc, key) => {
    if (typeof propNames === 'function' ? propNames(object[key]) : propNames.includes(key)) return acc;
    acc[key] = object[key];
    return acc;
  }, {});
};
