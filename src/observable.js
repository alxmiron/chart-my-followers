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
  extend(createChild) {
    const child$ = new Observable();
    this.subscribe(data => {
      child$.broadcast(data);
    });
  }
  withTransition(time /* in sec */, propName) {
    const fps = 60;
    const child$ = new Observable();
    this.subscribe(data => {
      if (!this.lastValue) return child$.broadcast(data);
      const value = data[propName];
      const prevValue = this.lastValue[propName];
      if (value === prevValue) return child$.broadcast(data);
      if (child$.inTransition) return console.log('another transition');
      const steps = fps * time;
      const frameDiff = (value - prevValue) / steps;
      child$.inTransition = true;
      const emitTransition = value => child$.broadcast({ ...this.lastValue, [propName]: value }, this.lastValue);
      const onFinish = () => (child$.inTransition = false);
      transition(prevValue, steps, frameDiff, onFinish)(emitTransition);
    });
    return child$;
  }
}

const transition = (currValue, stepsLeft, diff, onFinish) => func => {
  if (stepsLeft <= 0) return onFinish(currValue);
  func(currValue);
  requestAnimationFrame(() => transition(currValue + diff, stepsLeft - 1, diff, onFinish)(func));
};

module.exports = Observable;
