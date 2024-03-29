const { omitProps } = require('./utils');
const { createElement, clearNodeChildren } = require('./utils');

const getDateText = (date, showDay = false) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${months[date.getMonth()]} ${date.getDate()}`;
  if (showDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]}, ${label}`;
  }
  return label;
};

const getDataValueCoords = (chartSize, stepX, stepY, scrollOffset = 0, bottomOffset = 0) => (num = 0, index = 0) => {
  return {
    x: -scrollOffset + index * stepX,
    y: chartSize.height - bottomOffset * chartSize.ratio - num * stepY,
  };
};

const renderLine = ctx => (x0, y0, x1, y1, { color = '#eaeaea', lineWidth = 1, ratio = 1 } = {}) => {
  ctx.strokeStyle = color.toUpperCase();
  ctx.lineWidth = lineWidth * ratio;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const renderCircle = ctx => (x, y, radius, { color = 'black', lineWidth = 1, ratio = 1, darkTheme } = {}) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * 2 * ratio;
  ctx.fillStyle = darkTheme ? '#242f3e' : 'white';
  ctx.beginPath();
  ctx.arc(x, y, radius * ratio, 0, Math.PI * 2, true);
  ctx.stroke();
  ctx.fill();
};

const formatGridValue = value => {
  if (value > 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

const renderLinesChart = (ctx, chartData, stepX, stepY, scrollOffset, leftSideIndex, rightSideIndex, lineWidth, bottomOffset) => {
  const chartSize = chartData.size;
  const yColumns = omitProps(chartData.columns, col => col.id === 'x' || col.alpha === 0);
  Object.values(yColumns).forEach(columnData => {
    ctx.strokeStyle = columnData.color.toUpperCase();
    ctx.lineWidth = lineWidth * chartSize.ratio;
    ctx.globalAlpha = columnData.alpha;
    ctx.beginPath();
    columnData.data.forEach((num, index) => {
      if (index < leftSideIndex - 2 || index > rightSideIndex + 2) return;
      const coords = getDataValueCoords(chartSize, stepX, stepY, scrollOffset, bottomOffset)(num, index);
      ctx.lineTo(coords.x, coords.y);
    });
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
};

const renderTimeline = ctx => (chartData, stepX, stepY, darkTheme, scrollOffset, bottomOffset = 4) => {
  const chartSize = chartData.size;
  const getLeaveEach = (dimension, level = 1) => (dimension >= 1 / level ? level : getLeaveEach(dimension, level * 2));
  const easeInOutQuad = x => (x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x);
  const linearCut = (x, thresh = 0) => Math.max((1 / (1 - thresh)) * (x - thresh), 0);
  ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
  ctx.fillStyle = darkTheme ? '#546778' : '#a5a5a5';
  const normInterval = 100 * chartSize.ratio;
  const dimension = stepX / normInterval;
  const leaveEach = getLeaveEach(dimension);
  const willBeDisplayedAlpha = linearCut(dimension * leaveEach - 1, 0.7);
  chartData.columns.x.data
    .map((timestamp, index, arr) => {
      let alpha = 1;
      if (index === 0 || index === arr.length - 1 || leaveEach === 1) return { timestamp, alpha };
      const isVisible = index % leaveEach === 0;
      alpha = isVisible ? 1 : 0;
      const willBeDisplayed = index % leaveEach === leaveEach / 2;
      if (willBeDisplayed) alpha = willBeDisplayedAlpha;
      return { timestamp, alpha };
    })
    .forEach(({ timestamp, alpha = 1 }, index, arr) => {
      ctx.globalAlpha = alpha;
      if (!alpha) return;
      const dateText = getDateText(new Date(timestamp));
      const labelWidth = dateText.length * 7 * chartSize.ratio;
      const length = arr.length - 1;
      const getHalfCorrection = index =>
        index < arr.length / 2
          ? -easeInOutQuad((2 * index) / length) * (labelWidth / 2)
          : -easeInOutQuad((2 * index) / length - 1) * (labelWidth / 2);
      const correction = index < arr.length / 2 ? getHalfCorrection(index) : -labelWidth / 2 + getHalfCorrection(index);
      const xCord = getDataValueCoords(chartSize, stepX, stepY, scrollOffset)(0, index).x;
      const leftOffset = xCord + correction;
      ctx.fillText(dateText, leftOffset, chartSize.height - bottomOffset * chartSize.ratio);
    });
  ctx.globalAlpha = 1;
};

const renderGridLine = ctx => (chartSize, darkTheme, gridRow, bottomOffset, sideOffset) => {
  ctx.globalAlpha = gridRow.alpha;
  const options = { ratio: chartSize.ratio, color: darkTheme ? '#313d4d' : '#eaeaea' };
  const y = chartSize.height - bottomOffset * chartSize.ratio - gridRow.level;
  renderLine(ctx)(0 + sideOffset * chartSize.ratio, y, chartSize.width - sideOffset * chartSize.ratio, y, options);
};

const renderGridLines = ctx => (chartSize, darkTheme, gridRows, bottomOffset, sideOffset) => {
  gridRows.forEach(gridRow => {
    const rows = Array.isArray(gridRow) ? gridRow : [gridRow];
    rows.forEach(row => renderGridLine(ctx)(chartSize, darkTheme, row, bottomOffset, sideOffset));
  });
  ctx.globalAlpha = 1;
};

const renderGridValue = ctx => (chartSize, darkTheme, gridRow, bottomOffset, sideOffset) => {
  ctx.globalAlpha = gridRow.alpha;
  ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
  ctx.fillStyle = darkTheme ? '#546778' : '#a5a5a5';
  const y = chartSize.height - bottomOffset * chartSize.ratio - gridRow.level - 5 * chartSize.ratio;
  ctx.fillText(gridRow.label, 0 + sideOffset * chartSize.ratio, y);
};

const renderGridValues = ctx => (chartSize, darkTheme, gridRows, bottomOffset, sideOffset) => {
  gridRows.forEach(gridRow => {
    const rows = Array.isArray(gridRow) ? gridRow : [gridRow];
    rows.forEach(row => renderGridValue(ctx)(chartSize, darkTheme, row, bottomOffset, sideOffset));
  });
  ctx.globalAlpha = 1;
};

const clearChart = (canvas, ctx) => () => ctx.clearRect(0, 0, canvas.width, canvas.height);

const getTooltipNode = pointData => {
  const tooltip = createElement('div', { className: 'tooltip' });
  const time = createElement('time', { text: pointData.label });
  tooltip.appendChild(time);
  const valuesCont = createElement('div', { className: 'values-container' });
  Object.values(pointData.data)
    .reverse()
    .forEach(column => {
      const value = createElement('div', { className: 'value-container' });
      value.style.color = column.color;
      value.appendChild(createElement('span', { className: 'value', text: formatGridValue(column.value) }));
      value.appendChild(createElement('small', { className: 'value-label', text: column.name }));
      valuesCont.appendChild(value);
    });
  tooltip.appendChild(valuesCont);
  return tooltip;
};

const getTooltipPosition = (chartSize, point, topOffset, tooltipClientWidth) => {
  let left = 0;
  const shiftWidth = 15;
  const leftFreeSpace = point.coords.x / chartSize.ratio;
  const rightFreeSpace = (chartSize.width - point.coords.x) / chartSize.ratio;
  if (rightFreeSpace > tooltipClientWidth) {
    const shift = leftFreeSpace > shiftWidth ? shiftWidth : 0;
    left = point.coords.x / chartSize.ratio - shift;
  } else if (leftFreeSpace > tooltipClientWidth) {
    const shift = rightFreeSpace > shiftWidth ? shiftWidth : 0;
    left = point.coords.x / chartSize.ratio - tooltipClientWidth + shift;
  }
  return { left, top: topOffset };
};

const getTooltipPoint = (chartData, chartClick, stepX, stepY, scrollOffset, bottomOffset) => {
  const chartSize = chartData.size;
  const totalLength = chartData.columns.x.data.length - 1;
  const totalWidth = totalLength * stepX;
  const percentage = (scrollOffset + chartClick.x * chartSize.ratio) / totalWidth;
  const targetIndex = Math.round(totalLength * percentage);
  const date = new Date(chartData.columns.x.data[targetIndex]);
  const yColumns = omitProps(chartData.columns, col => col.id === 'x' || col.alpha !== 1);
  const pointData = {
    targetIndex,
    date,
    label: getDateText(date, true),
    data: Object.values(yColumns)
      .reverse()
      .reduce((acc, column) => {
        acc[column.id] = {
          name: column.name,
          value: column.data[targetIndex],
          color: column.color,
          coords: getDataValueCoords(chartSize, stepX, stepY, scrollOffset, bottomOffset)(column.data[targetIndex], targetIndex),
        };
        return acc;
      }, {}),
  };
  return pointData;
};

const renderTooltip = (ctx, $tooltipContainer) => (chartData, darkTheme, chartClick, stepX, stepY, scrollOffset, bottomOffset = 0, lineWidth) => {
  const chartSize = chartData.size;
  const pointData = getTooltipPoint(chartData, chartClick, stepX, stepY, scrollOffset, bottomOffset);
  const points = Object.values(pointData.data);
  if (!points.length) return;
  const topOffset = 5;
  const point = points[0];
  renderLine(ctx)(point.coords.x, topOffset * chartSize.ratio, point.coords.x, chartSize.height - bottomOffset * chartSize.ratio, {
    ratio: chartSize.ratio,
    color: darkTheme ? '#3b4a5a' : '#eaeaea',
  });
  Object.values(pointData.data).forEach(column => {
    renderCircle(ctx)(column.coords.x, column.coords.y, 4, { color: column.color, lineWidth, ratio: chartSize.ratio, darkTheme });
  });
  clearNodeChildren($tooltipContainer);
  const $tooltip = getTooltipNode(pointData);
  $tooltip.style.visibility = 'hidden';
  $tooltipContainer.appendChild($tooltip);
  const position = getTooltipPosition(chartSize, point, topOffset, $tooltip.clientWidth);
  $tooltipContainer.style.top = `${position.top}px`;
  $tooltipContainer.style.left = `${position.left}px`;
  $tooltip.style.visibility = 'visible';
};

exports.renderChart = (canvas, ctx, $tooltipContainer) => (chartData, chartClick, darkTheme, options) => {
  const chartSize = chartData.size;
  const gridRows = chartData.gridRows || [];
  const { lineWidth = 1, bottomOffset = 0, sideOffset = 0 } = options;
  const { stepX, stepY, scrollOffset, leftSideIndex, rightSideIndex } = chartData.config;
  clearChart(canvas, ctx)();
  clearNodeChildren($tooltipContainer);
  if (gridRows.length) renderGridLines(ctx)(chartSize, darkTheme, gridRows, bottomOffset, sideOffset);
  renderLinesChart(ctx, chartData, stepX, stepY, scrollOffset, leftSideIndex, rightSideIndex, lineWidth, bottomOffset);
  if (gridRows.length) renderGridValues(ctx)(chartSize, darkTheme, gridRows, bottomOffset, sideOffset);
  if (options.withTimeline) renderTimeline(ctx)(chartData, stepX, stepY, darkTheme, scrollOffset);
  if (options.withTooltip && chartClick) {
    renderTooltip(ctx, $tooltipContainer)(chartData, darkTheme, chartClick, stepX, stepY, scrollOffset, bottomOffset, lineWidth);
  }
};

exports.getChartConfig = (chartData, topOffsetPercent = 0, bottomOffset = 0, sideOffset = 0) => {
  const chartSize = chartData.size;
  const yColumns = omitProps(chartData.columns, col => col.id === 'x' || col.alpha < 0.5);
  const totalLength = chartData.columns.x.data.length - 1;
  const availableWidth = chartSize.width - 2 * sideOffset * chartSize.ratio;
  const stepX = availableWidth / ((chartData.slider.right - chartData.slider.left) * totalLength);
  const totalWidth = totalLength * stepX;
  const scrollOffset = -sideOffset * chartSize.ratio + totalWidth * chartData.slider.left;
  const leftSideIndex = Math.round(chartData.columns.x.data.length * chartData.slider.left);
  const rightSideIndex = Math.round(chartData.columns.x.data.length * chartData.slider.right) - 1;
  const maxDataValue = Math.max(
    0,
    ...Object.values(yColumns)
      .map(col => col.data.slice(leftSideIndex, rightSideIndex + 1))
      .reduce((acc, arr) => acc.concat(arr), []),
  );
  const availableHeight = chartSize.height * (1 - topOffsetPercent) - bottomOffset * chartSize.ratio;
  const stepY = Math.min(availableHeight / maxDataValue, availableHeight / 10);
  return { stepX, stepY, maxDataValue, scrollOffset, leftSideIndex, rightSideIndex };
};

exports.getGridRows = (chartData, topOffsetPercent = 0, bottomOffset = 0) => {
  if (!chartData.config.maxDataValue) return [];
  const chartSize = chartData.size;
  const rowsAmount = 6;
  const gridRows = Array(rowsAmount)
    .fill(1)
    .map((v, idx) => {
      const value = Math.round((idx * chartData.config.maxDataValue) / rowsAmount);
      const interval = (chartSize.height * (1 - topOffsetPercent) - bottomOffset * chartSize.ratio) / rowsAmount;
      const level = interval * idx;
      return { value, level, label: formatGridValue(value) };
    });
  return gridRows;
};
