const getSliderObservable = require('./slider');
const Observable = require('./observable');
const { getChartSizeObservable, renderChart } = require('./chart');
const { renderDataSelect, getSwitchesObservable, renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { formatChartData } = require('./data');
const { getDeviceRatio, omitProps, updateThemeButton } = require('./utils');
const { debug, debugDir } = require('./debug');

const bootstrap = () => {
  const bigCanvas = document.getElementById('big-canvas');
  const bigCtx = bigCanvas.getContext('2d');

  const navCanvas = document.getElementById('nav-canvas');
  const navCtx = navCanvas.getContext('2d');

  const ratio = getDeviceRatio(navCtx);
  navCtx.scale(ratio, ratio);
  bigCtx.scale(ratio, ratio);

  const rootNode = document.getElementById('root');
  const $dataSelect = document.getElementById('dataset-select');
  const $columnSwitches = document.getElementById('column-switches');
  const $tooltipContainer = document.getElementById('tooltip-container');
  const $themeButton = document.getElementById('theme-button');

  const darkTheme$ = new Observable('darkTheme')
    .fromEvent($themeButton, 'click')
    .withInitialEvent(false)
    .map(() => !darkTheme$.lastValue)
    .withName('darkTheme')
    .subscribe(value => {
      if (value) {
        rootNode.classList.add('dark');
      } else {
        rootNode.classList.remove('dark');
      }
      updateThemeButton($themeButton, value);
    });

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
      height: event.target.innerHeight,
      paddings: 20,
    }))
    .withInitialEvent({ width: window.innerWidth, height: window.innerHeight, paddings: 20 });

  // Navigation slider
  const slider$ = getSliderObservable()
    .map(
      slider => {
        return { left: parseInt(slider[0]) / 1000, right: parseInt(slider[1]) / 1000 };
      },
      { inheritLastValue: true },
    )
    .withName('slider');

  const withBigCanvas = fn => fn(bigCanvas, bigCtx);
  const withNavCanvas = fn => fn(navCanvas, navCtx);

  withBigCanvas((canvas, ctx) => {
    const chartHeight = windowSize => Math.min(windowSize.height - /* paddings */ 10 - /* title */ 15 - 34 - /* nav */ 65 - /* controls */ 100, 600);
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: chartHeight, ratio }).withName('chartSize');

    const bigChartData$ = chartData$
      .merge([slider$])
      .map(({ chartData, slider }) => {
        const { left, right } = slider;
        return Object.values(omitProps(chartData, ['slider'])).reduce((acc, column) => {
          const leftIndex = Math.floor(column.data.length * left);
          const rightIndex = Math.ceil(column.data.length * right);
          const fixedRightIndex = rightIndex - leftIndex < 2 ? leftIndex + 2 : rightIndex;
          const normalLeftIndex = Math.min(leftIndex, column.data.length - 2);
          const normalRightIndex = Math.max(fixedRightIndex, 2);
          acc[column.id] = { ...column, data: column.data.slice(normalLeftIndex, normalRightIndex) };
          return acc;
        }, {});
      })
      .withName('chartData');

    const chartClick$ = new Observable('chartClick', { saveLastValue: false })
      .fromEvent(canvas, 'click')
      .map(event => ({ x: event.offsetX, y: event.offsetY }))
      .withOption('saveLastValue', false)
      .withName('chartClick');

    bigChartData$.merge([chartSize$, chartClick$, darkTheme$]).subscribe(({ chartSize, chartData, chartClick, darkTheme }) => {
      const options = { withGrid: true, withTimeline: true, withTooltip: true, lineWidth: 1.4, topOffsetPercent: 0.2, bottomOffset: 20 };
      renderChart(canvas, ctx, $tooltipContainer)({ chartSize, chartData, chartClick, darkTheme }, options);
    });
  });

  withNavCanvas((canvas, ctx) => {
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, { height: 60, ratio }).withName('chartSize');

    chartData$.merge([chartSize$]).subscribe(({ chartSize, chartData }) => {
      const options = { topOffsetPercent: 0.1 };
      renderChart(canvas, ctx, $tooltipContainer)({ chartSize, chartData }, options);
    });
  });

  // Load dataset from server
  fetch('chart_data.min.json')
    .then(response => response.json())
    .then(dataset => formatChartData(dataset))
    .then(dataset => renderDataSelect($dataSelect, dataset))
    .then(dataset => dataset$.broadcast(dataset))
    .catch(console.error); // eslint-disable-line no-console
};

window.onload = bootstrap;
