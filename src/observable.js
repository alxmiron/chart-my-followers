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
  withTransition(getProp, setProp, time = 0.2 /* in sec */) {
    const fps = 60;
    const steps = fps * time;
    const child$ = new Observable();
    const onFinish = () => (child$.transition = null);
    const emitTransition = data => (value, nextRAF, currStep) => {
      child$.transition.value = value;
      child$.transition.nextRAF = nextRAF;
      child$.broadcast(setProp(currStep === 1 ? data : child$.lastValue, value));
    };

    this.subscribe((data, lastValue) => {
      if (!lastValue || data.datasetChanged || Object.keys(lastValue.columns).length === 1) return child$.broadcast(data);
      const value = getProp(data);
      if (child$.transition) {
        if (value === child$.transition.targetValue) return child$.broadcast(setProp(data, child$.transition.value));
        // Stop current transition. Change transition target and start new transition
        cancelAnimationFrame(child$.transition.nextRAF);
        const frameDiff = (value - child$.transition.value) / steps;
        const firstValue = child$.transition.value + frameDiff;
        child$.transition = { value: firstValue, targetValue: value };
        return transition(firstValue, 1, steps, frameDiff, onFinish)(emitTransition(data));
      }

      const prevValue = getProp(lastValue);
      if (value === prevValue) return child$.broadcast(data);
      const frameDiff = (value - prevValue) / steps;
      const firstValue = prevValue + frameDiff;
      child$.transition = { value: firstValue, targetValue: value };
      transition(firstValue, 1, steps, frameDiff, onFinish)(emitTransition(data));
    });
    return child$;
  }
}

const transition = (currValue, currStep, stepsLeft, diff, onFinish) => func => {
  if (stepsLeft <= 0) return onFinish(currValue, currStep);
  const nextRAF = requestAnimationFrame(() => transition(currValue + diff, currStep + 1, stepsLeft - 1, diff, onFinish)(func));
  func(currValue, nextRAF, currStep);
};

module.exports = Observable;
