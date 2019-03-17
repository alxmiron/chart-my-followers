const getSliderObservable = require('./slider');
const Observable = require('./observable');
const { getChartSizeObservable, clearChart, getGridRows } = require('./chart');
const { renderLineChart, renderFrame, renderTimeline, renderGrid, renderGridValues, renderTooltip } = require('./chart');
const { renderDataSelect, getSwitchesObservable, renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { formatChartData } = require('./data');
const { getDeviceRatio, omitProps, concatArrays } = require('./utils');
const { debug, debugDir } = require('./debug');

const bootstrap = () => {
  const bigCanvas = document.getElementById('big-canvas');
  const bigCtx = bigCanvas.getContext('2d');

  const navCanvas = document.getElementById('nav-canvas');
  const navCtx = navCanvas.getContext('2d');

  const ratio = getDeviceRatio(navCtx);
  navCtx.scale(ratio, ratio);
  bigCtx.scale(ratio, ratio);

  const $dataSelect = document.getElementById('dataset-select');
  const $columnSwitches = document.getElementById('column-switches');

  const dataSelect$ = new Observable('dataSelect')
    .fromEvent($dataSelect, 'change')
    .map(event => parseInt(event.target.value, 10))
    .withInitialEvent(0);

  // dataset, loaded from server
  const dataset$ = new Observable('dataset');

  // Columns checkboxes
  const columnSwitches$ = getSwitchesObservable($columnSwitches);

  // Dataset case (filtered by dataSelect)
  const sourceData$ = dataset$
    .merge([dataSelect$.withName('dataSelect')])
    .map(({ dataset, dataSelect }) => dataset[dataSelect])
    .withName('sourceData')
    .subscribe(sourceData => {
      debug('Source data:');
      debugDir(sourceData);
      renderColumnControls($columnSwitches, sourceData);
      updateSwitchesSubscriptions($columnSwitches, columnSwitches$);
    });

  // Chart data (filtered by columns checkboxes)
  const chartData$ = sourceData$
    .merge([columnSwitches$])
    .map(({ columnSwitches, sourceData }) => omitProps(sourceData, Object.keys(columnSwitches).filter(colId => !columnSwitches[colId])))
    .withName('chartData');

  // Global window size
  const windowSize$ = new Observable()
    .fromEvent(window, 'resize')
    .map(event => ({
      width: event.target.innerWidth,
      windowHeight: event.target.innerHeight,
      paddings: 20,
    }))
    .filter((windowSize, prevWindowSize) => !prevWindowSize || windowSize.width !== prevWindowSize.width)
    .withInitialEvent({ width: window.innerWidth, height: window.innerHeight, paddings: 20 });

  // Navigation slider
  const slider$ = getSliderObservable().withName('slider');

  const withBigCanvas = fn => fn(bigCanvas, bigCtx);
  const withNavCanvas = fn => fn(navCanvas, navCtx);

  withBigCanvas((canvas, ctx) => {
    const bottomOffset = 20;
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: 420, ratio }).withName('chartSize');

    const bigChartData$ = chartData$
      .merge([slider$])
      .map(({ chartData, slider }) => {
        const left = parseFloat(slider[0]) / 100;
        const right = parseFloat(slider[1]) / 100;
        return Object.values(chartData).reduce((acc, column) => {
          const leftIndex = Math.floor(column.data.length * left);
          const rightIndex = Math.ceil(column.data.length * right);
          acc[column.id] = { ...column, data: column.data.slice(leftIndex, rightIndex) };
          return acc;
        }, {});
      })
      .withName('chartData');

    const chartClick$ = new Observable('chartClick', { saveLastValue: false })
      .fromEvent(canvas, 'click')
      .map(event => ({ x: event.offsetX, y: event.offsetY }))
      .withOption('saveLastValue', false)
      .withName('chartClick');

    const getChartSteps = ({ chartSize, chartData }, { yColumns } = {}) => {
      const dataColumns = yColumns || omitProps(chartData, ['x']);
      const maxDataLength = Math.max(...Object.values(dataColumns).map(col => col.data.length)) - 1;
      const maxDataValue = Math.max(...concatArrays(Object.values(dataColumns).map(col => col.data)));
      const stepX = chartSize.width / Math.max(maxDataLength, 1);
      const stepY = (chartSize.height * 0.9) / (maxDataValue + 1);
      return { stepX, stepY, maxDataValue, maxDataLength };
    };

    /* const tooltip$ = */ chartClick$
      .merge([bigChartData$, chartSize$])
      .withOption('saveLastValue', false)
      .filter(data => !!data.chartClick)
      .subscribe(({ chartSize, chartData, chartClick }) => {
        const { stepX, stepY } = getChartSteps({ chartSize, chartData });
        renderTooltip(canvas, ctx)({ chartSize, chartData, chartClick, stepX, stepY }, { bottomOffset });
      });

    bigChartData$.merge([chartSize$]).subscribe(({ chartSize, chartData }) => {
      const yColumns = omitProps(chartData, ['x']);
      const { stepX, stepY, maxDataValue } = getChartSteps({ chartSize, chartData }, { yColumns });
      clearChart(canvas, ctx)();
      const gridRows = getGridRows({ chartSize, chartData, stepX, stepY, maxDataValue }, { bottomOffset });
      renderGrid(canvas, ctx)(gridRows, chartSize);
      Object.values(yColumns).forEach(columnData => {
        renderLineChart(canvas, ctx)({ chartSize, columnData, stepX, stepY }, { lineWidth: 1.4, bottomOffset });
      });
      renderGridValues(canvas, ctx)(gridRows, chartSize);
      renderTimeline(canvas, ctx)({ chartSize, chartData });
    });
  });

  withNavCanvas((canvas, ctx) => {
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: 60, ratio }).withName('chartSize');

    chartData$.merge([chartSize$]).subscribe(({ chartSize, chartData, ...otherProps }) => {
      const yColumns = omitProps(chartData, ['x']);
      const maxDataLength = Math.max(...Object.values(yColumns).map(col => col.data.length)) - 1;
      const maxDataValue = Math.max(...concatArrays(Object.values(yColumns).map(col => col.data)));
      const stepX = chartSize.width / Math.max(maxDataLength, 1);
      const stepY = (chartSize.height * 0.9) / (maxDataValue + 1);
      clearChart(canvas, ctx)();
      Object.values(yColumns).forEach(columnData => {
        renderLineChart(canvas, ctx)({ ...otherProps, chartSize, columnData, stepX, stepY });
      });
      renderFrame(canvas, ctx)({ ...otherProps, chartSize });
    });
  });

  // Load dataset from server
  fetch('assets/chart_data.min.json')
    .then(response => response.json())
    .then(dataset => formatChartData(dataset))
    .then(dataset => renderDataSelect($dataSelect, dataset))
    .then(dataset => dataset$.broadcast(dataset))
    .catch(console.error); // eslint-disable-line no-console
};

window.onload = bootstrap;
