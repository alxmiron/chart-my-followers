const getSlider = require('./slider');
const Observable = require('./observable');
const { clearChart, renderLine, renderFrame, renderDataSelect } = require('./render');
const { formatChartData } = require('./data');
const { getDeviceRatio, omitProps, concatArrays } = require('./utils');

const bootstrap = () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const $dataSelect = document.getElementById('dataset-select');
  const ratio = getDeviceRatio(ctx);
  ctx.scale(ratio, ratio);

  // Source data:
  const dataSelect$ = new Observable('dataSelect')
    .fromEvent($dataSelect, 'change')
    .map(event => parseInt(event.target.value, 10))
    .withInitialEvent(0);
  const dataset$ = new Observable('dataset');
  const sourceData$ = dataset$
    .merge([dataSelect$.withName('dataSelect')])
    .map(({ dataset, dataSelect }) => dataset[dataSelect])
    .withName('sourceData')
    .subscribe(sourceData => {
      console.log('Source data:'); // eslint-disable-line no-console
      console.dir(sourceData); // eslint-disable-line no-console
    });

  // Chart sizing:
  const windowSize$ = new Observable()
    .fromEvent(window, 'resize')
    .map(event => ({
      width: event.target.innerWidth,
      windowHeight: event.target.innerHeight,
    }))
    .filter((windowSize, prevWindowSize) => !prevWindowSize || windowSize.width !== prevWindowSize.width);
  const navChartSize$ = windowSize$
    .map(windowSize => ({ ratio, width: (windowSize.width - 10 * 2) /* paddings */ * ratio, height: 60 * ratio }))
    .subscribe(chartSize => {
      canvas.width = chartSize.width;
      canvas.height = chartSize.height;
      canvas.style.width = chartSize.width / ratio + 'px';
      canvas.style.height = chartSize.height / ratio + 'px';
    });
  windowSize$.withInitialEvent({ width: window.innerWidth, height: window.innerHeight });

  // Nav chart:
  sourceData$.merge([navChartSize$.withName('chartSize')]).subscribe(({ chartSize, sourceData, ...otherProps }) => {
    const yColumns = omitProps(sourceData, ['x']);
    const maxDataLength = Math.max(...Object.values(yColumns).map(col => col.data.length)) - 1;
    const maxDataValue = Math.max(...concatArrays(Object.values(yColumns).map(col => col.data)));
    const stepX = chartSize.width / Math.max(maxDataLength, 1);
    const stepY = (chartSize.height * 0.9) / (maxDataValue + 1);
    clearChart(canvas, ctx)();
    Object.values(yColumns).forEach(columnData => {
      renderLine(canvas, ctx)({ ...otherProps, chartSize, columnData, stepX, stepY });
    });
    renderFrame(canvas, ctx)({ ...otherProps, chartSize });
  });

  /* const slider$ = */ getSlider();
  fetch('assets/chart_data.min.json')
    .then(response => response.json())
    .then(dataset => formatChartData(dataset))
    .then(dataset => renderDataSelect($dataSelect, dataset))
    .then(dataset => dataset$.broadcast(dataset))
    .catch(console.error); // eslint-disable-line no-console
};

window.onload = bootstrap;
