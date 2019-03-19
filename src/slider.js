const Observable = require('./observable');

module.exports = function getSliderObservable() {
  const rangeSlider = sliderFactory();
  const sliderNode = document.getElementById('navigation-handler');
  rangeSlider.create(sliderNode);
  const slider$ = new Observable('slider');
  sliderNode.sliderApi.on('update', data => slider$.broadcast(data));
  const detectedSlider$ = slider$
    .filter((values, prevValues) => !(prevValues && prevValues.join('-') === values.join('-')), { inheritLastValue: true })
    .map(
      values => ({
        left: parseInt(values[0]) / 1000,
        right: parseInt(values[1]) / 1000,
      }),
      { inheritLastValue: true },
    )
    .withName('slider');
  return detectedSlider$;
};

function sliderFactory() {
  const isSet = value => value !== null && value !== undefined;
  const closest = (value, to) => Math.round(value / to) * to;
  const limit = a => Math.max(Math.min(a, 100), 0);
  const asArray = a => (Array.isArray(a) ? a : [a]);
  const countDecimals = numStr => {
    numStr = String(numStr);
    const pieces = numStr.split('.');
    return pieces.length > 1 ? pieces[1].length : 0;
  };

  const addClass = (el, className) => {
    if (el.classList) {
      el.classList.add(className);
    } else {
      el.className += ' ' + className;
    }
  };
  const removeClass = (el, className) => {
    if (el.classList) {
      el.classList.remove(className);
    } else {
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
  };
  const hasClass = (el, className) => {
    return el.classList ? el.classList.contains(className) : new RegExp('\\b' + className + '\\b').test(el.className);
  };

  function getPageOffset(doc) {
    const supportPageOffset = window.pageXOffset !== undefined;
    const isCSS1Compat = (doc.compatMode || '') === 'CSS1Compat';
    const x = supportPageOffset ? window.pageXOffset : isCSS1Compat ? doc.documentElement.scrollLeft : doc.body.scrollLeft;
    const y = supportPageOffset ? window.pageYOffset : isCSS1Compat ? doc.documentElement.scrollTop : doc.body.scrollTop;
    return { x, y };
  }

  function getActions() {
    return window.navigator.pointerEnabled
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
  }

  function getSupportsPassive() {
    let supportsPassive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        // eslint-disable-next-line
        get: function() {
          supportsPassive = true;
        },
      });
      window.addEventListener('test', null, opts);
    } catch (e) {} // eslint-disable-line
    return supportsPassive;
  }

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

  function toStepping(xVal, xPct, value) {
    if (value >= xVal.slice(-1)[0]) return 100;
    const j = getJ(value, xVal);
    const va = xVal[j - 1];
    const vb = xVal[j];
    const pa = xPct[j - 1];
    const pb = xPct[j];
    return pa + toPercentage([va, vb], value) / subRangeRatio(pa, pb);
  }

  function fromStepping(xVal, xPct, value) {
    if (value >= 100) return xVal.slice(-1)[0];
    const j = getJ(value, xPct);
    const va = xVal[j - 1];
    const vb = xVal[j];
    const pa = xPct[j - 1];
    const pb = xPct[j];
    return isPercentage([va, vb], (value - pa) * subRangeRatio(pa, pb));
  }

  function getStep(xPct, xSteps, value) {
    if (value === 100) return value;
    const j = getJ(value, xPct);
    if (!xSteps[j - 1]) return value;
    return xPct[j - 1] + closest(value - xPct[j - 1], xSteps[j - 1]);
  }

  function handleEntryPoint(index, value, that) {
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
  }

  function handleStepPoint(i, n, that) {
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
  }

  function Spectrum(entry, snap, singleStep) {
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

  Spectrum.prototype.getMargin = function(value) {
    return this.xPct.length === 2 ? fromPercentage(this.xVal, value) : false;
  };

  Spectrum.prototype.toStepping = function(value) {
    value = toStepping(this.xVal, this.xPct, value);
    return value;
  };

  Spectrum.prototype.fromStepping = function(value) {
    return fromStepping(this.xVal, this.xPct, value);
  };

  Spectrum.prototype.getStep = function(value) {
    value = getStep(this.xPct, this.xSteps, value);
    return value;
  };

  Spectrum.prototype.getDefaultStep = function(value, isDown, size) {
    let j = getJ(value, this.xPct);
    if (value === 100 || (isDown && value === this.xPct[j - 1])) j = Math.max(j - 1, 1);
    return (this.xVal[j] - this.xVal[j - 1]) / size;
  };

  Spectrum.prototype.getNearbySteps = function(value) {
    const j = getJ(value, this.xPct);
    return {
      stepBefore: {
        startValue: this.xVal[j - 2],
        step: this.xNumSteps[j - 2],
        highestStep: this.xHighestCompleteStep[j - 2],
      },
      thisStep: {
        startValue: this.xVal[j - 1],
        step: this.xNumSteps[j - 1],
        highestStep: this.xHighestCompleteStep[j - 1],
      },
      stepAfter: {
        startValue: this.xVal[j],
        step: this.xNumSteps[j],
        highestStep: this.xHighestCompleteStep[j],
      },
    };
  };

  Spectrum.prototype.countStepDecimals = function() {
    const stepDecimals = this.xNumSteps.map(countDecimals);
    return Math.max.apply(null, stepDecimals);
  };

  Spectrum.prototype.convert = function(value) {
    return this.getStep(this.toStepping(value));
  };

  const defaultFormatter = {
    to: value => value !== undefined && value.toFixed(2),
    from: Number,
  };

  const testRange = (parsed, entry) => {
    parsed.spectrum = new Spectrum(entry, parsed.snap, parsed.singleStep);
  };
  const testStart = (parsed, entry) => {
    entry = asArray(entry);
    parsed.handles = entry.length;
    parsed.start = entry;
  };
  const testConnect = (parsed, entry) => {
    parsed.connect = entry;
  };
  const testOrientation = parsed => {
    parsed.ort = 0;
  };
  const testMargin = (parsed, entry) => {
    parsed.margin = parsed.spectrum.getMargin(entry);
  };
  const testLimit = (parsed, entry) => {
    parsed.limit = parsed.spectrum.getMargin(entry);
  };
  const testDirection = parsed => {
    parsed.dir = 0;
  };
  const testBehaviour = parsed => {
    parsed.events = { drag: true };
  };
  const testFormat = (parsed, entry) => {
    parsed.format = entry;
  };
  const testCssPrefix = (parsed, entry) => {
    parsed.cssPrefix = entry;
  };

  const testCssClasses = (parsed, entry) => {
    parsed.cssClasses = {};
    for (let key in entry) {
      if (!entry.hasOwnProperty(key)) continue;
      parsed.cssClasses[key] = parsed.cssPrefix + entry[key];
    }
  };

  function testOptions(options = {}) {
    const parsed = {
      margin: 0,
      limit: 0,
      padding: 0,
      format: defaultFormatter,
    };
    const tests = {
      start: { r: true, t: testStart },
      connect: { r: true, t: testConnect },
      direction: { r: true, t: testDirection },
      range: { r: true, t: testRange },
      orientation: { r: false, t: testOrientation },
      margin: { r: false, t: testMargin },
      limit: { r: false, t: testLimit },
      behaviour: { r: true, t: testBehaviour },
      format: { r: false, t: testFormat },
      cssPrefix: { r: true, t: testCssPrefix },
      cssClasses: { r: true, t: testCssClasses },
    };
    const defaults = {
      connect: [true, true, true],
      direction: 'ltr',
      behaviour: 'drag',
      orientation: 'horizontal',
      cssPrefix: 'slider-',
      margin: 100,
      range: { min: 0, max: 1000 },
      start: [600, 850],
      cssClasses: {
        target: 'target',
        base: 'base',
        origin: 'origin',
        handle: 'handle',
        handleLower: 'handle-lower',
        handleUpper: 'handle-upper',
        touchArea: 'touch-area',
        horizontal: 'horizontal',
        background: 'background',
        connect: 'connect',
        connects: 'connects',
        ltr: 'ltr',
        rtl: 'rtl',
        draggable: 'draggable',
        drag: 'state-drag',
        tap: 'state-tap',
        active: 'active',
      },
    };
    Object.keys(tests).forEach(function(name) {
      if (!isSet(options[name]) && defaults[name] === undefined) {
        if (tests[name].r) throw new Error("'" + name + "' is required.");
        return true;
      }
      tests[name].t(parsed, !isSet(options[name]) ? defaults[name] : options[name]);
    });
    const d = document.createElement('div');
    const msPrefix = d.style.msTransform !== undefined;
    const noPrefix = d.style.transform !== undefined;
    parsed.transformRule = noPrefix ? 'transform' : msPrefix ? 'msTransform' : 'webkitTransform';
    const styles = [['left', 'top'], ['right', 'bottom']];
    parsed.style = styles[parsed.dir][parsed.ort];
    return parsed;
  }

  function scope(target, options, originalOptions) {
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
    let scope_DirOffset = scope_Document.dir === 'rtl' || options.ort === 1 ? 0 : 100;

    function addNodeTo(addTarget, className) {
      const div = scope_Document.createElement('div');
      if (className) addClass(div, className);
      addTarget.appendChild(div);
      return div;
    }

    function addOrigin(base, handleNumber) {
      const origin = addNodeTo(base, options.cssClasses.origin);
      const handle = addNodeTo(origin, options.cssClasses.handle);
      addNodeTo(handle, options.cssClasses.touchArea);
      handle.setAttribute('data-handle', handleNumber);
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-orientation', 'horizontal');
      if (handleNumber === 0) {
        addClass(handle, options.cssClasses.handleLower);
      } else if (handleNumber === options.handles - 1) {
        addClass(handle, options.cssClasses.handleUpper);
      }
      return origin;
    }

    const addConnect = (base, add) => (add ? addNodeTo(base, options.cssClasses.connect) : false);

    const addElements = (connectOptions, base) => {
      const connectBase = addNodeTo(base, options.cssClasses.connects);
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
      addClass(addTarget, options.cssClasses.target);
      addClass(addTarget, options.cssClasses.ltr);
      addClass(addTarget, options.cssClasses.horizontal);
      return addNodeTo(addTarget, options.cssClasses.base);
    };

    const baseSize = () => {
      const rect = scope_Base.getBoundingClientRect();
      const alt = 'offsetWidth';
      return rect.width || scope_Base[alt];
    };

    const attachEvent = (events, element, callback, data) => {
      const method = function(e) {
        e = fixEvent(e, data.pageOffset, data.target || element);
        if (!e) return false;
        if (hasClass(scope_Target, options.cssClasses.tap) && !data.doNotReject) return false;
        if (events === actions.start && e.buttons !== undefined && e.buttons > 1) return false;
        if (data.hover && e.buttons) return false;
        if (!supportsPassive) e.preventDefault();
        e.calcPoint = e.points[options.ort];
        callback(e, data);
      };
      const methods = [];
      events.split(' ').forEach(function(eventName) {
        element.addEventListener(eventName, method, supportsPassive ? { passive: true } : false);
        methods.push([eventName, method]);
      });
      return methods;
    };

    function fixEvent(e, pageOffset, eventTarget) {
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
    }

    const documentLeave = (event, data) => {
      if (event.type === 'mouseout' && event.target.nodeName === 'HTML' && event.relatedTarget === null) eventEnd(event, data);
    };

    function eventMove(event, data) {
      if (navigator.appVersion.indexOf('MSIE 9') === -1 && event.buttons === 0 && data.buttonsProperty !== 0) {
        return eventEnd(event, data);
      }
      const movement = event.calcPoint - data.startCalcPoint;
      const proposal = (movement * 100) / data.baseSize;
      moveHandles(movement > 0, proposal, data.locations, data.handleNumbers);
    }

    function eventEnd(event, data) {
      if (data.handle) {
        removeClass(data.handle, options.cssClasses.active);
        scope_ActiveHandlesCount -= 1;
      }

      data.listeners.forEach(function(c) {
        scope_DocumentElement.removeEventListener(c[0], c[1]);
      });

      if (scope_ActiveHandlesCount === 0) {
        removeClass(scope_Target, options.cssClasses.drag);
        setZindex();
        if (event.cursor) {
          scope_Body.style.cursor = '';
          scope_Body.removeEventListener('selectstart', e => e.preventDefault());
        }
      }

      data.handleNumbers.forEach(function(handleNumber) {
        fireEvent('change', handleNumber);
        fireEvent('set', handleNumber);
        fireEvent('end', handleNumber);
      });
    }

    function eventStart(event, data) {
      let handle;
      if (data.handleNumbers.length === 1) {
        const handleOrigin = scope_Handles[data.handleNumbers[0]];
        handle = handleOrigin.children[0];
        scope_ActiveHandlesCount += 1;
        addClass(handle, options.cssClasses.active);
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
        if (scope_Handles.length > 1) addClass(scope_Target, options.cssClasses.drag);
        scope_Body.addEventListener('selectstart', e => e.preventDefault(), false);
      }

      data.handleNumbers.forEach(function(handleNumber) {
        fireEvent('start', handleNumber);
      });
    }

    function bindSliderEvents() {
      scope_Handles.forEach(function(handle, index) {
        attachEvent(actions.start, handle.children[0], eventStart, {
          handleNumbers: [index],
        });
      });

      scope_Connects.forEach(function(connect, index) {
        if (connect === false || index === 0 || index === scope_Connects.length - 1) return;
        const handleBefore = scope_Handles[index - 1];
        const handleAfter = scope_Handles[index];
        const eventHolders = [connect];
        addClass(connect, options.cssClasses.draggable);
        eventHolders.forEach(function(eventHolder) {
          attachEvent(actions.start, eventHolder, eventStart, {
            handles: [handleBefore, handleAfter],
            handleNumbers: [index - 1, index],
          });
        });
      });
    }

    function bindEvent(namespacedEvent, callback) {
      scope_Events[namespacedEvent] = scope_Events[namespacedEvent] || [];
      scope_Events[namespacedEvent].push(callback);
      if (namespacedEvent.split('.')[0] === 'update') {
        scope_Handles.forEach(function(a, index) {
          fireEvent('update', index);
        });
      }
    }

    function fireEvent(eventName, handleNumber, tap) {
      Object.keys(scope_Events).forEach(function(targetEvent) {
        const eventType = targetEvent.split('.')[0];
        if (eventName === eventType) {
          scope_Events[targetEvent].forEach(function(callback) {
            callback.call(scope_Self, scope_Values.map(options.format.to), handleNumber, scope_Values.slice(), tap || false, scope_Locations.slice());
          });
        }
      });
    }

    function checkHandlePosition(reference, handleNumber, to, lookBackward, lookForward, getValue) {
      if (scope_Handles.length > 1 && !options.events.unconstrained) {
        if (lookBackward && handleNumber > 0) {
          to = Math.max(to, reference[handleNumber - 1] + options.margin);
        }
        if (lookForward && handleNumber < scope_Handles.length - 1) {
          to = Math.min(to, reference[handleNumber + 1] - options.margin);
        }
      }

      if (scope_Handles.length > 1 && options.limit) {
        if (lookBackward && handleNumber > 0) {
          to = Math.min(to, reference[handleNumber - 1] + options.limit);
        }

        if (lookForward && handleNumber < scope_Handles.length - 1) {
          to = Math.max(to, reference[handleNumber + 1] - options.limit);
        }
      }

      if (options.padding) {
        if (handleNumber === 0) to = Math.max(to, options.padding[0]);
        if (handleNumber === scope_Handles.length - 1) to = Math.min(to, 100 - options.padding[1]);
      }
      to = scope_Spectrum.getStep(to);
      to = limit(to);
      if (to === reference[handleNumber] && !getValue) return false;
      return to;
    }

    function inRuleOrder(v, a) {
      const o = options.ort;
      return (o ? a : v) + ', ' + (o ? v : a);
    }

    function moveHandles(upward, proposal, locations, handleNumbers) {
      const proposals = locations.slice();
      let b = [!upward, upward];
      let f = [upward, !upward];
      handleNumbers = handleNumbers.slice();
      if (upward) handleNumbers.reverse();
      if (handleNumbers.length > 1) {
        handleNumbers.forEach(function(handleNumber, o) {
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
      handleNumbers.forEach(function(handleNumber, o) {
        state = setHandle(handleNumber, locations[handleNumber] + proposal, b[o], f[o]) || state;
      });
      if (state) {
        handleNumbers.forEach(function(handleNumber) {
          fireEvent('update', handleNumber);
          fireEvent('slide', handleNumber);
        });
      }
    }

    function updateHandlePosition(handleNumber, to) {
      scope_Locations[handleNumber] = to;
      scope_Values[handleNumber] = scope_Spectrum.fromStepping(to);
      const rule = 'translate(' + inRuleOrder(to - scope_DirOffset + '%', '0') + ')';
      scope_Handles[handleNumber].style[options.transformRule] = rule;
      updateConnect(handleNumber);
      updateConnect(handleNumber + 1);
    }

    function setZindex() {
      scope_HandleNumbers.forEach(function(handleNumber) {
        const dir = scope_Locations[handleNumber] > 50 ? -1 : 1;
        const zIndex = 3 + (scope_Handles.length + dir * handleNumber);
        scope_Handles[handleNumber].style.zIndex = zIndex;
      });
    }

    function setHandle(handleNumber, to, lookBackward, lookForward) {
      to = checkHandlePosition(scope_Locations, handleNumber, to, lookBackward, lookForward, false);
      if (to === false) return false;
      updateHandlePosition(handleNumber, to);
      return true;
    }

    function updateConnect(index) {
      if (!scope_Connects[index]) return;
      let l = 0;
      let h = 100;
      if (index !== 0) l = scope_Locations[index - 1];
      if (index !== scope_Connects.length - 1) h = scope_Locations[index];
      const connectWidth = h - l;
      const translateRule = 'translate(' + inRuleOrder(l + '%', '0') + ')';
      const scaleRule = 'scale(' + inRuleOrder(connectWidth / 100, '1') + ')';
      scope_Connects[index].style[options.transformRule] = translateRule + ' ' + scaleRule;
    }

    function resolveToValue(to, handleNumber) {
      if (to === null || to === false || to === undefined) return scope_Locations[handleNumber];
      if (typeof to === 'number') to = String(to);
      to = options.format.from(to);
      to = scope_Spectrum.toStepping(to);
      if (to === false || isNaN(to)) return scope_Locations[handleNumber];
      return to;
    }

    function valueSet(input, fireSetEvent) {
      const values = asArray(input);
      fireSetEvent = fireSetEvent === undefined ? true : !!fireSetEvent;
      scope_HandleNumbers.forEach(function(handleNumber) {
        setHandle(handleNumber, resolveToValue(values[handleNumber], handleNumber), true, false);
      });
      scope_HandleNumbers.forEach(function(handleNumber) {
        setHandle(handleNumber, scope_Locations[handleNumber], true, true);
      });
      setZindex();
      scope_HandleNumbers.forEach(function(handleNumber) {
        fireEvent('update', handleNumber);
        if (values[handleNumber] !== null && fireSetEvent) {
          fireEvent('set', handleNumber);
        }
      });
    }

    function valueSetHandle(handleNumber, value, fireSetEvent) {
      const values = [];
      handleNumber = Number(handleNumber);
      for (let i = 0; i < scope_HandleNumbers.length; i++) values[i] = null;
      values[handleNumber] = value;
      valueSet(values, fireSetEvent);
    }

    function valueGet() {
      const values = scope_Values.map(options.format.to);
      if (values.length === 1) return values[0];
      return values;
    }

    function setupSlider() {
      scope_Base = addSlider(scope_Target);
      addElements(options.connect, scope_Base);
      bindSliderEvents(options.events);
      valueSet(options.start);
    }

    setupSlider();

    scope_Self = {
      on: bindEvent,
      get: valueGet,
      set: valueSet,
      setHandle: valueSetHandle,
      options: originalOptions,
      target: scope_Target,
    };
    return scope_Self;
  }

  function initialize(target, originalOptions) {
    const options = testOptions(originalOptions, target);
    const api = scope(target, options, originalOptions);
    target.sliderApi = api;
    return api;
  }

  return { create: initialize };
}
