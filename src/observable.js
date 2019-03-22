class Observable {
  constructor(name, saveLastValue = true) {
    this.observers = [];
    this.name = name;
    this.saveLastValue = saveLastValue;
  }
  broadcast(data) {
    this.observers.forEach(subscriber => subscriber(data, this.lastValue));
    if (this.saveLastValue) this.lastValue = data;
  }
  withName(name) {
    this.name = name;
    return this;
  }
  withOption(name, value) {
    this[name] = value;
    return this;
  }
  subscribe(fn) {
    this.observers.push(fn);
    return this;
  }
  fromEvent(node, eventType) {
    node.addEventListener(eventType, event => this.broadcast(event));
    return this;
  }
  withInitialEvent(event) {
    this.broadcast(event);
    return this;
  }
  map(fn, last = false) {
    const child$ = new Observable();
    if (last) child$.lastValue = fn(this.lastValue);
    this.subscribe(data => child$.broadcast(fn(data, this.lastValue)));
    return child$;
  }
  filter(fn, last = false) {
    const child$ = new Observable();
    this.subscribe(data => {
      if (fn(data, this.lastValue)) child$.broadcast(data);
    });
    if (last && fn(this.lastValue)) child$.lastValue = this.lastValue;
    return child$;
  }
  repeatLast() {
    this.broadcast(this.lastValue);
    return this;
  }
  merge(observables) {
    const child$ = new Observable();
    this.subscribe(data =>
      child$.broadcast({
        [this.name]: data,
        ...observables.reduce((acc, obs$) => {
          acc[obs$.name] = obs$.lastValue;
          return acc;
        }, {}),
      }),
    );
    observables.forEach(observable$ => {
      observable$.subscribe(data =>
        child$.broadcast({
          [this.name]: this.lastValue,
          [observable$.name]: data,
          ...observables
            .filter(obs$ => obs$.name !== observable$.name)
            .reduce((acc, obs$) => {
              acc[obs$.name] = obs$.lastValue;
              return acc;
            }, {}),
        }),
      );
    });
    return child$;
  }
  withTransition(getProp, setProp, { invertEase, ignoreIf = () => false } = {}) {
    const fps = 60;
    const time = 0.2; /* in sec */
    const steps = fps * time;
    const child$ = new Observable();
    child$.lastValue = this.lastValue;
    const onFinish = () => (child$.transition = null);
    const emitTransition = (data, lastValue) => (value, nextRAF, currStep) => {
      const tr = child$.transition;
      tr.value = value;
      tr.nextRAF = nextRAF;
      const baseData = currStep === 1 ? data : child$.lastValue;
      child$.broadcast(setProp(baseData, value, tr.initValue, tr.targetValue, lastValue));
    };

    this.subscribe((data, lastValue) => {
      if (!lastValue || data.dataIndex !== lastValue.dataIndex || ignoreIf(data, lastValue)) return child$.broadcast(data);
      const value = getProp(data);
      const tr = child$.transition;
      if (tr) {
        if (value === tr.targetValue) return child$.broadcast(setProp(data, tr.value, tr.initValue, tr.targetValue, lastValue));
        // Stop current transition. Change transition target and start new transition
        cancelAnimationFrame(tr.nextRAF);
        const diff = value - tr.value;
        const initValue = tr.value;
        child$.transition = { initValue, targetValue: value };
        return transition(1, steps, initValue, diff, onFinish, invertEase)(emitTransition(data, lastValue));
      }

      const prevValue = getProp(lastValue);
      if (value === prevValue) return child$.broadcast(data);
      const diff = value - prevValue;
      const initValue = prevValue;
      child$.transition = { initValue, targetValue: value };
      transition(1, steps, initValue, diff, onFinish, invertEase)(emitTransition(data, lastValue));
    });
    return child$;
  }
}

const easeInQuad = x => x * x;
const easeOutQuad = x => x * (2 - x);
const transition = (currStep, steps, initValue, diff, onFinish, invertEase) => func => {
  const ease = invertEase ? (diff < 0 ? easeOutQuad : easeInQuad) : easeOutQuad;
  if (steps - currStep < 0) return onFinish();
  const nextRAF = requestAnimationFrame(() => transition(currStep + 1, steps, initValue, diff, onFinish, invertEase)(func));
  func(initValue + ease(currStep / steps) * diff, nextRAF, currStep);
};

module.exports = Observable;
