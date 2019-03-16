// const { debug } = require('./debug');

const renderLine = (canvas, ctx) => (x0, y0, x1, y1, { color = '#eaeaea' } = {}) => {
  ctx.strokeStyle = color.toUpperCase();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.stroke();
};

exports.renderFrame = (canvas, ctx) => ({ chartSize }) => {
  const color = '#d6d5d4';
  renderLine(canvas, ctx)(0, 0, chartSize.width, 0, { color });
  renderLine(canvas, ctx)(0, chartSize.height, chartSize.width, chartSize.height, { color });
};

const getDataValueCoords = ({ chartSize, stepX, stepY }, { bottomOffset }) => (num, index = 0) => {
  return {
    x: index * stepX,
    y: chartSize.height - bottomOffset * chartSize.ratio - num * stepY,
  };
};

exports.renderLine = (canvas, ctx) => ({ columnData, chartSize, stepX, stepY }, { lineWidth = 1, bottomOffset = 0 } = {}) => {
  ctx.strokeStyle = columnData.color.toUpperCase();
  ctx.lineWidth = lineWidth * chartSize.ratio;
  ctx.beginPath();
  columnData.data.forEach((num, index) => {
    const coords = getDataValueCoords({ chartSize, stepX, stepY }, { bottomOffset })(num, index);
    ctx.lineTo(coords.x, coords.y);
  });
  ctx.stroke();
};

exports.renderTimeline = (canvas, ctx) => ({ chartSize, chartData }, { bottomOffset = 4 } = {}) => {
  ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
  ctx.fillStyle = '#a5a5a5';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labelWidth = 100 * chartSize.ratio;
  const bestLabelsAmount = Math.floor(chartSize.width / labelWidth);
  const leaveEach = Math.ceil(chartData.x.data.length / bestLabelsAmount);
  const getDateText = date => `${months[date.getMonth()]} ${date.getDate()}`;
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

const formatGridValue = value => {
  if (value > 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value > 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

exports.getGridRows = ({ chartSize }, { maxDataValue, bottomOffset = 0 } = {}) => {
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

exports.renderGrid = (canvas, ctx) => (gridRows, chartSize) => {
  gridRows.forEach(row => {
    renderLine(canvas, ctx)(0, row.level, chartSize.width, row.level);
  });
};

exports.renderGridValues = (canvas, ctx) => (gridRows, chartSize) => {
  gridRows.forEach(row => {
    ctx.font = `lighter ${12 * chartSize.ratio}px sans-serif`;
    ctx.fillStyle = '#a5a5a5';
    ctx.fillText(row.label, 0, row.level - 5 * chartSize.ratio);
  });
};

exports.clearChart = (canvas, ctx) => () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const resizeChart = (canvas, chartSize) => {
  canvas.width = chartSize.width;
  canvas.height = chartSize.height;
  canvas.style.width = chartSize.width / chartSize.ratio + 'px';
  canvas.style.height = chartSize.height / chartSize.ratio + 'px';
};

exports.getChartSizeObservable = (windowSize$, canvas, { ratio, height }) => {
  const chartSize$ = windowSize$
    .map(windowSize => ({ ratio, width: (windowSize.width - windowSize.paddings) * ratio, height: height * ratio }), { inheritLastValue: true })
    .subscribe(chartSize => resizeChart(canvas, chartSize))
    .repeatLast();
  return chartSize$;
};
