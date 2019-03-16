const renderFrame = (canvas, ctx) => ({ chartSize }) => {
  ctx.strokeStyle = '#d6d5d4'.toUpperCase();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(chartSize.width, 0);
  ctx.moveTo(0, chartSize.height);
  ctx.lineTo(chartSize.width, chartSize.height);
  ctx.stroke();
};

const renderLine = (canvas, ctx) => ({ columnData, chartSize, stepX, stepY }, { lineWidth = 1 } = {}) => {
  ctx.strokeStyle = columnData.color.toUpperCase();
  ctx.lineWidth = lineWidth * chartSize.ratio;
  ctx.beginPath();
  columnData.data.forEach((num, index) => {
    const x = index * stepX;
    const y = chartSize.height - num * stepY;
    ctx.lineTo(x, y);
  });
  ctx.stroke();
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

const getChartSizeObservable = (windowSize$, canvas, { ratio, height }) => {
  const chartSize$ = windowSize$
    .map(windowSize => ({ ratio, width: (windowSize.width - windowSize.paddings) * ratio, height: height * ratio }), { inheritLastValue: true })
    .subscribe(chartSize => resizeChart(canvas, chartSize))
    .repeatLast();
  return chartSize$;
};

module.exports = { clearChart, renderLine, renderFrame, getChartSizeObservable };
