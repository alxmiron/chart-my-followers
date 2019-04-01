const getSliderObservable = require('./slider').f;
const Observable = require('./observable');
const { renderChart, getChartConfig, getGridRows } = require('./chart');
const { renderColumnControls, updateSwitchesSubscriptions } = require('./controls');
const { getDeviceRatio, updateThemeButton } = require('./utils');

const bootstrap = () => {
  const getChartSizeObservable = (windowSize$, canvas, height, ratio, withPaddings = true) => {
    const chartSize$ = windowSize$
      .map(windowSize => {
        const chartWidth = (windowSize.width - (withPaddings ? windowSize.paddings : 0)) * ratio;
        const chartHeight = height * ratio;
        return { ratio, width: chartWidth, height: chartHeight };
      }, true)
      .subscribe(chartSize => {
        canvas.width = chartSize.width;
        canvas.height = chartSize.height;
        canvas.style.width = chartSize.width / chartSize.ratio + 'px';
        canvas.style.height = chartSize.height / chartSize.ratio + 'px';
      })
      .repeatLast();
    return chartSize$;
  };

  const $themeButton = document.getElementById('theme-button');
  const darkTheme$ = new Observable('darkTheme')
    .fromEvent($themeButton, 'click')
    .withInitialEvent(false)
    .map(() => !darkTheme$.lastValue)
    .withName('darkTheme')
    .subscribe(value => {
      const rootNode = document.getElementById('root');
      if (value) {
        rootNode.classList.add('dark');
      } else {
        rootNode.classList.remove('dark');
      }
      updateThemeButton($themeButton, value);
    });

  // Global window size
  const windowSize$ = new Observable()
    .fromEvent(window, 'resize')
    .map(event => ({ width: event.target.innerWidth, height: event.target.innerHeight, paddings: 20 }))
    .withInitialEvent({ width: window.innerWidth, height: window.innerHeight, paddings: 20 });

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
    .then(sources => {
      sources.forEach((sourceData, index) => createChart(document.getElementById(`chart-${index}`), sourceData, index));
    })
    .catch(console.error); // eslint-disable-line no-console

  function createChart($container, sourceData, index) {
    $container.querySelector('h1').appendChild(document.createTextNode(`Chart ${index + 1}`));
    const bigCanvas = $container.querySelector('.big-canvas');
    const bigCtx = bigCanvas.getContext('2d');
    const navCanvas = $container.querySelector('.nav-canvas');
    const navCtx = navCanvas.getContext('2d');
    const $columnSwitches = $container.querySelector('.column-switches');
    const $tooltipContainer = $container.querySelector('.tooltip-container');

    const ratio = getDeviceRatio(navCtx);
    navCtx.scale(ratio, ratio);
    bigCtx.scale(ratio, ratio);

    // Columns checkboxes
    const columnSwitches$ = new Observable('columnSwitches');
    columnSwitches$.lastValue = {};

    const initAlphaValues = Object.keys(sourceData)
      .filter(colId => colId !== 'x')
      .reduce((acc, colId) => {
        acc[colId] = 1;
        return acc;
      }, {});
    const invertEase = false;
    const alphaSwitches$ = columnSwitches$
      .withTransition(data => data.y0, (data, newVal) => ({ ...data, y0: newVal }), { invertEase })
      .withTransition(data => data.y1, (data, newVal) => ({ ...data, y1: newVal }), { invertEase })
      .withTransition(data => data.y2, (data, newVal) => ({ ...data, y2: newVal }), { invertEase })
      .withTransition(data => data.y3, (data, newVal) => ({ ...data, y3: newVal }), { invertEase })
      .withTransition(data => data.y4, (data, newVal) => ({ ...data, y4: newVal }), { invertEase })
      // .withOption('lastValue', initAlphaValues)
      .withName('alphaSwitches');

    // Dataset case (filtered by dataSelect)
    renderColumnControls($columnSwitches, sourceData);
    updateSwitchesSubscriptions($columnSwitches, columnSwitches$);

    // Navigation slider
    const slider$ = getSliderObservable($container);

    // Chart data (filtered by columns checkboxes)
    const chartData$ = alphaSwitches$
      .map(alphaSwitches => ({
        columns: Object.keys(sourceData).reduce((acc, colId) => {
          acc[colId] = { ...sourceData[colId], alpha: alphaSwitches[colId] };
          return acc;
        }, {}),
        slider: { left: 0, right: 1 },
      }))
      .withName('chartData');

    const withBigCanvas = fn => fn(bigCanvas, bigCtx);
    const withNavCanvas = fn => fn(navCanvas, navCtx);
    const getStepY = data => data.config.stepY;
    const setStepY = (data, newValue) => ({ ...data, config: { ...data.config, stepY: newValue } });
    const getZoom = (newStepY, initStepY, targetStepY) => {
      const ifZoomIn = targetStepY - newStepY > 0;
      const change = targetStepY / initStepY; // from 0 to n
      const resizing = Math.abs(change - 1) > 0.02; // Ignore very small stepY changes
      if (!resizing) return { resizing };
      const zoomFinal = change - 1 > 0 ? Math.max(change - 1, 0.2) : Math.min(change - 1, -0.2); // Math.max(change - 1, 0.05);
      const zoomInStage = (newStepY - initStepY) / (targetStepY - initStepY); // from 0 to 1
      const zoomOutStage = (targetStepY - newStepY) / (targetStepY - initStepY); // from 1 to 0
      const zoomTop = (ifZoomIn ? zoomInStage : -zoomOutStage) * zoomFinal;
      const zoomBottom = (ifZoomIn ? zoomOutStage : -zoomInStage) * -zoomFinal;
      const alphaTop = Math.min(Math.max(ifZoomIn ? zoomOutStage : zoomInStage, 0) * 1.5, 1);
      const alphaBottom = Math.min(Math.max(ifZoomIn ? zoomInStage : zoomOutStage, 0) * 1.5, 1);
      return { resizing, ifZoomIn, zoomTop, zoomBottom, alphaTop, alphaBottom };
    };
    const setStepYAndGrid = (data, newStepY, initStepY, targetStepY, prevData) => {
      const { resizing, ifZoomIn, zoomTop, zoomBottom, alphaTop, alphaBottom } = getZoom(newStepY, initStepY, targetStepY);
      const gridRows = data.gridRows.reduce((acc, row, index) => {
        if (row.value === 0) return acc.concat([{ ...row, alpha: 1 }]); // Dont zoom 0 grid level
        if (resizing) {
          if (Array.isArray(row)) {
            // Continue grid zooming
            const origLevel = row[0].origLevel ? row[0].origLevel : row[0].level;
            acc.push([
              { ...row[0], origLevel, level: origLevel * (1 + zoomTop), alpha: alphaTop },
              { ...row[1], origLevel, level: origLevel * (1 + zoomBottom), alpha: alphaBottom },
            ]);
          } else {
            // Start grid zooming
            const origLevel = row.level;
            const rowTop = ifZoomIn ? prevData.gridRows[index] : row;
            const rowBottom = ifZoomIn ? row : prevData.gridRows[index];
            acc.push([
              { ...rowTop, origLevel, level: origLevel * (1 + zoomTop), alpha: alphaTop },
              { ...rowBottom, origLevel, level: origLevel * (1 + zoomBottom), alpha: alphaBottom },
            ]);
          }
        } else {
          // Stop grid zooming
          if (Array.isArray(row)) {
            const origLevel = row[0].origLevel;
            const nextIndex = Math.abs(origLevel - row[0].level) < Math.abs(origLevel - row[1].level) ? 0 : 1;
            acc.push({ ...row[nextIndex], origLevel: null, level: origLevel, alpha: 1 });
          } else {
            acc.push({ ...row, origLevel: null, level: row.origLevel || row.level, alpha: 1 });
          }
        }
        return acc;
      }, []);
      return { ...data, config: { ...data.config, stepY: newStepY }, gridRows };
    };
    const ignoreStepYif = (data, lastValue) =>
      Object.values(lastValue.columns)
        .filter(col => col.id !== 'x')
        .every(col => col.alpha < 1);

    withBigCanvas((canvas, ctx) => {
      const chartOptions = {
        withGrid: true,
        withTimeline: true,
        withTooltip: true,
        lineWidth: 2,
        topOffsetPercent: 0.2,
        bottomOffset: 20,
        sideOffset: 10,
      };
      const chartSize$ = getChartSizeObservable(windowSize$, canvas, 500, ratio, false).withName('chartSize');

      const chartClick$ = new Observable('chartClick', false)
        .fromEvent(canvas, 'click')
        .map(event => ({ x: event.offsetX, y: event.offsetY }))
        .withOption('saveLastValue', false)
        .withName('chartClick');

      const bigChartData$ = chartData$
        .merge([slider$, chartSize$])
        .map(({ chartData, chartSize, slider }) => {
          const data = { ...chartData, size: chartSize, slider };
          data.config = getChartConfig(data, chartOptions.topOffsetPercent, chartOptions.bottomOffset, chartOptions.sideOffset);
          data.gridRows = getGridRows(data, chartOptions.topOffsetPercent, chartOptions.bottomOffset, chartOptions.sideOffset);
          return data;
        })
        .withTransition(getStepY, setStepYAndGrid, { ignoreIf: ignoreStepYif })
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
        .map(({ chartData, chartSize }) => {
          const data = { ...chartData, size: chartSize };
          data.config = getChartConfig(data, chartOptions.topOffsetPercent);
          return data;
        })
        .withTransition(getStepY, setStepY, { ignoreIf: ignoreStepYif })
        .withName('chartData');

      navChartData$.subscribe(data => {
        renderChart(canvas, ctx, $tooltipContainer)(data, null, false, chartOptions);
      });
    });

    alphaSwitches$.withInitialEvent(initAlphaValues);
  }
};

window.onload = bootstrap;
