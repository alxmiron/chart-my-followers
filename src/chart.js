// const { debug } = require('./debug');
const { getDataValueCoords, getTooltipPoint, omitProps, concatArrays, getDateText } = require('./utils');
const { createElement, clearNodeChildren } = require('./utils');

const renderLine = (canvas, ctx) => (x0, y0, x1, y1, { color = '#eaeaea', lineWidth = 1, ratio = 1 } = {}) => {
  ctx.strokeStyle = color.toUpperCase();
  ctx.lineWidth = lineWidth * ratio;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const renderCircle = (canvas, ctx) => (x, y, radius, { color = 'black', lineWidth = 1, ratio = 1 } = {}) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth * ratio;
  ctx.fillStyle = 'white';
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
  const dataColumns = omitProps(chartData, ['x']);
  const maxDataLength = Math.max(...Object.values(dataColumns).map(col => col.data.length)) - 1;
  const maxDataValue = Math.max(...concatArrays(Object.values(dataColumns).map(col => col.data)));
  const stepX = chartSize.width / Math.max(maxDataLength, 1);
  const stepY = (chartSize.height * (1 - topOffsetPercent) - bottomOffset * chartSize.ratio) / maxDataValue;
  return { stepX, stepY, maxDataValue, maxDataLength };
};

const renderFrame = (canvas, ctx) => ({ chartSize }) => {
  const color = '#d6d5d4';
  renderLine(canvas, ctx)(0, 0, chartSize.width, 0, { color, ratio: chartSize.ratio });
  renderLine(canvas, ctx)(0, chartSize.height, chartSize.width, chartSize.height, { color, ratio: chartSize.ratio });
};

const renderLineChart = (canvas, ctx) => ({ columnData, chartSize, stepX, stepY }, { lineWidth = 1, bottomOffset = 0 } = {}) => {
  ctx.strokeStyle = columnData.color.toUpperCase();
  ctx.lineWidth = lineWidth * chartSize.ratio;
  ctx.beginPath();
  columnData.data.forEach((num, index) => {
    const coords = getDataValueCoords({ chartSize, stepX, stepY }, { bottomOffset })(num, index);
    ctx.lineTo(coords.x, coords.y);
  });
  ctx.stroke();
};

const renderTimeline = (canvas, ctx) => ({ chartSize, chartData }, { bottomOffset = 4 } = {}) => {
  ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
  ctx.fillStyle = '#a5a5a5';
  const labelWidth = 100 * chartSize.ratio;
  const bestLabelsAmount = Math.floor(chartSize.width / labelWidth);
  const leaveEach = Math.ceil(chartData.x.data.length / bestLabelsAmount);
  // const getTextWidth = dateText => dateText.length * 8 * chartSize.ratio;
  const firstDate = new Date(chartData.x.data[0]);
  const firstDateText = getDateText(firstDate);
  // debug('firstDateText', firstDateText);
  const lastDate = new Date(chartData.x.data[chartData.x.data.length - 1]);
  const lastDateText = getDateText(lastDate);
  // debug('lastDateText', lastDateText);
  chartData.x.data
    .filter((value, index, arr) => index % leaveEach === 0 || index === arr.length - 1)
    .forEach((timestamp, index, arr) => {
      const isFirst = index === 0;
      const isLast = index === arr.length - 1;
      const date = isFirst ? firstDate : isLast ? lastDate : new Date(timestamp);
      const dateText = isFirst ? firstDateText : isLast ? lastDateText : getDateText(date);
      const interval = chartSize.width / arr.length;
      const correction = 0; // isLast ? interval - getTextWidth(dateText) : 0;
      const leftOffset = interval * index + correction;
      ctx.fillText(dateText, leftOffset, chartSize.height - bottomOffset * chartSize.ratio);
    });
};

