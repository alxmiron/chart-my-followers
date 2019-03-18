const { getDataValueCoords, getTooltipPoint, omitProps, getDateText } = require('./utils');
const { createElement, clearNodeChildren } = require('./utils');

const renderLine = (canvas, ctx) => (x0, y0, x1, y1, { color = '#eaeaea', lineWidth = 1, ratio = 1 } = {}) => {
  ctx.strokeStyle = color.toUpperCase();
  ctx.lineWidth = lineWidth * ratio;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const renderCircle = (canvas, ctx) => (x, y, radius, { color = 'black', lineWidth = 1, ratio = 1, darkTheme } = {}) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * ratio;
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

const getChartSteps = ({ chartSize, chartData }, { topOffsetPercent = 0, bottomOffset = 0 } = {}) => {
  const yColumns = omitProps(chartData.columns, ['x']);
  const totalLength = chartData.columns.x.data.length - 1;
  const stepX = chartSize.width / ((chartData.slider.right - chartData.slider.left) * totalLength);
  const totalWidth = totalLength * stepX;
  const scrollOffset = totalWidth * chartData.slider.left;
  const leftSideIndex = Math.round(chartData.columns.x.data.length * chartData.slider.left);
  const rightSideIndex = Math.round(chartData.columns.x.data.length * chartData.slider.right) - 1;
  const maxDataValue = Math.max(
    ...Object.values(yColumns)
      .map(col => col.data.slice(leftSideIndex, rightSideIndex + 1))
      .reduce((acc, arr) => acc.concat(arr), []),
  );
  const stepY = (chartSize.height * (1 - topOffsetPercent) - bottomOffset * chartSize.ratio) / maxDataValue;
  return { stepX, stepY, maxDataValue, scrollOffset };
};

const renderLinesChart = (canvas, ctx) => ({ chartSize, chartData, stepX, stepY, scrollOffset }, { lineWidth = 1, bottomOffset = 0 } = {}) => {
  const yColumns = omitProps(chartData.columns, ['x']);
  Object.values(yColumns).forEach(columnData => {
    ctx.strokeStyle = columnData.color.toUpperCase();
    ctx.lineWidth = lineWidth * chartSize.ratio;
    ctx.beginPath();
    columnData.data.forEach((num, index) => {
      const coords = getDataValueCoords({ chartSize, chartData, stepX, stepY }, { scrollOffset, bottomOffset })(num, index);
      ctx.lineTo(coords.x, coords.y);
    });
    ctx.stroke();
  });
};

const renderTimeline = (canvas, ctx) => ({ chartSize, chartData, darkTheme }, { bottomOffset = 4 } = {}) => {
  ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
  ctx.fillStyle = darkTheme ? '#546778' : '#a5a5a5';
  const labelWidth = 100 * chartSize.ratio;
  const bestLabelsAmount = Math.floor(chartSize.width / labelWidth);
  const leaveEach = Math.ceil(chartData.columns.x.data.length / bestLabelsAmount);
  chartData.columns.x.data
    .filter((value, index, arr) => index % leaveEach === 0 || index === arr.length - 1)
    .forEach((timestamp, index, arr) => {
      const dateText = getDateText(new Date(timestamp));
      const interval = chartSize.width / arr.length;
      const correction = 0;
      const leftOffset = interval * index + correction;
      ctx.fillText(dateText, leftOffset, chartSize.height - bottomOffset * chartSize.ratio);
    });
};

const getGridRows = ({ chartSize, maxDataValue }, { topOffsetPercent = 0, bottomOffset = 0 }) => {
  if (!maxDataValue) return [];
  const rowsAmount = 6;
  const gridRows = Array(rowsAmount)
    .fill(1)
    .map((val, idx) => Math.round((idx * maxDataValue) / rowsAmount))
    .map((value, idx, arr) => {
      const interval = (chartSize.height * (1 - topOffsetPercent) - bottomOffset * chartSize.ratio) / arr.length;
      const level = chartSize.height - bottomOffset * chartSize.ratio - interval * idx;
      return { value, level, label: formatGridValue(value) };
    });
  return gridRows;
};

const renderGrid = (canvas, ctx) => ({ chartSize, darkTheme }, gridRows) => {
  gridRows.forEach(row => {
    renderLine(canvas, ctx)(0, row.level, chartSize.width, row.level, { ratio: chartSize.ratio, color: darkTheme ? '#313d4d' : '#eaeaea' });
  });
};

const renderGridValues = (canvas, ctx) => ({ chartSize, darkTheme }, gridRows) => {
  gridRows.forEach(row => {
    ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
    ctx.fillStyle = darkTheme ? '#546778' : '#a5a5a5';
    ctx.fillText(row.label, 0, row.level - 5 * chartSize.ratio);
  });
};

const clearChart = (canvas, ctx) => () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const resizeChart = (canvas, chartSize) => {
  canvas.width = chartSize.width;
  canvas.height = chartSize.height;
  canvas.style.width = chartSize.width / chartSize.ratio + 'px';
  canvas.style.height = chartSize.height / chartSize.ratio + 'px';
};

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

const getTooltipPosition = ({ chartSize, point, tooltipClientWidth, topOffset }) => {
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

const renderTooltip = (canvas, ctx, $tooltipContainer) => (
  { chartSize, chartData, darkTheme, chartClick, stepX, stepY, scrollOffset },
  { bottomOffset = 0 } = {},
) => {
  const pointData = getTooltipPoint({ chartSize, chartData, chartClick, stepX, stepY }, { scrollOffset, bottomOffset });
  const points = Object.values(pointData.data);
  if (!points.length) return;
  const topOffset = 5;
  const point = points[0];
  renderLine(canvas, ctx)(point.coords.x, topOffset * chartSize.ratio, point.coords.x, chartSize.height - bottomOffset * chartSize.ratio, {
    ratio: chartSize.ratio,
    color: darkTheme ? '#3b4a5a' : '#eaeaea',
  });
  Object.values(pointData.data).forEach(column => {
    renderCircle(canvas, ctx)(column.coords.x, column.coords.y, 4, { color: column.color, lineWidth: 3, ratio: chartSize.ratio, darkTheme });
  });
  clearNodeChildren($tooltipContainer);
  const $tooltip = getTooltipNode(pointData);
  $tooltip.style.visibility = 'hidden';
  $tooltipContainer.appendChild($tooltip);
  const position = getTooltipPosition({ chartSize, point, topOffset, tooltipClientWidth: $tooltip.clientWidth });
  $tooltipContainer.style.top = `${position.top}px`;
  $tooltipContainer.style.left = `${position.left}px`;
  $tooltip.style.visibility = 'visible';
};

exports.renderChart = (canvas, ctx, $tooltipContainer) => ({ chartSize, chartData, chartClick, darkTheme }, options = {}) => {
  const { withGrid, withTimeline, withTooltip, lineWidth = 1, topOffsetPercent, bottomOffset = 0 } = options;
  const { stepX, stepY, scrollOffset, maxDataValue } = getChartSteps({ chartSize, chartData }, { topOffsetPercent, bottomOffset });
  // console.log(stepX, stepY, scrollOffset);
  clearChart(canvas, ctx)();
  clearNodeChildren($tooltipContainer);
  const gridRows = withGrid ? getGridRows({ chartSize, chartData, stepX, stepY, maxDataValue }, { topOffsetPercent, bottomOffset }) : [];
  if (gridRows.length) renderGrid(canvas, ctx)({ chartSize, darkTheme }, gridRows);
  renderLinesChart(canvas, ctx)({ chartSize, chartData, stepX, stepY, scrollOffset }, { lineWidth, bottomOffset });
  if (gridRows.length) renderGridValues(canvas, ctx)({ chartSize, darkTheme }, gridRows);
  if (withTimeline) renderTimeline(canvas, ctx)({ chartSize, chartData, darkTheme });
  if (withTooltip && chartClick) {
    renderTooltip(canvas, ctx, $tooltipContainer)({ chartSize, chartData, darkTheme, chartClick, stepX, stepY, scrollOffset }, { bottomOffset });
  }
};

exports.getChartSizeObservable = (windowSize$, canvas, { ratio, height }) => {
  const chartSize$ = windowSize$
    .map(
      windowSize => {
        const chartWidth = (windowSize.width - windowSize.paddings) * ratio;
        const chartHeight = (typeof height === 'function' ? height(windowSize) : height) * ratio;
        return { ratio, width: chartWidth, height: chartHeight };
      },
      { inheritLastValue: true },
    )
    .subscribe(chartSize => resizeChart(canvas, chartSize))
    .repeatLast();
  return chartSize$;
};
