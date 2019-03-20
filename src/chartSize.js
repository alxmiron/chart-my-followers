const resizeChart = (canvas, chartSize) => {
  canvas.width = chartSize.width;
  canvas.height = chartSize.height;
  canvas.style.width = chartSize.width / chartSize.ratio + 'px';
  canvas.style.height = chartSize.height / chartSize.ratio + 'px';
};

exports.f = (windowSize$, canvas, height, ratio) => {
  const chartSize$ = windowSize$
    .map(windowSize => {
      const chartWidth = (windowSize.width - windowSize.paddings) * ratio;
      const chartHeight = (typeof height === 'function' ? height(windowSize) : height) * ratio;
      return { ratio, width: chartWidth, height: chartHeight };
    }, true)
    .subscribe(chartSize => resizeChart(canvas, chartSize))
    .repeatLast();
  return chartSize$;
};