const getGridRows = ({ chartSize, maxDataValue }, { bottomOffset = 0 }) => {
  const rowsAmount = 5;
  const gridRows = Array(rowsAmount)
    .fill(1)
    .map((val, idx) => Math.round((idx * maxDataValue) / rowsAmount))
    .map((value, idx, arr) => {
      const interval = (chartSize.height - bottomOffset * chartSize.ratio) / arr.length;
      const level = chartSize.height - bottomOffset * chartSize.ratio - interval * idx;
      return { value, level, label: formatGridValue(value) };
    });
  return gridRows;
};

const renderGrid = (canvas, ctx) => (gridRows, chartSize) => {
  gridRows.forEach(row => {
    renderLine(canvas, ctx)(0, row.level, chartSize.width, row.level, { ratio: chartSize.ratio });
  });
};

const renderGridValues = (canvas, ctx) => (gridRows, chartSize) => {
  gridRows.forEach(row => {
    ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
    ctx.fillStyle = '#a5a5a5';
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

const renderTooltip = (canvas, ctx, $tooltipContainer) => ({ chartSize, chartData, chartClick, stepX, stepY }, { bottomOffset = 0 } = {}) => {
  const pointData = getTooltipPoint({ chartSize, chartData, chartClick, stepX, stepY }, { bottomOffset });
  const points = Object.values(pointData.data);
  if (!points.length) return;
  const topOffset = 5;
  const point = points[0];
  renderLine(canvas, ctx)(point.coords.x, topOffset * chartSize.ratio, point.coords.x, chartSize.height - bottomOffset * chartSize.ratio, {
    ratio: chartSize.ratio,
  });
  Object.values(pointData.data).forEach(column => {
    renderCircle(canvas, ctx)(column.coords.x, column.coords.y, 4, { color: column.color, lineWidth: 3, ratio: chartSize.ratio });
  });
  clearNodeChildren($tooltipContainer);
  const $tooltip = getTooltipNode(pointData);
  $tooltip.style.visibility = 'hidden';
  $tooltipContainer.appendChild($tooltip);
  const rightFreeSpace = (chartSize.width - point.coords.x) / chartSize.ratio;
  const shift = 15;
  $tooltipContainer.style.top = `${topOffset}px`;
  if (rightFreeSpace < $tooltip.clientWidth) {
    $tooltipContainer.style.left = `${point.coords.x / chartSize.ratio - $tooltip.clientWidth + shift}px`;
  } else {
    $tooltipContainer.style.left = `${point.coords.x / chartSize.ratio - shift}px`;
  }
  $tooltip.style.visibility = 'visible';
};

exports.renderChart = (canvas, ctx, $tooltipContainer) => ({ chartSize, chartData, chartClick }, options = {}) => {
  const { withGrid, withTimeline, withTooltip, withFrame, lineWidth = 1, topOffsetPercent, bottomOffset = 0 } = options;
  const yColumns = omitProps(chartData, ['x']);
  const { stepX, stepY, maxDataValue } = getChartSteps({ chartSize, chartData }, { topOffsetPercent, bottomOffset });
  clearChart(canvas, ctx)();
  clearNodeChildren($tooltipContainer);
  const gridRows = withGrid ? getGridRows({ chartSize, chartData, stepX, stepY, maxDataValue }, { bottomOffset }) : [];
  if (gridRows.length) renderGrid(canvas, ctx)(gridRows, chartSize);
  Object.values(yColumns).forEach(columnData => {
    renderLineChart(canvas, ctx)({ chartSize, columnData, stepX, stepY }, { lineWidth, bottomOffset });
  });
  if (withFrame) renderFrame(canvas, ctx)({ chartSize });
  if (gridRows.length) renderGridValues(canvas, ctx)(gridRows, chartSize);
  if (withTimeline) renderTimeline(canvas, ctx)({ chartSize, chartData });
  if (withTooltip && chartClick) renderTooltip(canvas, ctx, $tooltipContainer)({ chartSize, chartData, chartClick, stepX, stepY }, { bottomOffset });
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
