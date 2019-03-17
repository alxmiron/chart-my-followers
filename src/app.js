const getSliderObservable = require('./slider');
const Observable = require('./observable');
const { getChartSizeObservable, renderChart } = require('./chart');
const { renderDataSelect, getSwitchesObservable, renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { formatChartData } = require('./data');
const { getDeviceRatio, omitProps } = require('./utils');
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
  const $tooltipContainer = document.getElementById('tooltip-container');

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
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: 500, ratio }).withName('chartSize');

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

    bigChartData$.merge([chartSize$, chartClick$]).subscribe(({ chartSize, chartData, chartClick }) => {
      const options = { withGrid: true, withTimeline: true, withTooltip: true, lineWidth: 1.4, topOffsetPercent: 0.2, bottomOffset: 20 };
      renderChart(canvas, ctx, $tooltipContainer)({ chartSize, chartData, chartClick }, options);
    });
  });

  withNavCanvas((canvas, ctx) => {
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: 60, ratio }).withName('chartSize');

    chartData$.merge([chartSize$]).subscribe(({ chartSize, chartData }) => {
      const options = { withFrame: true, topOffsetPercent: 0.1 };
      renderChart(canvas, ctx, $tooltipContainer)({ chartSize, chartData }, options);
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
