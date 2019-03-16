const renderFrame = (canvas, ctx) => ({ chartSize }) => {
  ctx.strokeStyle = '#d6d5d4'.toUpperCase();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(chartSize.width, 0);
  ctx.moveTo(0, chartSize.height);
  ctx.lineTo(chartSize.width, chartSize.height);
  ctx.stroke();
};

const renderLine = (canvas, ctx) => ({ columnData, chartSize, stepX, stepY }) => {
  ctx.strokeStyle = columnData.color.toUpperCase();
  ctx.lineWidth = chartSize.ratio;
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

module.exports = { clearChart, renderLine, renderFrame };
