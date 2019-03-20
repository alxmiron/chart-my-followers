const getSliderObservable = require('./slider').f;
const Observable = require('./observable');
const getChartSizeObservable = require('./chartSize').f;
const { renderChart, getChartConfig } = require('./chart');
const { renderDataSelect, getSwitchesObservable, renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { getDeviceRatio, omitProps, updateThemeButton } = require('./utils');

const bootstrap = () => {
  const formatChartData = dataset => {
    return dataset.map(dataCase => {
      const columns = dataCase.columns.reduce((acc, column) => {
        const columnId = column[0];
        acc[columnId] = {
          id: columnId,
          data: column.slice(1),
          color: dataCase.colors[columnId],
          name: dataCase.names[columnId],
          type: dataCase.types[columnId],
        };
        return acc;
      }, {});
      return { columns, slider: { left: 0, right: 1 } };
    });
  };

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
      renderColumnControls($columnSwitches, sourceData);
      updateSwitchesSubscriptions($columnSwitches, columnSwitches$);
    });

  // Chart data (filtered by columns checkboxes)
  const chartData$ = sourceData$
    .merge([columnSwitches$])
    .map(({ columnSwitches, sourceData }) => ({
      ...sourceData,
      columns: omitProps(sourceData.columns, Object.keys(columnSwitches).filter(colId => !columnSwitches[colId])),
    }))
    .withName('chartData');

  // Global window size
  const windowSize$ = new Observable()
    .fromEvent(window, 'resize')
    .map(event => ({ width: event.target.innerWidth, height: event.target.innerHeight, paddings: 20 }))
    .withInitialEvent({ width: window.innerWidth, height: window.innerHeight, paddings: 20 });

  // Navigation slider
  const slider$ = getSliderObservable();

  const withBigCanvas = fn => fn(bigCanvas, bigCtx);
  const withNavCanvas = fn => fn(navCanvas, navCtx);

  withBigCanvas((canvas, ctx) => {
    const chartOptions = { withGrid: true, withTimeline: true, withTooltip: true, lineWidth: 1.4, topOffsetPercent: 0.2, bottomOffset: 20 };
    const chartHeight = windowSize => Math.min(windowSize.height /* paddings */ - 10 /* title */ - 34 /* nav */ - 65 /* controls */ - 110 - 15, 600);
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, chartHeight, ratio).withName('chartSize');

    const bigChartData$ = chartData$
      .merge([slider$])
      .map(({ chartData, slider }) => ({ ...chartData, slider }))
      .withName('chartData');

    const chartClick$ = new Observable('chartClick', false)
      .fromEvent(canvas, 'click')
      .map(event => ({ x: event.offsetX, y: event.offsetY }))
      .withOption('saveLastValue', false)
      .withName('chartClick');

    const chartConfig$ = bigChartData$
      .merge([chartSize$])
      .map(({ chartSize, chartData }) => {
        return getChartConfig(chartSize, chartData, chartOptions.topOffsetPercent, chartOptions.bottomOffset);
      })
      .withName('chartConfig')
      .subscribe(console.dir);

    bigChartData$
      .merge([chartSize$, chartConfig$, chartClick$, darkTheme$])
      .subscribe(({ chartSize, chartData, chartConfig, chartClick, darkTheme }) => {
        if (!chartData) return;
        renderChart(canvas, ctx, $tooltipContainer)(chartSize, chartData, chartConfig, chartClick, darkTheme, chartOptions);
      });
  });

  withNavCanvas((canvas, ctx) => {
    const chartOptions = { topOffsetPercent: 0.1 };
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, 60, ratio).withName('chartSize');

    chartData$.merge([chartSize$]).subscribe(({ chartSize, chartData }) => {
      const chartConfig = getChartConfig(chartSize, chartData, chartOptions.topOffsetPercent);
      renderChart(canvas, ctx, $tooltipContainer)(chartSize, chartData, chartConfig, null, false, chartOptions);
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
