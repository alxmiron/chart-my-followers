const Observable = require('./observable');

module.exports = function getSlider() {
  const rangeSlider = sliderFactory();
  const sliderNode = document.getElementById('navigation-handler');

  rangeSlider.create(sliderNode, {
    start: [60, 85],
    connect: [true, true, true],
    range: { min: 0, max: 100 },
  });

  const slider$ = new Observable();
  sliderNode.sliderApi.on('update', data => slider$.broadcast(data));
  return slider$;
};

function sliderFactory() {
  function isValidFormatter(entry) {
    return typeof entry === 'object' && typeof entry.to === 'function' && typeof entry.from === 'function';
  }

  function isSet(value) {
    return value !== null && value !== undefined;
  }

  function preventDefault(e) {
    e.preventDefault();
  }

  function closest(value, to) {
    return Math.round(value / to) * to;
  }

  function isNumeric(a) {
    return typeof a === 'number' && !isNaN(a) && isFinite(a);
  }

  function limit(a) {
    return Math.max(Math.min(a, 100), 0);
  }

  function asArray(a) {
    return Array.isArray(a) ? a : [a];
  }

  function countDecimals(numStr) {
    numStr = String(numStr);
    const pieces = numStr.split('.');
    return pieces.length > 1 ? pieces[1].length : 0;
  }

  function addClass(el, className) {
    if (el.classList) {
      el.classList.add(className);
    } else {
      el.className += ' ' + className;
    }
  }

  function removeClass(el, className) {
    if (el.classList) {
      el.classList.remove(className);
    } else {
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
  }

  function hasClass(el, className) {
    return el.classList ? el.classList.contains(className) : new RegExp('\\b' + className + '\\b').test(el.className);
  }

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

  function getSupportsTouchActionNone() {
    return window.CSS && CSS.supports && CSS.supports('touch-action', 'none');
  }

  function subRangeRatio(pa, pb) {
    return 100 / (pb - pa);
  }

  function fromPercentage(range, value) {
    return (value * 100) / (range[1] - range[0]);
  }

  function toPercentage(range, value) {
    return fromPercentage(range, range[0] < 0 ? value + Math.abs(range[0]) : value - range[0]);
  }

  function isPercentage(range, value) {
    return (value * (range[1] - range[0])) / 100 + range[0];
  }

  function getJ(value, arr) {
    let j = 1;
    while (value >= arr[j]) {
      j += 1;
    }
    return j;
  }

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

  function getStep(xPct, xSteps, snap, value) {
    if (value === 100) return value;
    const j = getJ(value, xPct);
    const a = xPct[j - 1];
    const b = xPct[j];
    if (snap) {
      if (value - a > (b - a) / 2) return b;
      return a;
    }
    if (!xSteps[j - 1]) return value;
    return xPct[j - 1] + closest(value - xPct[j - 1], xSteps[j - 1]);
  }

  function handleEntryPoint(index, value, that) {
    let percentage;
    if (typeof value === 'number') value = [value];
    if (!Array.isArray(value)) throw new Error("'range' contains invalid value.");
    if (index === 'min') {
      percentage = 0;
    } else if (index === 'max') {
      percentage = 100;
    } else {
      percentage = parseFloat(index);
    }
    if (!isNumeric(percentage) || !isNumeric(value[0])) throw new Error("'range' value isn't numeric.");
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
    this.snap = snap;
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
    const step = this.xNumSteps[0];
    if (step && (value / step) % 1 !== 0) throw new Error("'limit', 'margin' and 'padding' must be divisible by step.");
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
    value = getStep(this.xPct, this.xSteps, this.snap, value);
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
    to: function(value) {
      return value !== undefined && value.toFixed(2);
    },
    from: Number,
  };

  function validateFormat(entry) {
    if (isValidFormatter(entry)) return true;
    throw new Error("'format' requires 'to' and 'from' methods.");
  }

  function testStep(parsed, entry) {
    if (!isNumeric(entry)) throw new Error("'step' is not numeric.");
    parsed.singleStep = entry;
  }

  function testRange(parsed, entry) {
    if (typeof entry !== 'object' || Array.isArray(entry)) throw new Error("'range' is not an object.");
    if (entry.min === undefined || entry.max === undefined) throw new Error("Missing 'min' or 'max' in 'range'.");
    if (entry.min === entry.max) throw new Error("'range' 'min' and 'max' cannot be equal.");
    parsed.spectrum = new Spectrum(entry, parsed.snap, parsed.singleStep);
  }

  function testStart(parsed, entry) {
    entry = asArray(entry);
    if (!Array.isArray(entry) || !entry.length) throw new Error("'start' option is incorrect.");
    parsed.handles = entry.length;
    parsed.start = entry;
  }

  function testSnap(parsed, entry) {
    parsed.snap = entry;
    if (typeof entry !== 'boolean') throw new Error("'snap' option must be a boolean.");
  }

  function testAnimationDuration(parsed, entry) {
    parsed.animationDuration = entry;
    if (typeof entry !== 'number') throw new Error("'animationDuration' option must be a number.");
  }

  function testConnect(parsed, entry) {
    let connect = [false];
    let i;
    if (entry === 'lower') {
      entry = [true, false];
    } else if (entry === 'upper') {
      entry = [false, true];
    }
    if (entry === true || entry === false) {
      for (i = 1; i < parsed.handles; i++) {
        connect.push(entry);
      }
      connect.push(false);
    } else if (!Array.isArray(entry) || !entry.length || entry.length !== parsed.handles + 1) {
      throw new Error("'connect' option doesn't match handle count.");
    } else {
      connect = entry;
    }
    parsed.connect = connect;
  }

  function testOrientation(parsed, entry) {
    switch (entry) {
      case 'horizontal':
        parsed.ort = 0;
        break;
      case 'vertical':
        parsed.ort = 1;
        break;
      default:
        throw new Error("'orientation' option is invalid.");
    }
  }

  function testMargin(parsed, entry) {
    if (!isNumeric(entry)) throw new Error("'margin' option must be numeric.");
    if (entry === 0) return;
    parsed.margin = parsed.spectrum.getMargin(entry);
    if (!parsed.margin) throw new Error("'margin' option is only supported on linear sliders.");
  }

  function testLimit(parsed, entry) {
    if (!isNumeric(entry)) throw new Error("'limit' option must be numeric.");
    parsed.limit = parsed.spectrum.getMargin(entry);
    if (!parsed.limit || parsed.handles < 2) throw new Error("'limit' option is only supported on linear sliders with 2 or more handles.");
  }

  function testDirection(parsed, entry) {
    switch (entry) {
      case 'ltr':
        parsed.dir = 0;
        break;
      case 'rtl':
        parsed.dir = 1;
        break;
      default:
        throw new Error("'direction' option was not recognized.");
    }
  }

  function testBehaviour(parsed, entry) {
    if (typeof entry !== 'string') throw new Error("'behaviour' must be a string containing options.");
    const tap = entry.indexOf('tap') >= 0;
    const drag = entry.indexOf('drag') >= 0;
    const fixed = entry.indexOf('fixed') >= 0;
    const snap = entry.indexOf('snap') >= 0;
    const hover = entry.indexOf('hover') >= 0;
    const unconstrained = entry.indexOf('unconstrained') >= 0;
    if (fixed) {
      if (parsed.handles !== 2) throw new Error("'fixed' behaviour must be used with 2 handles");
      testMargin(parsed, parsed.start[1] - parsed.start[0]);
    }
    if (unconstrained && (parsed.margin || parsed.limit)) throw new Error("'unconstrained' behaviour cannot be used with margin or limit");
    parsed.events = {
      tap: tap || snap,
      drag: drag,
      fixed: fixed,
      snap: snap,
      hover: hover,
      unconstrained: unconstrained,
    };
  }

  function testFormat(parsed, entry) {
    parsed.format = entry;
    validateFormat(entry);
  }

  function testDocumentElement(parsed, entry) {
    parsed.documentElement = entry;
  }

  function testCssPrefix(parsed, entry) {
    parsed.cssPrefix = entry;
  }

  function testCssClasses(parsed, entry) {
    if (typeof entry !== 'object') throw new Error("'cssClasses' must be an object.");
    if (typeof parsed.cssPrefix === 'string') {
      parsed.cssClasses = {};
      for (let key in entry) {
        if (!entry.hasOwnProperty(key)) continue;
        parsed.cssClasses[key] = parsed.cssPrefix + entry[key];
      }
    } else {
      parsed.cssClasses = entry;
    }
  }

  function testOptions(options) {
    const parsed = {
      margin: 0,
      limit: 0,
      padding: 0,
      animationDuration: 300,
      ariaFormat: defaultFormatter,
      format: defaultFormatter,
    };
    const tests = {
      step: { r: false, t: testStep },
      start: { r: true, t: testStart },
      connect: { r: true, t: testConnect },
      direction: { r: true, t: testDirection },
      snap: { r: false, t: testSnap },
      animationDuration: { r: false, t: testAnimationDuration },
      range: { r: true, t: testRange },
      orientation: { r: false, t: testOrientation },
      margin: { r: false, t: testMargin },
      limit: { r: false, t: testLimit },
      behaviour: { r: true, t: testBehaviour },
      format: { r: false, t: testFormat },
      documentElement: { r: false, t: testDocumentElement },
      cssPrefix: { r: true, t: testCssPrefix },
      cssClasses: { r: true, t: testCssClasses },
    };
    const defaults = {
      connect: true,
      direction: 'ltr',
      behaviour: 'drag',
      orientation: 'horizontal',
      cssPrefix: 'slider-',
      cssClasses: {
        target: 'target',
        base: 'base',
        origin: 'origin',
        handle: 'handle',
        handleLower: 'handle-lower',
        handleUpper: 'handle-upper',
        touchArea: 'touch-area',
        horizontal: 'horizontal',
        vertical: 'vertical',
        background: 'background',
        connect: 'connect',
        connects: 'connects',
        ltr: 'ltr',
        rtl: 'rtl',
        draggable: 'draggable',
        drag: 'state-drag',
        tap: 'state-tap',
        active: 'active',
        tooltip: 'tooltip',
        pips: 'pips',
        pipsHorizontal: 'pips-horizontal',
        pipsVertical: 'pips-vertical',
        marker: 'marker',
        markerHorizontal: 'marker-horizontal',
        markerVertical: 'marker-vertical',
        markerNormal: 'marker-normal',
        markerLarge: 'marker-large',
        markerSub: 'marker-sub',
        value: 'value',
        valueHorizontal: 'value-horizontal',
        valueVertical: 'value-vertical',
        valueNormal: 'value-normal',
        valueLarge: 'value-large',
        valueSub: 'value-sub',
      },
    };
    if (options.format && !options.ariaFormat) options.ariaFormat = options.format;
    Object.keys(tests).forEach(function(name) {
      if (!isSet(options[name]) && defaults[name] === undefined) {
        if (tests[name].r) throw new Error("'" + name + "' is required.");
        return true;
      }
      tests[name].t(parsed, !isSet(options[name]) ? defaults[name] : options[name]);
    });
    parsed.pips = options.pips;
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
      handle.setAttribute('aria-orientation', options.ort ? 'vertical' : 'horizontal');
      if (handleNumber === 0) {
        addClass(handle, options.cssClasses.handleLower);
      } else if (handleNumber === options.handles - 1) {
        addClass(handle, options.cssClasses.handleUpper);
      }
      return origin;
    }

    function addConnect(base, add) {
      if (!add) return false;
      return addNodeTo(base, options.cssClasses.connect);
    }

    function addElements(connectOptions, base) {
      const connectBase = addNodeTo(base, options.cssClasses.connects);
      scope_Handles = [];
      scope_Connects = [];
      scope_Connects.push(addConnect(connectBase, connectOptions[0]));
      for (let i = 0; i < options.handles; i++) {
        scope_Handles.push(addOrigin(base, i));
        scope_HandleNumbers[i] = i;
        scope_Connects.push(addConnect(connectBase, connectOptions[i + 1]));
      }
    }

    function addSlider(addTarget) {
      addClass(addTarget, options.cssClasses.target);
      if (options.dir === 0) {
        addClass(addTarget, options.cssClasses.ltr);
      } else {
        addClass(addTarget, options.cssClasses.rtl);
      }
      if (options.ort === 0) {
        addClass(addTarget, options.cssClasses.horizontal);
      } else {
        addClass(addTarget, options.cssClasses.vertical);
      }
      return addNodeTo(addTarget, options.cssClasses.base);
    }

    function isHandleDisabled(handleNumber) {
      const handleOrigin = scope_Handles[handleNumber];
      return handleOrigin.hasAttribute('disabled');
    }

    function baseSize() {
      const rect = scope_Base.getBoundingClientRect();
      const alt = 'offset' + ['Width', 'Height'][options.ort];
      return options.ort === 0 ? rect.width || scope_Base[alt] : rect.height || scope_Base[alt];
    }

    function attachEvent(events, element, callback, data) {
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
    }

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

    function documentLeave(event, data) {
      if (event.type === 'mouseout' && event.target.nodeName === 'HTML' && event.relatedTarget === null) {
        eventEnd(event, data);
      }
    }

    function eventMove(event, data) {
      if (navigator.appVersion.indexOf('MSIE 9') === -1 && event.buttons === 0 && data.buttonsProperty !== 0) {
        return eventEnd(event, data);
      }
      const movement = (options.dir ? -1 : 1) * (event.calcPoint - data.startCalcPoint);
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
          scope_Body.removeEventListener('selectstart', preventDefault);
        }
      }

      data.handleNumbers.forEach(function(handleNumber) {
        fireEvent('change', handleNumber);
        fireEvent('set', handleNumber);
        fireEvent('end', handleNumber);
      });
    }

    function eventStart(event, data) {
      if (data.handleNumbers.some(isHandleDisabled)) return false;
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
        scope_Body.addEventListener('selectstart', preventDefault, false);
      }

      data.handleNumbers.forEach(function(handleNumber) {
        fireEvent('start', handleNumber);
      });
    }

    function bindSliderEvents(behaviour) {
      if (!behaviour.fixed) {
        scope_Handles.forEach(function(handle, index) {
          attachEvent(actions.start, handle.children[0], eventStart, {
            handleNumbers: [index],
          });
        });
      }

      if (behaviour.drag) {
        scope_Connects.forEach(function(connect, index) {
          if (connect === false || index === 0 || index === scope_Connects.length - 1) return;
          const handleBefore = scope_Handles[index - 1];
          const handleAfter = scope_Handles[index];
          const eventHolders = [connect];
          addClass(connect, options.cssClasses.draggable);
          if (behaviour.fixed) {
            eventHolders.push(handleBefore.children[0]);
            eventHolders.push(handleAfter.children[0]);
          }
          eventHolders.forEach(function(eventHolder) {
            attachEvent(actions.start, eventHolder, eventStart, {
              handles: [handleBefore, handleAfter],
              handleNumbers: [index - 1, index],
            });
          });
        });
      }
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

    function removeEvent(namespacedEvent) {
      const event = namespacedEvent && namespacedEvent.split('.')[0];
      const namespace = event && namespacedEvent.substring(event.length);
      Object.keys(scope_Events).forEach(function(bind) {
        const tEvent = bind.split('.')[0];
        const tNamespace = bind.substring(tEvent.length);
        if ((!event || event === tEvent) && (!namespace || namespace === tNamespace)) {
          delete scope_Events[bind];
        }
      });
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

    function transformDirection(a, b) {
      return options.dir ? 100 - a - b : a;
    }

    function updateHandlePosition(handleNumber, to) {
      scope_Locations[handleNumber] = to;
      scope_Values[handleNumber] = scope_Spectrum.fromStepping(to);
      const rule = 'translate(' + inRuleOrder(transformDirection(to, 0) - scope_DirOffset + '%', '0') + ')';
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
      const translateRule = 'translate(' + inRuleOrder(transformDirection(l, connectWidth) + '%', '0') + ')';
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

    function valueReset(fireSetEvent) {
      valueSet(options.start, fireSetEvent);
    }

    function valueSetHandle(handleNumber, value, fireSetEvent) {
      const values = [];
      handleNumber = Number(handleNumber);
      if (!(handleNumber >= 0 && handleNumber < scope_HandleNumbers.length)) {
        throw new Error('invalid handle number, got: ' + handleNumber);
      }
      for (let i = 0; i < scope_HandleNumbers.length; i++) {
        values[i] = null;
      }
      values[handleNumber] = value;
      valueSet(values, fireSetEvent);
    }

    function valueGet() {
      const values = scope_Values.map(options.format.to);
      if (values.length === 1) return values[0];
      return values;
    }

    function destroy() {
      for (let key in options.cssClasses) {
        if (!options.cssClasses.hasOwnProperty(key)) continue;
        removeClass(scope_Target, options.cssClasses[key]);
      }
      while (scope_Target.firstChild) {
        scope_Target.removeChild(scope_Target.firstChild);
      }
      delete scope_Target.sliderApi;
    }

    function updateOptions(optionsToUpdate, fireSetEvent) {
      const v = valueGet();
      const updateAble = ['margin', 'limit', 'padding', 'range', 'snap', 'step', 'format'];
      updateAble.forEach(function(name) {
        if (optionsToUpdate[name] !== undefined) {
          originalOptions[name] = optionsToUpdate[name];
        }
      });
      const newOptions = testOptions(originalOptions);
      updateAble.forEach(function(name) {
        if (optionsToUpdate[name] !== undefined) {
          options[name] = newOptions[name];
        }
      });
      scope_Spectrum = newOptions.spectrum;
      options.margin = newOptions.margin;
      options.limit = newOptions.limit;
      options.padding = newOptions.padding;
      scope_Locations = [];
      valueSet(optionsToUpdate.start || v, fireSetEvent);
    }

    function setupSlider() {
      scope_Base = addSlider(scope_Target);
      addElements(options.connect, scope_Base);
      bindSliderEvents(options.events);
      valueSet(options.start);
    }

    setupSlider();

    scope_Self = {
      destroy: destroy,
      on: bindEvent,
      off: removeEvent,
      get: valueGet,
      set: valueSet,
      setHandle: valueSetHandle,
      reset: valueReset,
      __moveHandles: function(a, b, c) {
        moveHandles(a, b, scope_Locations, c);
      },
      options: originalOptions,
      updateOptions: updateOptions,
      target: scope_Target,
    };
    return scope_Self;
  }

  function initialize(target, originalOptions) {
    if (!target || !target.nodeName) throw new Error('create requires a single element, got: ' + target);
    if (target.sliderApi) throw new Error('Slider was already initialized.');
    const options = testOptions(originalOptions, target);
    const api = scope(target, options, originalOptions);
    target.sliderApi = api;
    return api;
  }

  return { create: initialize };
}
