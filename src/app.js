const getSliderObservable = require('./slider').f;
const Observable = require('./observable');
const getChartSizeObservable = require('./chartSize').f;
const { renderChart, getChartConfig, getGridRows } = require('./chart');
const { renderDataSelect, renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { getDeviceRatio, updateThemeButton } = require('./utils');

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
  const columnSwitches$ = new Observable('columnSwitches');
  columnSwitches$.lastValue = {};

  // Dataset case (filtered by dataSelect)
  const sourceData$ = dataset$
    .merge([dataSelect$.withName('dataSelect')])
    .map(({ dataset, dataSelect }) => ({ columns: dataset[dataSelect], index: dataSelect }))
    .withName('sourceData')
    .subscribe(sourceData => {
      const firstCall = !$columnSwitches.childNodes.length;
      renderColumnControls($columnSwitches, sourceData.columns);
      updateSwitchesSubscriptions($columnSwitches, columnSwitches$, firstCall);
    });

  const invertEase = false;
  const alphaSwitches$ = columnSwitches$
    .withTransition(data => data.y0, (data, newVal) => ({ ...data, y0: newVal }), { invertEase })
    .withTransition(data => data.y1, (data, newVal) => ({ ...data, y1: newVal }), { invertEase })
    .withTransition(data => data.y2, (data, newVal) => ({ ...data, y2: newVal }), { invertEase })
    .withTransition(data => data.y3, (data, newVal) => ({ ...data, y3: newVal }), { invertEase })
    .withTransition(data => data.y4, (data, newVal) => ({ ...data, y4: newVal }), { invertEase })
    .withName('alphaSwitches');

  // Chart data (filtered by columns checkboxes)
  const chartData$ = sourceData$
    .merge([alphaSwitches$])
    .map(({ alphaSwitches, sourceData }) => ({
      columns: Object.keys(sourceData.columns).reduce((acc, colId) => {
        acc[colId] = { ...sourceData.columns[colId], alpha: alphaSwitches[colId] };
        return acc;
      }, {}),
      dataIndex: sourceData.index,
      slider: { left: 0, right: 1 },
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
  const isDatasetChanged = (chartData, prevChartData) => !prevChartData || prevChartData.dataIndex !== chartData.dataIndex;
  const getStepY = data => data.config.stepY;
  const setStepY = (data, newValue) => ({ ...data, config: { ...data.config, stepY: newValue } });
  const ignoreStepYif = (data, lastValue) =>
    Object.values(lastValue.columns)
      .filter(col => col.id !== 'x')
      .every(col => col.alpha < 1);

  withBigCanvas((canvas, ctx) => {
    const chartOptions = { withGrid: true, withTimeline: true, withTooltip: true, lineWidth: 2, topOffsetPercent: 0.2, bottomOffset: 20 };
    const chartHeight = windowSize => Math.min(windowSize.height /* paddings */ - 10 /* title */ - 34 /* nav */ - 65 /* controls */ - 110 - 15, 600);
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, chartHeight, ratio).withName('chartSize');

    const chartClick$ = new Observable('chartClick', false)
      .fromEvent(canvas, 'click')
      .map(event => ({ x: event.offsetX, y: event.offsetY }))
      .withOption('saveLastValue', false)
      .withName('chartClick');

    const bigChartData$ = chartData$
      .merge([slider$, chartSize$])
      .map(({ chartData, chartSize, slider }, prev) => {
        const data = { ...chartData, size: chartSize, slider };
        data.datasetChanged = isDatasetChanged(chartData, prev && prev.chartData);
        data.config = getChartConfig(data, chartOptions.topOffsetPercent, chartOptions.bottomOffset);
        return data;
      })
      .withTransition(getStepY, setStepY, { ignoreIf: ignoreStepYif })
      .map(chartData => {
        chartData.gridRows = getGridRows(chartData, chartOptions.topOffsetPercent, chartOptions.bottomOffset);
        return chartData;
      })
      .withName('chartData');

    bigChartData$.merge([chartClick$, darkTheme$]).subscribe(({ chartData, chartClick, darkTheme }) => {
      renderChart(canvas, ctx, $tooltipContainer)(chartData, chartClick, darkTheme, chartOptions);
    });
  });

  withNavCanvas((canvas, ctx) => {
    const chartOptions = { lineWidth: 1.4, topOffsetPercent: 0.1 };
    const chartSize$ = getChartSizeObservable(windowSize$, canvas, 60, ratio).withName('chartSize');

    const navChartData$ = chartData$
      .merge([chartSize$])
      .map(({ chartData, chartSize }, prev) => {
        const data = { ...chartData, size: chartSize };
        data.datasetChanged = isDatasetChanged(chartData, prev && prev.chartData);
        data.config = getChartConfig(data, chartOptions.topOffsetPercent);
        return data;
      })
      .withTransition(getStepY, setStepY, { ignoreIf: ignoreStepYif })
      .withName('chartData');

    navChartData$.subscribe(data => {
      renderChart(canvas, ctx, $tooltipContainer)(data, null, false, chartOptions);
    });
  });

  const formatChartData = dataset => {
    return dataset.map(dataCase => {
      return dataCase.columns.reduce((acc, column) => {
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
    });
  };

  // Load dataset from server
  fetch('chart_data.min.json')
    .then(response => response.json())
    .then(dataset => formatChartData(dataset))
    .then(dataset => renderDataSelect($dataSelect, dataset))
    .then(dataset => dataset$.broadcast(dataset))
    .catch(console.error); // eslint-disable-line no-console
};

window.onload = bootstrap;
