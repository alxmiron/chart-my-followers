const Observable = require('./observable');

exports.f = $container => {
  const sliderNode = $container.querySelector('#navigation-handler');
  sliderFactory()(sliderNode);
  const slider$ = new Observable('slider');
  sliderNode.sliderApi.on('update', data => slider$.broadcast(data));
  const detectedSlider$ = slider$
    .filter((values, prevValues) => !(prevValues && prevValues.join('-') === values.join('-')), true)
    .map(
      (values, prevValues) => ({
        left: parseInt(values[0]) / 1000,
        right: parseInt(values[1]) / 1000,
        leftDrag: prevValues ? prevValues[0] !== values[0] : false,
        rightDrag: prevValues ? prevValues[1] !== values[1] : false,
      }),
      true,
    )
    .withName('slider');
  return detectedSlider$;
};

const sliderFactory = () => {
  const closest = (value, to) => Math.round(value / to) * to;
  const limit = a => Math.max(Math.min(a, 100), 0);
  const asArray = a => (Array.isArray(a) ? a : [a]);
  const addClass = (el, className) => el.classList.add(className);
  const removeClass = (el, className) => el.classList.remove(className);
  const getPageOffset = doc => {
    const supportPageOffset = window.pageXOffset !== undefined;
    const isCSS1Compat = (doc.compatMode || '') === 'CSS1Compat';
    const x = supportPageOffset ? window.pageXOffset : isCSS1Compat ? doc.documentElement.scrollLeft : doc.body.scrollLeft;
    const y = supportPageOffset ? window.pageYOffset : isCSS1Compat ? doc.documentElement.scrollTop : doc.body.scrollTop;
    return { x, y };
  };
  const getActions = () =>
    window.navigator.pointerEnabled
      ? {
          start: 'pointerdown',
          move: 'pointermove',
          end: 'pointerup',
        }
      : window.navigator.msPointerEnabled
      ? {
          start: 'MSPointerDown',
          move: 'MSPointerMove',
          end: 'MSPointerUp',
        }
      : {
          start: 'mousedown touchstart',
          move: 'mousemove touchmove',
          end: 'mouseup touchend',
        };
  const getSupportsPassive = () => {
    let supportsPassive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        // eslint-disable-next-line
        get() {
          supportsPassive = true;
        },
      });
      window.addEventListener('test', null, opts);
    } catch (e) {} // eslint-disable-line
    return supportsPassive;
  };
  const getSupportsTouchActionNone = () => window.CSS && CSS.supports && CSS.supports('touch-action', 'none');
  const subRangeRatio = (pa, pb) => 100 / (pb - pa);
  const fromPercentage = (range, value) => (value * 100) / (range[1] - range[0]);
  const toPercentage = (range, value) => fromPercentage(range, range[0] < 0 ? value + Math.abs(range[0]) : value - range[0]);
  const isPercentage = (range, value) => (value * (range[1] - range[0])) / 100 + range[0];
  const getJ = (value, arr) => {
    let j = 1;
    while (value >= arr[j]) j += 1;
    return j;
  };
  const toStepping = (xVal, xPct, value) => {
    if (value >= xVal.slice(-1)[0]) return 100;
    const j = getJ(value, xVal);
    const va = xVal[j - 1];
    const vb = xVal[j];
    const pa = xPct[j - 1];
    const pb = xPct[j];
    return pa + toPercentage([va, vb], value) / subRangeRatio(pa, pb);
  };
  const fromStepping = (xVal, xPct, value) => {
    if (value >= 100) return xVal.slice(-1)[0];
    const j = getJ(value, xPct);
    const va = xVal[j - 1];
    const vb = xVal[j];
    const pa = xPct[j - 1];
    const pb = xPct[j];
    return isPercentage([va, vb], (value - pa) * subRangeRatio(pa, pb));
  };
  const getStep = (xPct, xSteps, value) => {
    if (value === 100) return value;
    const j = getJ(value, xPct);
    if (!xSteps[j - 1]) return value;
    return xPct[j - 1] + closest(value - xPct[j - 1], xSteps[j - 1]);
  };
  const handleEntryPoint = (index, value, that) => {
    let percentage;
    if (typeof value === 'number') value = [value];
    if (index === 'min') {
      percentage = 0;
    } else if (index === 'max') {
      percentage = 100;
    } else {
      percentage = parseFloat(index);
    }
    that.xPct.push(percentage);
    that.xVal.push(value[0]);
    if (!percentage) {
      if (!isNaN(value[1])) that.xSteps[0] = value[1];
    } else {
      that.xSteps.push(isNaN(value[1]) ? false : value[1]);
    }
    that.xHighestCompleteStep.push(0);
  };
  const handleStepPoint = (i, n, that) => {
    if (!n) return;
    if (that.xVal[i] === that.xVal[i + 1]) {
      that.xSteps[i] = that.xHighestCompleteStep[i] = that.xVal[i];
      return;
    }
    that.xSteps[i] = fromPercentage([that.xVal[i], that.xVal[i + 1]], n) / subRangeRatio(that.xPct[i], that.xPct[i + 1]);
    const totalSteps = (that.xVal[i + 1] - that.xVal[i]) / that.xNumSteps[i];
    const highestStep = Math.ceil(Number(totalSteps.toFixed(3)) - 1);
    const step = that.xVal[i] + that.xNumSteps[i] * highestStep;
    that.xHighestCompleteStep[i] = step;
  };

  class Spectrum {
    constructor(entry, snap, singleStep) {
      this.xPct = [];
      this.xVal = [];
      this.xSteps = [singleStep || false];
      this.xNumSteps = [false];
      this.xHighestCompleteStep = [];
      const ordered = [];
      let index;
      for (index in entry) {
        if (entry.hasOwnProperty(index)) ordered.push([entry[index], index]);
      }
      if (ordered.length && typeof ordered[0][0] === 'object') {
        ordered.sort((a, b) => a[0][0] - b[0][0]);
      } else {
        ordered.sort((a, b) => a[0] - b[0]);
      }
      for (index = 0; index < ordered.length; index++) {
        handleEntryPoint(ordered[index][1], ordered[index][0], this);
      }
      this.xNumSteps = this.xSteps.slice(0);
      for (index = 0; index < this.xNumSteps.length; index++) {
        handleStepPoint(index, this.xNumSteps[index], this);
      }
    }
    getMargin(value) {
      return this.xPct.length === 2 ? fromPercentage(this.xVal, value) : false;
    }
    toStepping(value) {
      value = toStepping(this.xVal, this.xPct, value);
      return value;
    }
    fromStepping(value) {
      return fromStepping(this.xVal, this.xPct, value);
    }
    getStep(value) {
      value = getStep(this.xPct, this.xSteps, value);
      return value;
    }
  }

  const testOptions = () => {
    const defaults = {
      start: [600, 850],
      connect: [true, true, true],
      range: { min: 0, max: 1000 },
      margin: 100,
    };
    const spectrum = new Spectrum(defaults.range);
    const parsed = {
      format: { to: value => value !== undefined && value.toFixed(2), from: Number },
      events: { drag: true },
      dir: 0,
      start: asArray(defaults.start),
      handles: asArray(defaults.start).length,
      connect: defaults.connect,
      spectrum,
      margin: spectrum.getMargin(defaults.margin),
    };
    const d = document.createElement('div');
    const msPrefix = d.style.msTransform !== undefined;
    const noPrefix = d.style.transform !== undefined;
    parsed.transformRule = noPrefix ? 'transform' : msPrefix ? 'msTransform' : 'webkitTransform';
    const styles = [['left', 'top'], ['right', 'bottom']];
    parsed.style = styles[parsed.dir][0];
    return parsed;
  };

  const scope = (target, options, originalOptions) => {
    let actions = getActions();
    let supportsTouchActionNone = getSupportsTouchActionNone();
    let supportsPassive = supportsTouchActionNone && getSupportsPassive();
    let scope_Target = target;
    let scope_Base;
    let scope_Handles;
    let scope_Connects;
    let scope_Spectrum = options.spectrum;
    let scope_Values = [];
    let scope_Locations = [];
    let scope_HandleNumbers = [];
    let scope_ActiveHandlesCount = 0;
    let scope_Events = {};
    let scope_Self;
    let scope_Document = target.ownerDocument;
    let scope_DocumentElement = options.documentElement || scope_Document.documentElement;
    let scope_Body = scope_Document.body;

    const addNodeTo = (addTarget, className) => {
      const div = scope_Document.createElement('div');
      if (className) addClass(div, className);
      addTarget.appendChild(div);
      return div;
    };

    const addOrigin = (base, handleNumber) => {
      const origin = addNodeTo(base, 'slider-origin');
      const handle = addNodeTo(origin, 'slider-handle');
      addNodeTo(handle, 'slider-touch-area');
      handle.setAttribute('data-handle', handleNumber);
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-orientation', 'horizontal');
      if (handleNumber === 0) {
        addClass(handle, 'slider-handle-lower');
      } else if (handleNumber === options.handles - 1) {
        addClass(handle, 'slider-handle-upper');
      }
      return origin;
    };

    const addConnect = (base, add) => (add ? addNodeTo(base, 'slider-connect') : false);

    const addElements = (connectOptions, base) => {
      const connectBase = addNodeTo(base, 'slider-connects');
      scope_Handles = [];
      scope_Connects = [];
      scope_Connects.push(addConnect(connectBase, connectOptions[0]));
      for (let i = 0; i < options.handles; i++) {
        scope_Handles.push(addOrigin(base, i));
        scope_HandleNumbers[i] = i;
        scope_Connects.push(addConnect(connectBase, connectOptions[i + 1]));
      }
    };

    const addSlider = addTarget => {
      addClass(addTarget, 'slider-target');
      addClass(addTarget, 'slider-horizontal');
      return addNodeTo(addTarget, 'slider-base');
    };

    const baseSize = () => {
      const rect = scope_Base.getBoundingClientRect();
      return rect.width || scope_Base['offsetWidth'];
    };

    const attachEvent = (events, element, callback, data) => {
      const method = e => {
        e = fixEvent(e, data.pageOffset, data.target || element);
        if (!e) return false;
        if (events === actions.start && e.buttons !== undefined && e.buttons > 1) return false;
        if (data.hover && e.buttons) return false;
        if (!supportsPassive) e.preventDefault();
        e.calcPoint = e.points[0];
        callback(e, data);
      };
      const methods = [];
      events.split(' ').forEach(eventName => {
        element.addEventListener(eventName, method, supportsPassive ? { passive: true } : false);
        methods.push([eventName, method]);
      });
      return methods;
    };

    const fixEvent = (e, pageOffset, eventTarget) => {
      const touch = e.type.indexOf('touch') === 0;
      const mouse = e.type.indexOf('mouse') === 0;
      let pointer = e.type.indexOf('pointer') === 0;
      let x;
      let y;
      if (e.type.indexOf('MSPointer') === 0) pointer = true;
      if (touch) {
        const isTouchOnTarget = checkTouch => checkTouch.target === eventTarget || eventTarget.contains(checkTouch.target);
        if (e.type === 'touchstart') {
          const targetTouches = Array.prototype.filter.call(e.touches, isTouchOnTarget);
          if (targetTouches.length > 1) return false;
          x = targetTouches[0].pageX;
          y = targetTouches[0].pageY;
        } else {
          const targetTouch = Array.prototype.find.call(e.changedTouches, isTouchOnTarget);
          if (!targetTouch) return false;
          x = targetTouch.pageX;
          y = targetTouch.pageY;
        }
      }
      pageOffset = pageOffset || getPageOffset(scope_Document);
      if (mouse || pointer) {
        x = e.clientX + pageOffset.x;
        y = e.clientY + pageOffset.y;
      }
      e.pageOffset = pageOffset;
      e.points = [x, y];
      e.cursor = mouse || pointer;
      return e;
    };

    const documentLeave = (event, data) => {
      if (event.type === 'mouseout' && event.target.nodeName === 'HTML' && event.relatedTarget === null) eventEnd(event, data);
    };

    const eventMove = (event, data) => {
      if (navigator.appVersion.indexOf('MSIE 9') === -1 && event.buttons === 0 && data.buttonsProperty !== 0) return eventEnd(event, data);
      const movement = event.calcPoint - data.startCalcPoint;
      const proposal = (movement * 100) / data.baseSize;
      moveHandles(movement > 0, proposal, data.locations, data.handleNumbers);
    };

    const eventEnd = (event, data) => {
      if (data.handle) {
        removeClass(data.handle, 'slider-active');
        scope_ActiveHandlesCount -= 1;
      }
      data.listeners.forEach(c => scope_DocumentElement.removeEventListener(c[0], c[1]));
      if (scope_ActiveHandlesCount === 0) {
        removeClass(scope_Target, 'slider-state-drag');
        if (event.cursor) {
          scope_Body.style.cursor = '';
          scope_Body.removeEventListener('selectstart', e => e.preventDefault());
        }
      }
    };

    const eventStart = (event, data) => {
      let handle;
      if (data.handleNumbers.length === 1) {
        const handleOrigin = scope_Handles[data.handleNumbers[0]];
        handle = handleOrigin.children[0];
        scope_ActiveHandlesCount += 1;
        addClass(handle, 'slider-active');
      }
      event.stopPropagation();
      const listeners = [];
      const moveEvent = attachEvent(actions.move, scope_DocumentElement, eventMove, {
        target: event.target,
        handle: handle,
        listeners: listeners,
        startCalcPoint: event.calcPoint,
        baseSize: baseSize(),
        pageOffset: event.pageOffset,
        handleNumbers: data.handleNumbers,
        buttonsProperty: event.buttons,
        locations: scope_Locations.slice(),
      });
      const endEvent = attachEvent(actions.end, scope_DocumentElement, eventEnd, {
        target: event.target,
        handle: handle,
        listeners: listeners,
        doNotReject: true,
        handleNumbers: data.handleNumbers,
      });
      const outEvent = attachEvent('mouseout', scope_DocumentElement, documentLeave, {
        target: event.target,
        handle: handle,
        listeners: listeners,
        doNotReject: true,
        handleNumbers: data.handleNumbers,
      });
      listeners.push.apply(listeners, moveEvent.concat(endEvent, outEvent));
      if (event.cursor) {
        scope_Body.style.cursor = getComputedStyle(event.target).cursor;
        if (scope_Handles.length > 1) addClass(scope_Target, 'slider-state-drag');
        scope_Body.addEventListener('selectstart', e => e.preventDefault(), false);
      }
    };

    const bindSliderEvents = () => {
      scope_Handles.forEach((handle, index) => {
        attachEvent(actions.start, handle.children[0], eventStart, {
          handleNumbers: [index],
        });
      });

      scope_Connects.forEach((connect, index) => {
        if (connect === false || index === 0 || index === scope_Connects.length - 1) return;
        const handleBefore = scope_Handles[index - 1];
        const handleAfter = scope_Handles[index];
        const eventHolders = [connect];
        addClass(connect, 'slider-draggable');
        eventHolders.forEach(eventHolder => {
          attachEvent(actions.start, eventHolder, eventStart, {
            handles: [handleBefore, handleAfter],
            handleNumbers: [index - 1, index],
          });
        });
      });
    };

    const bindEvent = (namespacedEvent, callback) => {
      scope_Events[namespacedEvent] = scope_Events[namespacedEvent] || [];
      scope_Events[namespacedEvent].push(callback);
      if (namespacedEvent.split('.')[0] === 'update') {
        scope_Handles.forEach((a, index) => fireEvent('update', index));
      }
    };

    const fireEvent = (eventName, handleNumber, tap) => {
      Object.keys(scope_Events).forEach(targetEvent => {
        const eventType = targetEvent.split('.')[0];
        if (eventName === eventType) {
          scope_Events[targetEvent].forEach(callback => {
            callback.call(scope_Self, scope_Values.map(options.format.to), handleNumber, scope_Values.slice(), tap || false, scope_Locations.slice());
          });
        }
      });
    };

    const checkHandlePosition = (reference, handleNumber, to, lookBackward, lookForward, getValue) => {
      if (scope_Handles.length > 1 && !options.events.unconstrained) {
        if (lookBackward && handleNumber > 0) to = Math.max(to, reference[handleNumber - 1] + options.margin);
        if (lookForward && handleNumber < scope_Handles.length - 1) to = Math.min(to, reference[handleNumber + 1] - options.margin);
      }
      to = scope_Spectrum.getStep(to);
      to = limit(to);
      if (to === reference[handleNumber] && !getValue) return false;
      return to;
    };

    const inRuleOrder = (v, a) => v + ', ' + a;
    const moveHandles = (upward, proposal, locations, handleNumbers) => {
      const proposals = locations.slice();
      let b = [!upward, upward];
      let f = [upward, !upward];
      handleNumbers = handleNumbers.slice();
      if (upward) handleNumbers.reverse();
      if (handleNumbers.length > 1) {
        handleNumbers.forEach((handleNumber, o) => {
          const to = checkHandlePosition(proposals, handleNumber, proposals[handleNumber] + proposal, b[o], f[o], false);
          if (to === false) {
            proposal = 0;
          } else {
            proposal = to - proposals[handleNumber];
            proposals[handleNumber] = to;
          }
        });
      } else {
        b = f = [true];
      }
      let state = false;
      handleNumbers.forEach((handleNumber, o) => {
        state = setHandle(handleNumber, locations[handleNumber] + proposal, b[o], f[o]) || state;
      });
      if (state) {
        handleNumbers.forEach(handleNumber => {
          fireEvent('update', handleNumber);
          fireEvent('slide', handleNumber);
        });
      }
    };

    const updateHandlePosition = (handleNumber, to) => {
      scope_Locations[handleNumber] = to;
      scope_Values[handleNumber] = scope_Spectrum.fromStepping(to);
      const rule = 'translate(' + inRuleOrder(to - 100 + '%', '0') + ')';
      scope_Handles[handleNumber].style[options.transformRule] = rule;
      updateConnect(handleNumber);
      updateConnect(handleNumber + 1);
    };

    const setHandle = (handleNumber, to, lookBackward, lookForward) => {
      to = checkHandlePosition(scope_Locations, handleNumber, to, lookBackward, lookForward, false);
      if (to === false) return false;
      updateHandlePosition(handleNumber, to);
      return true;
    };

    const updateConnect = index => {
      if (!scope_Connects[index]) return;
      let l = 0;
      let h = 100;
      if (index !== 0) l = scope_Locations[index - 1];
      if (index !== scope_Connects.length - 1) h = scope_Locations[index];
      const connectWidth = h - l;
      const translateRule = 'translate(' + inRuleOrder(l + '%', '0') + ')';
      const scaleRule = 'scale(' + inRuleOrder(connectWidth / 100, '1') + ')';
      scope_Connects[index].style[options.transformRule] = translateRule + ' ' + scaleRule;
    };

    const resolveToValue = (to, handleNumber) => {
      if (to === null || to === false || to === undefined) return scope_Locations[handleNumber];
      if (typeof to === 'number') to = String(to);
      to = options.format.from(to);
      to = scope_Spectrum.toStepping(to);
      if (to === false || isNaN(to)) return scope_Locations[handleNumber];
      return to;
    };

    const valueSet = input => {
      const values = asArray(input);
      scope_HandleNumbers.forEach(handleNumber => setHandle(handleNumber, resolveToValue(values[handleNumber], handleNumber), true, false));
      scope_HandleNumbers.forEach(handleNumber => setHandle(handleNumber, scope_Locations[handleNumber], true, true));
      scope_HandleNumbers.forEach(handleNumber => fireEvent('update', handleNumber));
    };

    scope_Base = addSlider(scope_Target);
    addElements(options.connect, scope_Base);
    bindSliderEvents(options.events);
    valueSet(options.start);
    scope_Self = { on: bindEvent, options: originalOptions, target: scope_Target };
    return scope_Self;
  };

  return (target, originalOptions) => {
    const options = testOptions(originalOptions, target);
    const api = scope(target, options, originalOptions);
    target.sliderApi = api;
    return api;
  };
};
