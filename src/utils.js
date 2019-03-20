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
    if (propNames.includes(key)) return acc;
    acc[key] = object[key];
    return acc;
  }, {});
};

exports.getDateText = (date, showDay = false) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${months[date.getMonth()]} ${date.getDate()}`;
  if (showDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}, ${label}`;
  }
  return label;
};

exports.getDataValueCoords = (chartSize, stepX, stepY, scrollOffset = 0, bottomOffset = 0) => (num = 0, index = 0) => {
  return {
    x: -scrollOffset + index * stepX,
    y: chartSize.height - bottomOffset * chartSize.ratio - num * stepY,
  };
};

exports.getTooltipPoint = (chartSize, chartData, chartClick, stepX, stepY, scrollOffset, bottomOffset) => {
  const totalLength = chartData.columns.x.data.length - 1;
  const totalWidth = totalLength * stepX;
  const percentage = (scrollOffset + chartClick.x * chartSize.ratio) / totalWidth;
  const targetIndex = Math.round(totalLength * percentage);
  const date = new Date(chartData.columns.x.data[targetIndex]);
  const yColumns = exports.omitProps(chartData.columns, ['x']);
  const pointData = {
    targetIndex,
    date,
    label: exports.getDateText(date, true),
    data: Object.values(yColumns)
      .reverse()
      .reduce((acc, column) => {
        acc[column.id] = {
          name: column.name,
          value: column.data[targetIndex],
          color: column.color,
          coords: exports.getDataValueCoords(chartSize, stepX, stepY, scrollOffset, bottomOffset)(column.data[targetIndex], targetIndex),
        };
        return acc;
      }, {}),
  };
  return pointData;
};

exports.updateThemeButton = ($themeButton, nightMode) => {
  exports.clearNodeChildren($themeButton);
  $themeButton.appendChild(document.createTextNode(nightMode ? 'Switch to Day Mode' : 'Switch to Night Mode'));
};
