class Observable {
  constructor(name) {
    this.observers = [];
    this.name = name;
  }
  withName(name) {
    this.name = name;
    return this;
  }
  subscribe(fn) {
    this.observers.push(fn);
    return this;
  }
  unsubscribe(fn) {
    this.observers = this.observers.filter(subscriber => subscriber !== fn);
  }
  broadcast(data) {
    this.observers.forEach(subscriber => subscriber(data));
    this.lastValue = data;
  }
  fromEvent(node, eventType) {
    node.addEventListener(eventType, event => this.broadcast(event));
    return this;
  }
  withInitialEvent(event) {
    this.broadcast(event);
    return this;
  }
  map(fn) {
    const child$ = new Observable();
    this.subscribe(data => child$.broadcast(fn(data)));
    return child$;
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
  filter(fn) {
    const child$ = new Observable();
    this.subscribe(data => {
      if (fn(data, this.lastValue)) child$.broadcast(data);
    });
    return child$;
  }
}

module.exports = Observable;
