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

const clearNodeChildren = $node => {
  while ($node.firstChild) $node.removeChild($node.firstChild);
};

exports.clearNodeChildren = clearNodeChildren;

const omitProps = (object, propNames) => {
  return Object.keys(object).reduce((acc, key) => {
    if (propNames.includes(key)) return acc;
    acc[key] = object[key];
    return acc;
  }, {});
};

exports.omitProps = omitProps;

exports.concatArrays = arrays => arrays.reduce((acc, arr) => acc.concat(arr), []);

const getDateText = (date, { showDay } = {}) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${months[date.getMonth()]} ${date.getDate()}`;
  if (showDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}, ${label}`;
  }
  return label;
};

exports.getDateText = getDateText;

const getDataValueCoords = ({ chartSize, stepX, stepY }, { bottomOffset = 0 } = {}) => (num = 0, index = 0) => {
  return {
    x: index * stepX,
    y: chartSize.height - bottomOffset * chartSize.ratio - num * stepY,
  };
};

exports.getDataValueCoords = getDataValueCoords;

exports.getTooltipPoint = ({ chartSize, chartData, chartClick, stepX, stepY }, { bottomOffset } = {}) => {
  const percentage = (chartClick.x * chartSize.ratio) / chartSize.width;
  const targetIndex = Math.round(Math.max(chartData.x.data.length - 1, 1) * percentage);
  const date = new Date(chartData.x.data[targetIndex]);
  const pointData = {
    targetIndex,
    date,
    label: getDateText(date, { showDay: true }),
    data: Object.values(omitProps(chartData, ['x']))
      .reverse()
      .reduce((acc, column) => {
        acc[column.id] = {
          name: column.name,
          value: column.data[targetIndex],
          color: column.color,
          coords: getDataValueCoords({ chartSize, stepX, stepY }, { bottomOffset })(column.data[targetIndex], targetIndex),
        };
        return acc;
      }, {}),
  };
  return pointData;
};

exports.updateThemeButton = ($themeButton, nightMode) => {
  clearNodeChildren($themeButton);
  $themeButton.appendChild(document.createTextNode(nightMode ? 'Switch to Day Mode' : 'Switch to Night Mode'));
};
