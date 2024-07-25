var index = '';

var toastify$1 = '';

const sharedConfig = {};
function setHydrateContext(context) {
  sharedConfig.context = context;
}

const equalFn = (a, b) => a === b;
const $PROXY = Symbol("solid-proxy");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let Listener = null;
let Pending = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener,
    owner = Owner,
    root = fn.length === 0 && !false ? UNOWNED : {
      owned: null,
      cleanups: null,
      context: null,
      owner: detachedOwner || owner
    };
  Owner = root;
  Listener = null;
  try {
    return runUpdates(() => fn(() => cleanNode(root)), true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    pending: NOTPENDING,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.pending !== NOTPENDING ? s.pending : s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createComputed(fn, value, options) {
  const c = createComputation(fn, value, true, STALE);
  updateComputation(c);
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : queueMicrotask(() => updateComputation(c));
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.pending = NOTPENDING;
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function createResource(source, fetcher, options) {
  if (arguments.length === 2) {
    if (typeof fetcher === "object") {
      options = fetcher;
      fetcher = source;
      source = true;
    }
  } else if (arguments.length === 1) {
    fetcher = source;
    source = true;
  }
  options || (options = {});
  if (options.globalRefetch !== false) {
    Resources || (Resources = new Set());
    Resources.add(load);
    Owner && onCleanup(() => Resources.delete(load));
  }
  const contexts = new Set(),
    [s, set] = createSignal(options.initialValue),
    [track, trigger] = createSignal(undefined, {
      equals: false
    }),
    [loading, setLoading] = createSignal(false),
    [error, setError] = createSignal();
  let err = undefined,
    pr = null,
    initP = null,
    id = null,
    scheduled = false,
    dynamic = typeof source === "function";
  if (sharedConfig.context) {
    id = `${sharedConfig.context.id}${sharedConfig.context.count++}`;
    if (sharedConfig.load) initP = sharedConfig.load(id);
  }
  function loadEnd(p, v, e, key) {
    if (pr === p) {
      pr = null;
      if (initP && p === initP && options.onHydrated) options.onHydrated(key, {
        value: v
      });
      initP = null;
      setError(err = e);
      completeLoad(v);
    }
    return v;
  }
  function completeLoad(v) {
    batch(() => {
      set(() => v);
      setLoading(false);
      for (const c of contexts.keys()) c.decrement();
      contexts.clear();
    });
  }
  function read() {
    const c = SuspenseContext,
      v = s();
    if (err) throw err;
    if (Listener && !Listener.user && c) {
      createComputed(() => {
        track();
        if (pr) {
          if (c.resolved); else if (!contexts.has(c)) {
            c.increment();
            contexts.add(c);
          }
        }
      });
    }
    return v;
  }
  function load(refetching = true) {
    if (refetching && scheduled) return;
    scheduled = false;
    setError(err = undefined);
    const lookup = dynamic ? source() : source;
    if (lookup == null || lookup === false) {
      loadEnd(pr, untrack(s));
      return;
    }
    const p = initP || untrack(() => fetcher(lookup, {
      value: s(),
      refetching
    }));
    if (typeof p !== "object" || !("then" in p)) {
      loadEnd(pr, p);
      return p;
    }
    pr = p;
    scheduled = true;
    queueMicrotask(() => scheduled = false);
    batch(() => {
      setLoading(true);
      trigger();
    });
    return p.then(v => loadEnd(p, v, undefined, lookup), e => loadEnd(p, e, e));
  }
  Object.defineProperties(read, {
    loading: {
      get() {
        return loading();
      }
    },
    error: {
      get() {
        return error();
      }
    }
  });
  if (dynamic) createComputed(() => load(false)); else load(false);
  return [read, {
    refetch: load,
    mutate: set
  }];
}
let Resources;
function batch(fn) {
  if (Pending) return fn();
  let result;
  const q = Pending = [];
  try {
    result = fn();
  } finally {
    Pending = null;
  }
  runUpdates(() => {
    for (let i = 0; i < q.length; i += 1) {
      const data = q[i];
      if (data.pending !== NOTPENDING) {
        const pending = data.pending;
        data.pending = NOTPENDING;
        writeSignal(data, pending);
      }
    }
  }, false);
  return result;
}
function untrack(fn) {
  let result,
    listener = Listener;
  Listener = null;
  result = fn();
  Listener = listener;
  return result;
}
function on(deps, fn,
  options) {
  const isArray = Array.isArray(deps);
  let prevInput;
  let defer = options && options.defer;
  return prevValue => {
    let input;
    if (isArray) {
      input = Array(deps.length);
      for (let i = 0; i < deps.length; i++) input[i] = deps[i]();
    } else input = deps();
    if (defer) {
      defer = false;
      return undefined;
    }
    const result = untrack(() => fn(input, prevInput, prevValue));
    prevInput = input;
    return result;
  };
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null); else if (Owner.cleanups === null) Owner.cleanups = [fn]; else Owner.cleanups.push(fn);
  return fn;
}
function getListener() {
  return Listener;
}
function createContext(defaultValue) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
}
function useContext(context) {
  let ctx;
  return (ctx = lookup(Owner, context.id)) !== undefined ? ctx : context.defaultValue;
}
function children(fn) {
  const children = createMemo(fn);
  return createMemo(() => resolveChildren(children()));
}
let SuspenseContext;
function readSignal() {
  const runningTransition = Transition;
  if (this.sources && (this.state || runningTransition)) {
    const updates = Updates;
    Updates = null;
    this.state === STALE || runningTransition ? updateComputation(this) : lookUpstream(this);
    Updates = updates;
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  if (Pending) {
    if (node.pending === NOTPENDING) Pending.push(node);
    node.pending = value;
    return value;
  }
  if (node.comparator) {
    if (node.comparator(node.value, value)) return value;
  }
  let TransitionRunning = false;
  node.value = value;
  if (node.observers && node.observers.length) {
    runUpdates(() => {
      for (let i = 0; i < node.observers.length; i += 1) {
        const o = node.observers[i];
        if (TransitionRunning && Transition.disposed.has(o));
        if (TransitionRunning && !o.tState || !TransitionRunning && !o.state) {
          if (o.pure) Updates.push(o); else Effects.push(o);
          if (o.observers) markDownstream(o);
        }
        if (TransitionRunning); else o.state = STALE;
      }
      if (Updates.length > 10e5) {
        Updates = [];
        if (false);
        throw new Error();
      }
    }, false);
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
    listener = Listener,
    time = ExecCount;
  Listener = Owner = node;
  runComputation(node, node.value, time);
  Listener = listener;
  Owner = owner;
}
function runComputation(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.observers && node.observers.length) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null,
    pure
  };
  if (Owner === null); else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c]; else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition;
  if (node.state === 0 || runningTransition) return;
  if (node.state === PENDING || runningTransition) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state || runningTransition) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (node.state === STALE || runningTransition) {
      updateComputation(node);
    } else if (node.state === PENDING || runningTransition) {
      const updates = Updates;
      Updates = null;
      lookUpstream(node, ancestors[0]);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true; else Effects = [];
  ExecCount++;
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    completeUpdates(wait);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  if (Effects.length) batch(() => {
    runEffects(Effects);
    Effects = null;
  }); else {
    Effects = null;
  }
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
    userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e); else queue[userLength++] = e;
  }
  if (sharedConfig.context) setHydrateContext();
  const resume = queue.length;
  for (i = 0; i < userLength; i++) runTop(queue[i]);
  for (i = resume; i < queue.length; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition;
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      if (source.state === STALE || runningTransition) {
        if (source !== ignore) runTop(source);
      } else if (source.state === PENDING || runningTransition) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state || runningTransition) {
      o.state = PENDING;
      if (o.pure) Updates.push(o); else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
  node.context = null;
}
function handleError(err) {
  throw err;
}
function lookup(owner, key) {
  return owner ? owner.context && owner.context[key] !== undefined ? owner.context[key] : lookup(owner.owner, key) : undefined;
}
function resolveChildren(children) {
  if (typeof children === "function" && !children.length) return resolveChildren(children());
  if (Array.isArray(children)) {
    const results = [];
    for (let i = 0; i < children.length; i++) {
      const result = resolveChildren(children[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children;
}
function createProvider(id) {
  return function provider(props) {
    let res;
    createComputed(() => res = untrack(() => {
      Owner.context = {
        [id]: props.value
      };
      return children(() => props.children);
    }));
    return res;
  };
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
    mapped = [],
    disposers = [],
    len = 0,
    indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
      i,
      j;
    return untrack(() => {
      let newLen = newItems.length,
        newIndices,
        newIndicesNext,
        temp,
        tempdisposers,
        tempIndexes,
        start,
        end,
        newEnd,
        item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent$1(Comp, props) {
  return untrack(() => Comp(props));
}
function trueFn() {
  return true;
}
const propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return typeof s === "function" ? s() : s;
}
function mergeProps(...sources) {
  return new Proxy({
    get(property) {
      for (let i = sources.length - 1; i >= 0; i--) {
        const v = resolveSource(sources[i])[property];
        if (v !== undefined) return v;
      }
    },
    has(property) {
      for (let i = sources.length - 1; i >= 0; i--) {
        if (property in resolveSource(sources[i])) return true;
      }
      return false;
    },
    keys() {
      const keys = [];
      for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
      return [...new Set(keys)];
    }
  }, propTraps);
}
function splitProps(props, ...keys) {
  const blocked = new Set(keys.flat());
  const descriptors = Object.getOwnPropertyDescriptors(props);
  const res = keys.map(k => {
    const clone = {};
    for (let i = 0; i < k.length; i++) {
      const key = k[i];
      Object.defineProperty(clone, key, descriptors[key] ? descriptors[key] : {
        get() {
          return props[key];
        },
        set() {
          return true;
        }
      });
    }
    return clone;
  });
  res.push(new Proxy({
    get(property) {
      return blocked.has(property) ? undefined : props[property];
    },
    has(property) {
      return blocked.has(property) ? false : property in props;
    },
    keys() {
      return Object.keys(props).filter(k => !blocked.has(k));
    }
  }, propTraps));
  return res;
}

function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback ? fallback : undefined));
}
function Show(props) {
  let strictEqual = false;
  const condition = createMemo(() => props.when, undefined, {
    equals: (a, b) => strictEqual ? a === b : !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      return (strictEqual = typeof child === "function" && child.length > 0) ? untrack(() => child(c)) : child;
    }
    return props.fallback;
  });
}
function Switch(props) {
  let strictEqual = false;
  const conditions = children(() => props.children),
    evalConditions = createMemo(() => {
      let conds = conditions();
      if (!Array.isArray(conds)) conds = [conds];
      for (let i = 0; i < conds.length; i++) {
        const c = conds[i].when;
        if (c) return [i, c, conds[i]];
      }
      return [-1];
    }, undefined, {
      equals: (a, b) => a[0] === b[0] && (strictEqual ? a[1] === b[1] : !a[1] === !b[1]) && a[2] === b[2]
    });
  return createMemo(() => {
    const [index, when, cond] = evalConditions();
    if (index < 0) return props.fallback;
    const c = cond.children;
    return (strictEqual = typeof c === "function" && c.length > 0) ? untrack(() => c(when)) : c;
  });
}
function Match(props) {
  return props;
}

const booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
const Properties = new Set(["className", "value", "readOnly", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
const ChildProperties = new Set(["innerHTML", "textContent", "innerText", "children"]);
const Aliases = {
  className: "class",
  htmlFor: "for"
};
const PropAliases = {
  class: "className",
  formnovalidate: "formNoValidate",
  ismap: "isMap",
  nomodule: "noModule",
  playsinline: "playsInline",
  readonly: "readOnly"
};
const DelegatedEvents = new Set(["beforeinput", "click", "dblclick", "contextmenu", "focusin", "focusout", "input", "keydown", "keyup", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup", "touchend", "touchmove", "touchstart"]);
const SVGNamespace = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};

function memo(fn, equals) {
  return createMemo(fn, undefined, !equals ? {
    equals
  } : undefined);
}

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert(element, code(), element.firstChild ? null : undefined, init);
  });
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template$1(html, check, isSVG) {
  const t = document.createElement("template");
  t.innerHTML = html;
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name); else node.setAttribute(name, value);
}
function setAttributeNS(node, namespace, name, value) {
  if (value == null) node.removeAttributeNS(namespace, name); else node.setAttributeNS(namespace, name, value);
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    node.addEventListener(name, e => handler[0](handler[1], e));
  } else node.addEventListener(name, handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
    prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style$1(node, value, prev = {}) {
  const nodeStyle = node.style;
  const prevString = typeof prev === "string";
  if (value == null && prevString || typeof value === "string") return nodeStyle.cssText = value;
  prevString && (nodeStyle.cssText = undefined, prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, accessor, isSVG, skipChildren) {
  if (typeof accessor === "function") {
    createRenderEffect(current => spreadExpression(node, accessor(), current, isSVG, skipChildren));
  } else spreadExpression(node, accessor, undefined, isSVG, skipChildren);
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      assignProp(node, prop, null, prevProps[prop], isSVG, skipRef);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren) insertExpression(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef);
  }
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
}
function assignProp(node, prop, value, prev, isSVG, skipRef) {
  let isCE, isProp, isChildProp;
  if (prop === "style") return style$1(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    if (!skipRef) {
      value(node);
    }
  } else if (prop.slice(0, 3) === "on:") {
    node.addEventListener(prop.slice(3), value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    node.addEventListener(prop.slice(10), value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    addEventListener(node, name, value, delegate);
    delegate && delegateEvents([name]);
  } else if ((isChildProp = ChildProperties.has(prop)) || !isSVG && (PropAliases[prop] || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-"))) {
    if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value; else node[PropAliases[prop] || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns) setAttributeNS(node, ns, prop, value); else setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
}
function eventHandler(e) {
  const key = `$$${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done) {
    sharedConfig.done = true;
    document.querySelectorAll("[id^=pl-]").forEach(elem => elem.remove());
  }
  while (node !== null) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler(data, e) : handler(e);
      if (e.cancelBubble) return;
    }
    node = node.host && node.host !== node && node.host instanceof Node ? node.host : node.parentNode;
  }
}
function spreadExpression(node, props, prevProps = {}, isSVG, skipChildren) {
  props || (props = {});
  if (!skipChildren && "children" in props) {
    createRenderEffect(() => prevProps.children = insertExpression(node, props.children, prevProps.children));
  }
  props.ref && props.ref(node);
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  if (sharedConfig.context && !current) current = [...parent.childNodes];
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (sharedConfig.context) return current;
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (sharedConfig.context) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    if (normalizeIncomingArray(array, value, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (sharedConfig.context) {
      for (let i = 0; i < array.length; i++) {
        if (array[i].parentNode) return current = array;
      }
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (Array.isArray(current)) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value instanceof Node) {
    if (sharedConfig.context && value.parentNode) return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else;
  return current;
}
function normalizeIncomingArray(normalized, array, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      t;
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false); else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item) || dynamic;
    } else if ((t = typeof item) === "string") {
      normalized.push(document.createTextNode(item));
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else normalized.push(document.createTextNode(item.toString()));
  }
  return dynamic;
}
function appendNodes(parent, array, marker) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker); else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const $RAW = Symbol("store-raw"),
  $NODE = Symbol("store-node"),
  $NAME = Symbol("store-name");
function wrap$1(value, name) {
  let p = value[$PROXY];
  if (!p) {
    Object.defineProperty(value, $PROXY, {
      value: p = new Proxy(value, proxyTraps$1)
    });
    const keys = Object.keys(value),
      desc = Object.getOwnPropertyDescriptors(value);
    for (let i = 0, l = keys.length; i < l; i++) {
      const prop = keys[i];
      if (desc[prop].get) {
        const get = desc[prop].get.bind(p);
        Object.defineProperty(value, prop, {
          get
        });
      }
    }
  }
  return p;
}
function isWrappable(obj) {
  return obj != null && typeof obj === "object" && (obj[$PROXY] || !obj.__proto__ || obj.__proto__ === Object.prototype || Array.isArray(obj));
}
function unwrap(item, set = new Set()) {
  let result, unwrapped, v, prop;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item) || set.has(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0); else set.add(item);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item); else set.add(item);
    const keys = Object.keys(item),
      desc = Object.getOwnPropertyDescriptors(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      prop = keys[i];
      if (desc[prop].get) continue;
      v = item[prop];
      if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped;
    }
  }
  return item;
}
function getDataNodes(target) {
  let nodes = target[$NODE];
  if (!nodes) Object.defineProperty(target, $NODE, {
    value: nodes = {}
  });
  return nodes;
}
function proxyDescriptor(target, property) {
  const desc = Reflect.getOwnPropertyDescriptor(target, property);
  if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE || property === $NAME) return desc;
  delete desc.value;
  delete desc.writable;
  desc.get = () => target[$PROXY][property];
  return desc;
}
function ownKeys(target) {
  if (getListener()) {
    const nodes = getDataNodes(target);
    (nodes._ || (nodes._ = createDataNode()))();
  }
  return Reflect.ownKeys(target);
}
function createDataNode() {
  const [s, set] = createSignal(undefined, {
    equals: false,
    internal: true
  });
  s.$ = set;
  return s;
}
const proxyTraps$1 = {
  get(target, property, receiver) {
    if (property === $RAW) return target;
    if (property === $PROXY) return receiver;
    const value = target[property];
    if (property === $NODE || property === "__proto__") return value;
    const wrappable = isWrappable(value);
    if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property))) {
      let nodes, node;
      if (wrappable && (nodes = getDataNodes(value))) {
        node = nodes._ || (nodes._ = createDataNode());
        node();
      }
      nodes = getDataNodes(target);
      node = nodes[property] || (nodes[property] = createDataNode());
      node();
    }
    return wrappable ? wrap$1(value) : value;
  },
  set() {
    return true;
  },
  deleteProperty() {
    return true;
  },
  ownKeys: ownKeys,
  getOwnPropertyDescriptor: proxyDescriptor
};
function setProperty(state, property, value) {
  if (state[property] === value) return;
  const array = Array.isArray(state);
  const len = state.length;
  const isUndefined = value === undefined;
  const notify = array || isUndefined === property in state;
  if (isUndefined) {
    delete state[property];
  } else state[property] = value;
  let nodes = getDataNodes(state),
    node;
  (node = nodes[property]) && node.$();
  if (array && state.length !== len) (node = nodes.length) && node.$();
  notify && (node = nodes._) && node.$();
}
function mergeStoreNode(state, value) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProperty(state, key, value[key]);
  }
}
function updatePath(current, path, traversed = []) {
  let part,
    prev = current;
  if (path.length > 1) {
    part = path.shift();
    const partType = typeof part,
      isArray = Array.isArray(current);
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (path.length > 1) {
      updatePath(current[part], path, [part].concat(traversed));
      return;
    }
    prev = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    value = value(prev, traversed);
    if (value === prev) return;
  }
  if (part === undefined && value == undefined) return;
  value = unwrap(value);
  if (part === undefined || isWrappable(prev) && isWrappable(value) && !Array.isArray(value)) {
    mergeStoreNode(prev, value);
  } else setProperty(current, part, value);
}
function createStore(store, options) {
  const unwrappedStore = unwrap(store || {});
  const wrappedStore = wrap$1(unwrappedStore);
  function setStore(...args) {
    batch(() => updatePath(unwrappedStore, args));
  }
  return [wrappedStore, setStore];
}
const setterTraps = {
  get(target, property) {
    if (property === $RAW) return target;
    const value = target[property];
    return isWrappable(value) ? new Proxy(value, setterTraps) : value;
  },
  set(target, property, value) {
    setProperty(target, property, unwrap(value));
    return true;
  },
  deleteProperty(target, property) {
    setProperty(target, property, undefined);
    return true;
  }
};
function produce(fn) {
  return state => {
    if (isWrappable(state)) fn(new Proxy(state, setterTraps));
    return state;
  };
}

const FormContext = createContext();
function FormProvider(props) {
  const [form, setState] = createStore({
    activeComponent: {
      dataKey: '',
      label: '',
      index: [],
      position: 0
    }
  });
  let store = [form, {
    setActiveComponent(component) {
      setState("activeComponent", component);
    }

  }];
  return createComponent$1(FormContext.Provider, {
    value: store,

    get children() {
      return props.children;
    }

  });
}
function useForm() {
  return useContext(FormContext);
}

const [reference, setReference] = createStore({
  details: [],
  sidebar: []
});
const [referenceMap, setReferenceMap] = createSignal({});
createSignal({});
const [compEnableMap, setCompEnableMap] = createSignal({});
const [compValidMap, setCompValidMap] = createSignal({});
const [compSourceOptionMap, setCompSourceOptionMap] = createSignal({});
const [compVarMap, setCompVarMap] = createSignal({});
const [compSourceQuestionMap, setCompSourceQuestionMap] = createSignal({});
const [referenceHistoryEnable, setReferenceHistoryEnable] = createSignal(false);
const [referenceHistory, setReferenceHistory] = createSignal([]);
const [sidebarHistory, setSidebarHistory] = createSignal([]);
const [referenceEnableFalse, setReferenceEnableFalse] = createSignal([]);

const _tmpl$$S = /*#__PURE__*/template$1(`<div><div class="grid md:grid-cols-12 dark:border-gray-200/[.10] p-2"><div class="font-light text-sm  pb-2.5 px-2 col-start-2 col-end-12 space-y-4 transition-all delay-100"></div></div></div>`),
  _tmpl$2$E = /*#__PURE__*/template$1(`<input type="text" class="w-full
													font-light
													cursor-pointer
													px-4
													py-2.5
													text-sm
													text-gray-700
													bg-blue-50 bg-clip-padding
													dark:bg-gray-300
													border border-solid border-blue-100	
													rounded-full rounded-tl-none
													transition
													ease-in-out
													m-0
													focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none" disabled>`),
  _tmpl$3$C = /*#__PURE__*/template$1(`<div class="grid grid-cols-12 "><div class="col-span-10 mr-2 "></div><div class="col-span-2 -ml-12 space-x-1 flex justify-evenly -z-0"><button class="bg-blue-800 hover:bg-blue-700 text-white text-justify justify-center text-xs w-full py-2 rounded-tl-none rounded-full focus:outline-none group inline-flex items-center">&nbsp;&nbsp;<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button></div></div>`);

const NestedInput = props => {
  const config = props.config;
  const [btnLabel] = createSignal(config.formMode > 1 ? 'VIEW' : 'ENTRY');
  let componentAnswerIndex = createMemo(() => {
    return String(reference.details.findIndex(obj => obj.dataKey === props.component.sourceQuestion));
  });
  let sourceAnswer = createMemo(() => {
    let answer = [];

    if (props.component.sourceQuestion !== '') {
      const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === props.component.sourceQuestion);

      if (reference.details[componentAnswerIndex]) {
        if (typeof reference.details[componentAnswerIndex].answer === 'object') {
          answer = reference.details[componentAnswerIndex].answer == '' ? [] : reference.details[componentAnswerIndex].answer;

          if (reference.details[componentAnswerIndex].type == 21 || reference.details[componentAnswerIndex].type == 22) {
            let tmpAnswer = JSON.parse(JSON.stringify(answer));
            tmpAnswer.splice(0, 1);
            answer = tmpAnswer;
          }
        } else {
          answer = reference.details[componentAnswerIndex].answer == '' ? 0 : reference.details[componentAnswerIndex].answer;
          let dummyArrayAnswer = [];

          for (let i = 1; i <= Number(answer); i++) {
            dummyArrayAnswer.push({
              value: i,
              label: i
            });
          }

          answer = dummyArrayAnswer;
        }
      }
    }

    return answer;
  });

  let handleOnClick = value => {
    props.onUserClick(props.component.dataKey + '#' + value);
  };

  return (() => {
    const _el$ = _tmpl$$S.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild;

    insert(_el$3, createComponent$1(For, {
      get each() {
        return sourceAnswer();
      },

      children: (item, index) => (() => {
        const _el$4 = _tmpl$3$C.cloneNode(true),
          _el$5 = _el$4.firstChild,
          _el$8 = _el$5.nextSibling,
          _el$9 = _el$8.firstChild,
          _el$10 = _el$9.firstChild,
          _el$11 = _el$10.nextSibling;

        _el$4.$$click = e => handleOnClick(item.value);

        insert(_el$5, createComponent$1(Switch, {
          get children() {
            return [createComponent$1(Match, {
              get when() {
                return reference.details[componentAnswerIndex()].type === 28 || reference.details[componentAnswerIndex()].type === 4 && reference.details[componentAnswerIndex()].renderType === 1 || reference.details[componentAnswerIndex()].type === 25;
              },

              get children() {
                const _el$6 = _tmpl$2$E.cloneNode(true);

                createRenderEffect(() => _el$6.value = props.component.label + '  ____ # ' + item.label);

                return _el$6;
              }

            }), createComponent$1(Match, {
              get when() {
                return reference.details[componentAnswerIndex()].type !== 28;
              },

              get children() {
                const _el$7 = _tmpl$2$E.cloneNode(true);

                createRenderEffect(() => _el$7.value = item.label);

                return _el$7;
              }

            })];
          }

        }));

        _el$9.$$click = e => handleOnClick(item.value);

        insert(_el$9, btnLabel, _el$11);

        createRenderEffect(() => setAttribute(_el$9, "id", `nestedButton-${props.component.dataKey}-${index()}`));

        return _el$4;
      })()
    }));

    createRenderEffect(_$p => classList(_el$2, {
      'border-b border-gray-300/[.40]': sourceAnswer().length > 0
    }, _$p));

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$R = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$D = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$B = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$y = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
									text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$v = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.50] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><div class="cursor-pointer"><div class="grid font-light text-sm col-span-2 content-start"></div></div></div></div></div>`),
  _tmpl$6$v = /*#__PURE__*/template$1(`<div class="col-span-11"><input type="text" class="w-full font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding
															border border-solid border-gray-300 rounded transition ease-in-out m-0
															focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
															disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"></div>`),
  _tmpl$7$v = /*#__PURE__*/template$1(`<div class="col-span-11"></div>`),
  _tmpl$8$r = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1"><label class="cursor-pointer text-sm"><input type="radio" class="checked:disabled:bg-gray-500 checked:dark:disabled:bg-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"></label></div></div>`),
  _tmpl$9$f = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$10$d = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$11$6 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const RadioInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let settedValue = props.value ? props.value.length > 0 ? props.value[0].value : props.value : props.value;

  let handleOnChange = (value, label) => {
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));
    updatedAnswer = [];
    updatedAnswer.push({
      value: value,
      label: label
    });
    props.onValueChange(updatedAnswer);
  };

  let handleLabelClick = index => {
    let id = `radio-${props.component.dataKey}-${index}`;
    document.getElementById(id).click();
  };

  let getOptions = createMemo(() => {
    if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
      let newSourceOption = props.component.sourceOption.split('@');
      const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === newSourceOption[0]);

      if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
        return reference.details[componentAnswerIndex].answer;
      }
    }

    return [];
  });
  const [options] = createSignal(props.component.sourceOption !== undefined ? getOptions() : props.component.options);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$v.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild,
      _el$12 = _el$11.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$R.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$D.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$B.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$12, createComponent$1(For, {
      get each() {
        return options();
      },

      children: (item, index) => (() => {
        const _el$17 = _tmpl$8$r.cloneNode(true),
          _el$18 = _el$17.firstChild,
          _el$19 = _el$18.firstChild,
          _el$20 = _el$19.firstChild;

        _el$17.$$click = e => handleLabelClick(index());

        _el$20.addEventListener("change", e => handleOnChange(e.currentTarget.value, item.label));

        insert(_el$17, createComponent$1(Switch, {
          get children() {
            return [createComponent$1(Match, {
              get when() {
                return item.open && settedValue === item.value;
              },

              children: (() => {
                const _el$21 = _tmpl$6$v.cloneNode(true),
                  _el$22 = _el$21.firstChild;

                _el$22.addEventListener("change", e => handleOnChange(item.value, e.currentTarget.value));

                createRenderEffect(_p$ => {
                  const _v$11 = props.value ? props.value.length > 0 ? props.value[0].label : item.label : item.label,
                    _v$12 = props.component.dataKey,
                    _v$13 = props.component.dataKey,
                    _v$14 = disableInput();

                  _v$11 !== _p$._v$11 && (_el$22.value = _p$._v$11 = _v$11);
                  _v$12 !== _p$._v$12 && setAttribute(_el$22, "name", _p$._v$12 = _v$12);
                  _v$13 !== _p$._v$13 && setAttribute(_el$22, "id", _p$._v$13 = _v$13);
                  _v$14 !== _p$._v$14 && (_el$22.disabled = _p$._v$14 = _v$14);
                  return _p$;
                }, {
                  _v$11: undefined,
                  _v$12: undefined,
                  _v$13: undefined,
                  _v$14: undefined
                });

                return _el$21;
              })()
            }), createComponent$1(Match, {
              get when() {
                return !item.open || settedValue !== item.value;
              },

              get children() {
                const _el$23 = _tmpl$7$v.cloneNode(true);

                createRenderEffect(() => _el$23.innerHTML = item.label);

                return _el$23;
              }

            })];
          }

        }), null);

        createRenderEffect(_p$ => {
          const _v$15 = props.component.dataKey + index(),
            _v$16 = settedValue === item.value,
            _v$17 = item.value,
            _v$18 = props.component.dataKey,
            _v$19 = "radio-" + props.component.dataKey + "-" + index(),
            _v$20 = disableInput();

          _v$15 !== _p$._v$15 && setAttribute(_el$19, "for", _p$._v$15 = _v$15);
          _v$16 !== _p$._v$16 && (_el$20.checked = _p$._v$16 = _v$16);
          _v$17 !== _p$._v$17 && (_el$20.value = _p$._v$17 = _v$17);
          _v$18 !== _p$._v$18 && setAttribute(_el$20, "name", _p$._v$18 = _v$18);
          _v$19 !== _p$._v$19 && setAttribute(_el$20, "id", _p$._v$19 = _v$19);
          _v$20 !== _p$._v$20 && (_el$20.disabled = _p$._v$20 = _v$20);
          return _p$;
        }, {
          _v$15: undefined,
          _v$16: undefined,
          _v$17: undefined,
          _v$18: undefined,
          _v$19: undefined,
          _v$20: undefined
        });

        return _el$17;
      })()
    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$24 = _tmpl$11$6.cloneNode(true),
              _el$25 = _el$24.firstChild,
              _el$28 = _el$25.firstChild;

            insert(_el$25, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$9$f.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$10$d.cloneNode(true);
                  }

                })];
              }

            }), _el$28);

            _el$28.innerHTML = item;

            createRenderEffect(_$p => classList(_el$25, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$24;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$4$y.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$14.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$16.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        },
        _v$6 = props.component.cols === 1 || props.component.cols === undefined,
        _v$7 = props.component.cols === 2,
        _v$8 = props.component.cols === 3,
        _v$9 = props.component.cols === 4,
        _v$10 = props.component.cols === 5;

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _p$._v$5 = classList(_el$11, _v$5, _p$._v$5);
      _v$6 !== _p$._v$6 && _el$12.classList.toggle("grid-cols-1", _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && _el$12.classList.toggle("grid-cols-2", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && _el$12.classList.toggle("grid-cols-3", _p$._v$8 = _v$8);
      _v$9 !== _p$._v$9 && _el$12.classList.toggle("grid-cols-4", _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && _el$12.classList.toggle("grid-cols-5", _p$._v$10 = _v$10);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$Q = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$C = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$A = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$x = /*#__PURE__*/template$1(`<input type="text" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder="">`),
  _tmpl$5$u = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$6$u = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""></div></div></div>`),
  _tmpl$7$u = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$8$q = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$9$e = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const TextInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 && config.initialMode == 2 ? true : config.initialMode == 1 && props.component.disableInitial !== undefined ? props.component.disableInitial : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$6$u.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$Q.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$C.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$A.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput === undefined;
      },

      get children() {
        const _el$11 = _tmpl$4$x.cloneNode(true);

        _el$11.addEventListener("change", e => {
          props.onValueChange(e.currentTarget.value);
        });

        createRenderEffect(_p$ => {
          const _v$ = props.value,
            _v$2 = props.component.dataKey,
            _v$3 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$4 = disableInput();

          _v$ !== _p$._v$ && (_el$11.value = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$11, "name", _p$._v$2 = _v$2);
          _p$._v$3 = classList(_el$11, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$11.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$11;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
      },

      get children() {
        const _el$12 = _tmpl$4$x.cloneNode(true);

        _el$12.addEventListener("change", e => {
          props.onValueChange(e.currentTarget.value);
        });

        createRenderEffect(_p$ => {
          const _v$5 = props.value,
            _v$6 = props.component.dataKey,
            _v$7 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$8 = disableInput(),
            _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
            _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

          _v$5 !== _p$._v$5 && (_el$12.value = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && setAttribute(_el$12, "name", _p$._v$6 = _v$6);
          _p$._v$7 = classList(_el$12, _v$7, _p$._v$7);
          _v$8 !== _p$._v$8 && (_el$12.disabled = _p$._v$8 = _v$8);
          _v$9 !== _p$._v$9 && setAttribute(_el$12, "maxlength", _p$._v$9 = _v$9);
          _v$10 !== _p$._v$10 && setAttribute(_el$12, "minlength", _p$._v$10 = _v$10);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined,
          _v$7: undefined,
          _v$8: undefined,
          _v$9: undefined,
          _v$10: undefined
        });

        return _el$12;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$17 = _tmpl$9$e.cloneNode(true),
              _el$18 = _el$17.firstChild,
              _el$21 = _el$18.firstChild;

            insert(_el$18, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$7$u.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$8$q.cloneNode(true);
                  }

                })];
              }

            }), _el$21);

            _el$21.innerHTML = item;

            createRenderEffect(_$p => classList(_el$18, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$17;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$5$u.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$11 = disableClickRemark(),
            _v$12 = props.comments === 0;

          _v$11 !== _p$._v$11 && (_el$14.disabled = _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && _el$16.classList.toggle("hidden", _p$._v$12 = _v$12);
          return _p$;
        }, {
          _v$11: undefined,
          _v$12: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$13 = props.component.label,
        _v$14 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        };
      _v$13 !== _p$._v$13 && (_el$4.innerHTML = _p$._v$13 = _v$13);
      _p$._v$14 = classList(_el$10, _v$14, _p$._v$14);
      return _p$;
    }, {
      _v$13: undefined,
      _v$14: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const createSelect = props => {
  const config = mergeProps({
    multiple: false,
    disabled: false,
    optionToValue: option => option,
    isOptionDisabled: option => false
  }, props);

  const parseValue = value => {
    if (config.multiple && Array.isArray(value)) {
      return value;
    } else if (!config.multiple && !Array.isArray(value)) {
      return value !== null ? [value] : [];
    } else {
      throw new Error(`Incompatible value type for ${config.multiple ? "multple" : "single"} select.`);
    }
  };

  const [_value, _setValue] = createSignal(config.initialValue ? parseValue(config.initialValue) : []);

  const value = () => config.multiple ? _value() : _value()[0] || null;

  const setValue = value => _setValue(parseValue(value));

  const clearValue = () => _setValue([]);

  const hasValue = () => !!(config.multiple ? value().length : value());

  createEffect(on(_value, () => config.onChange?.(value()), {
    defer: true
  }));
  const [inputValue, setInputValue] = createSignal("");

  const clearInputValue = () => setInputValue("");

  createEffect(on(inputValue, inputValue => config.onInput?.(inputValue), {
    defer: true
  }));
  createEffect(on(inputValue, inputValue => {
    if (inputValue && !isOpen()) {
      open();
    }
  }, {
    defer: true
  }));
  const options = typeof config.options === "function" ? createMemo(() => config.options(inputValue()), config.options(inputValue())) : () => config.options;

  const optionsCount = () => options().length;

  const pickOption = option => {
    if (config.isOptionDisabled(option)) return;
    const value = config.optionToValue(option);

    if (config.multiple) {
      setValue([..._value(), value]);
    } else {
      setValue(value);
      hideInput();
    }

    close();
  };

  const [inputIsHidden, setInputIsHidden] = createSignal(false);

  const showInput = () => setInputIsHidden(false);

  const hideInput = () => setInputIsHidden(true);

  const [isOpen, setIsOpen] = createSignal(false);

  const open = () => setIsOpen(true);

  const close = () => setIsOpen(false);

  const toggle = () => setIsOpen(!isOpen());

  const isDisabled = () => config.disabled;

  const [focusedOptionIndex, setFocusedOptionIndex] = createSignal(-1);

  const focusedOption = () => options()[focusedOptionIndex()];

  const isOptionFocused = option => option === focusedOption();

  const focusOption = direction => {
    if (!optionsCount()) setFocusedOptionIndex(-1);
    const max = optionsCount() - 1;
    const delta = direction === "next" ? 1 : -1;
    let index = focusedOptionIndex() + delta;

    if (index > max) {
      index = 0;
    }

    if (index < 0) {
      index = max;
    }

    setFocusedOptionIndex(index);
  };

  const focusPreviousOption = () => focusOption("previous");

  const focusNextOption = () => focusOption("next");

  createEffect(on(options, options => {
    if (isOpen()) setFocusedOptionIndex(Math.min(0, options.length - 1));
  }, {
    defer: true
  }));
  createEffect(on(isDisabled, isDisabled => {
    if (isDisabled && isOpen()) {
      close();
    }
  }));
  createEffect(on(isOpen, isOpen => {
    if (isOpen) {
      if (focusedOptionIndex() === -1) focusNextOption();
      showInput();
    } else {
      if (focusedOptionIndex() > -1) setFocusedOptionIndex(-1);
      clearInputValue();
    }
  }, {
    defer: true
  }));
  createEffect(on(focusedOptionIndex, focusedOptionIndex => {
    if (focusedOptionIndex > -1 && !isOpen()) {
      open();
    }
  }, {
    defer: true
  }));
  const refs = {
    containerRef: null,
    inputRef: null,
    listRef: null
  };

  const containerRef = element => {
    refs.containerRef = element;

    if (!element.getAttribute("tabIndex")) {
      element.tabIndex = -1;
    }

    element.addEventListener("focusin", () => {
      showInput();
    });
    element.addEventListener("focusout", event => {
      const target = event.relatedTarget;

      for (const relatedElement of Object.values(refs)) {
        if (relatedElement?.contains(target)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      close();
    });
    element.addEventListener("pointerdown", event => {
      if (refs.inputRef && event.target !== refs.inputRef) {
        event.preventDefault();
      }
    });
    element.addEventListener("click", event => {
      if (!refs.listRef || !refs.listRef.contains(event.target)) {
        if (refs.inputRef) {
          refs.inputRef.focus();
        }

        toggle();
      }
    });
  };

  const inputRef = element => {
    refs.inputRef = element;

    if (!element.getAttribute("tabIndex")) {
      element.tabIndex = -1;
    }

    createRenderEffect(() => element.value = inputValue());
    element.addEventListener("input", event => {
      setInputValue(event.target.value);
    });
    createRenderEffect(() => {
      element.style.setProperty("opacity", inputIsHidden() ? "0" : "1");
    });
    element.addEventListener("focus", event => {
      if (config.onFocus) {
        config.onFocus(event);
      }
    });
    element.addEventListener("blur", event => {
      if (config.onBlur) {
        config.onBlur(event);
      }
    });
    element.addEventListener("keydown", event => {
      switch (event.key) {
        case "ArrowDown":
          focusNextOption();
          break;

        case "ArrowUp":
          focusPreviousOption();
          break;

        case "Enter":
          if (isOpen() && focusedOption()) {
            pickOption(focusedOption());
            break;
          }

          return;

        case "Escape":
          if (isOpen()) {
            close();
            break;
          }

          return;

        case "Delete":
        case "Backspace":
          if (inputValue()) {
            return;
          }

          if (config.multiple) {
            const currentValue = value();
            setValue([...currentValue.slice(0, -1)]);
          } else {
            clearValue();
          }

          break;

        case " ":
          if (inputValue()) {
            return;
          }

          if (!isOpen()) {
            open();
          } else {
            if (focusedOption()) {
              pickOption(focusedOption());
            }
          }

          break;

        case "Tab":
          if (focusedOption() && isOpen()) {
            pickOption(focusedOption());
            break;
          }

          return;

        default:
          return;
      }

      event.preventDefault();
      event.stopPropagation();
    });
  };

  const listRef = element => {
    refs.listRef = element;

    if (!element.getAttribute("tabIndex")) {
      element.tabIndex = -1;
    }

    element.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
    });
  };

  return {
    get value() {
      return value();
    },

    get hasValue() {
      return hasValue();
    },

    setValue,

    get options() {
      return options();
    },

    get inputValue() {
      return inputValue();
    },

    get isOpen() {
      return isOpen();
    },

    multiple: config.multiple,

    get disabled() {
      return isDisabled();
    },

    pickOption,
    isOptionFocused,
    isOptionDisabled: config.isOptionDisabled,
    containerRef,
    inputRef,
    listRef
  };
};

const _tmpl$$P = /*#__PURE__*/template$1(`<mark></mark>`);

const SCORING = {
  NO_MATCH: 0,
  MATCH: 1,
  WORD_START: 2,
  START: 3
};

const fuzzySearch = (value, target) => {
  let score = SCORING.NO_MATCH;
  let matches = [];

  if (value.length <= target.length) {
    const valueChars = Array.from(value.toLocaleLowerCase());
    const targetChars = Array.from(target.toLocaleLowerCase());
    let delta = SCORING.START;

    outer: for (let valueIndex = 0, targetIndex = 0; valueIndex < valueChars.length; valueIndex++) {
      while (targetIndex < targetChars.length) {
        if (targetChars[targetIndex] === valueChars[valueIndex]) {
          matches[targetIndex] = true;

          if (delta === SCORING.MATCH && targetChars[targetIndex - 1] === " " && targetChars[targetIndex] !== " ") {
            delta = SCORING.WORD_START;
          }

          score += delta;
          delta++;
          targetIndex++;
          continue outer;
        } else {
          delta = SCORING.MATCH;
          targetIndex++;
        }
      } // Didn't exhaust search value.


      score = SCORING.NO_MATCH;
      matches.length = 0;
    }
  }

  return {
    target,
    score,
    matches
  };
};

const fuzzyHighlight = (searchResult, highlighter = match => (() => {
  const _el$ = _tmpl$$P.cloneNode(true);

  insert(_el$, match);

  return _el$;
})()) => {
  const target = searchResult.target;
  const matches = searchResult.matches;
  const separator = "\x00";
  const highlighted = [];
  let open = false;

  for (let index = 0; index < target.length; index++) {
    const char = target[index];
    const matched = matches[index];

    if (!open && matched) {
      highlighted.push(separator);
      open = true;
    } else if (open && !matched) {
      highlighted.push(separator);
      open = false;
    }

    highlighted.push(char);
  }

  if (open) {
    highlighted.push(separator);
    open = false;
  }

  return memo(() => highlighted.join("").split(separator).map((part, index) => index % 2 ? highlighter(part) : part));
};

const fuzzySort = (value, items, key) => {
  const sorted = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const target = key ? item[key] : item;
    const result = fuzzySearch(value, target);

    if (result.score) {
      sorted.push({
        ...result,
        item,
        index
      });
    }
  }

  sorted.sort((a, b) => {
    let delta = b.score - a.score;

    if (delta === 0) {
      delta = a.index - b.index;
    }

    return delta;
  });
  return sorted;
};

const _tmpl$$O = /*#__PURE__*/template$1(`<mark></mark>`);

const createOptions = (values, userConfig) => {
  const config = Object.assign({
    filterable: true,
    disable: () => false
  }, userConfig || {});

  const getLabel = value => config?.key !== undefined ? value[config.key] : value;

  const options = inputValue => {
    const initialValues = typeof values === "function" ? values(inputValue) : values;
    let createdOptions = initialValues.map(value => {
      return {
        label: getLabel(value),
        value: value,
        disabled: config.disable(value)
      };
    });

    if (config.filterable && inputValue) {
      createdOptions = fuzzySort(inputValue, createdOptions, "label").map(result => ({
        ...result.item,
        label: fuzzyHighlight(result)
      }));
    }

    if (config.createable !== undefined) {
      const trimmedValue = inputValue.trim();
      const exists = createdOptions.some(option => areEqualIgnoringCase(inputValue, getLabel(option.value)));

      if (trimmedValue && !exists) {
        let value;

        if (typeof config.createable === "function") {
          value = config.createable(trimmedValue);
        } else {
          value = config.key ? {
            [config.key]: trimmedValue
          } : trimmedValue;
        }

        const option = {
          label: ["Create ", (() => {
            const _el$ = _tmpl$$O.cloneNode(true);

            insert(_el$, () => getLabel(value));

            return _el$;
          })()],
          value,
          disabled: false
        };
        createdOptions = [...createdOptions, option];
      }
    }

    return createdOptions;
  };

  const optionToValue = option => option.value;

  const format = (item, type) => type === "option" ? item.label : getLabel(item);

  const isOptionDisabled = option => option.disabled;

  return {
    options,
    optionToValue,
    isOptionDisabled,
    format
  };
};

const areEqualIgnoringCase = (firstString, secondString) => firstString.localeCompare(secondString, undefined, {
  sensitivity: "base"
}) === 0;

const _tmpl$$N = /*#__PURE__*/template$1(`<div></div>`),
  _tmpl$2$B = /*#__PURE__*/template$1(`<div class="solid-select-control"></div>`),
  _tmpl$3$z = /*#__PURE__*/template$1(`<div class="solid-select-placeholder"></div>`),
  _tmpl$4$w = /*#__PURE__*/template$1(`<div class="solid-select-single-value"></div>`),
  _tmpl$5$t = /*#__PURE__*/template$1(`<div class="solid-select-multi-value"><button type="button" class="solid-select-multi-value-remove">⨯</button></div>`),
  _tmpl$6$t = /*#__PURE__*/template$1(`<input class="solid-select-input" type="text" tabindex="0" autocomplete="off" autocapitalize="none" size="1">`),
  _tmpl$7$t = /*#__PURE__*/template$1(`<div class="solid-select-list"></div>`),
  _tmpl$8$p = /*#__PURE__*/template$1(`<div class="solid-select-option"></div>`);

const Select = props => {
  const [selectProps, local] = splitProps(mergeProps({
    format: (data, type) => data,
    placeholder: "Select...",
    readonly: typeof props.options !== "function"
  }, props), ["options", "optionToValue", "isOptionDisabled", "initialValue", "multiple", "disabled", "onInput", "onChange", "onBlur"]);
  const select = createSelect(selectProps);
  return createComponent$1(Container, {
    get ["class"]() {
      return local.class;
    },

    ref(r$) {
      const _ref$ = select.containerRef;
      typeof _ref$ === "function" ? _ref$(r$) : select.containerRef = r$;
    },

    get disabled() {
      return select.disabled;
    },

    get children() {
      return [createComponent$1(Control, {
        get format() {
          return local.format;
        },

        get placeholder() {
          return local.placeholder;
        },

        get id() {
          return local.id;
        },

        get name() {
          return local.name;
        },

        get autofocus() {
          return local.autofocus;
        },

        get readonly() {
          return local.readonly;
        },

        get disabled() {
          return select.disabled;
        },

        get value() {
          return select.value;
        },

        get hasValue() {
          return select.hasValue;
        },

        get setValue() {
          return select.setValue;
        },

        get inputValue() {
          return select.inputValue;
        },

        get inputRef() {
          return select.inputRef;
        },

        get multiple() {
          return select.multiple;
        }

      }), createComponent$1(List, {
        ref(r$) {
          const _ref$2 = select.listRef;
          typeof _ref$2 === "function" ? _ref$2(r$) : select.listRef = r$;
        },

        get isOpen() {
          return select.isOpen;
        },

        get options() {
          return select.options;
        },

        children: option => createComponent$1(Option, {
          get isDisabled() {
            return select.isOptionDisabled(option);
          },

          get isFocused() {
            return select.isOptionFocused(option);
          },

          get pickOption() {
            return [select.pickOption, option];
          },

          get children() {
            return local.format(option, "option");
          }

        })
      })];
    }

  });
};

const Container = props => {
  return (() => {
    const _el$ = _tmpl$$N.cloneNode(true);

    const _ref$3 = props.ref;
    typeof _ref$3 === "function" ? _ref$3(_el$) : props.ref = _el$;

    insert(_el$, () => props.children);

    createRenderEffect(_p$ => {
      const _v$ = `solid-select-container ${props.class !== undefined ? props.class : ""}`,
        _v$2 = props.disabled;
      _v$ !== _p$._v$ && (_el$.className = _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && setAttribute(_el$, "data-disabled", _p$._v$2 = _v$2);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined
    });

    return _el$;
  })();
};

const Control = props => {
  const removeValue = index => {
    const value = props.value;
    props.setValue([...value.slice(0, index), ...value.slice(index + 1)]);
  };

  return (() => {
    const _el$2 = _tmpl$2$B.cloneNode(true);

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return !props.hasValue && !props.inputValue;
      },

      get children() {
        return createComponent$1(Placeholder, {
          get children() {
            return props.placeholder;
          }

        });
      }

    }), null);

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return props.hasValue && !props.multiple && !props.inputValue;
      },

      get children() {
        return createComponent$1(SingleValue, {
          get children() {
            return props.format(props.value, "value");
          }

        });
      }

    }), null);

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return props.hasValue && props.multiple;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.value;
          },

          children: (value, index) => createComponent$1(MultiValue, {
            onRemove: () => removeValue(index()),

            get children() {
              return props.format(value, "value");
            }

          })
        });
      }

    }), null);

    insert(_el$2, createComponent$1(Input, {
      ref(r$) {
        const _ref$4 = props.inputRef;
        typeof _ref$4 === "function" ? _ref$4(r$) : props.inputRef = r$;
      },

      get id() {
        return props.id;
      },

      get name() {
        return props.name;
      },

      get autofocus() {
        return props.autofocus;
      },

      get disabled() {
        return props.disabled;
      },

      get readonly() {
        return props.readonly;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.multiple,
        _v$4 = props.hasValue,
        _v$5 = props.disabled;
      _v$3 !== _p$._v$3 && setAttribute(_el$2, "data-multiple", _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && setAttribute(_el$2, "data-has-value", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && setAttribute(_el$2, "data-disabled", _p$._v$5 = _v$5);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$2;
  })();
};

const Placeholder = props => {
  return (() => {
    const _el$3 = _tmpl$3$z.cloneNode(true);

    insert(_el$3, () => props.children);

    return _el$3;
  })();
};

const SingleValue = props => {
  return (() => {
    const _el$4 = _tmpl$4$w.cloneNode(true);

    insert(_el$4, () => props.children);

    return _el$4;
  })();
};

const MultiValue = props => {
  return (() => {
    const _el$5 = _tmpl$5$t.cloneNode(true),
      _el$6 = _el$5.firstChild;

    insert(_el$5, () => props.children, _el$6);

    _el$6.addEventListener("click", event => {
      event.stopPropagation();
      props.onRemove();
    });

    return _el$5;
  })();
};

const Input = props => {
  return (() => {
    const _el$7 = _tmpl$6$t.cloneNode(true);

    _el$7.$$keydown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.target.blur();
      }
    };

    const _ref$5 = props.ref;
    typeof _ref$5 === "function" ? _ref$5(_el$7) : props.ref = _el$7;

    createRenderEffect(_p$ => {
      const _v$6 = props.id,
        _v$7 = props.name,
        _v$8 = props.autofocus,
        _v$9 = props.readonly,
        _v$10 = props.disabled;
      _v$6 !== _p$._v$6 && setAttribute(_el$7, "id", _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && setAttribute(_el$7, "name", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && (_el$7.autofocus = _p$._v$8 = _v$8);
      _v$9 !== _p$._v$9 && (_el$7.readOnly = _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && (_el$7.disabled = _p$._v$10 = _v$10);
      return _p$;
    }, {
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$7;
  })();
};

const List = props => {
  return createComponent$1(Show, {
    get when() {
      return props.isOpen;
    },

    get children() {
      const _el$8 = _tmpl$7$t.cloneNode(true);

      const _ref$6 = props.ref;
      typeof _ref$6 === "function" ? _ref$6(_el$8) : props.ref = _el$8;

      insert(_el$8, createComponent$1(For, {
        get each() {
          return props.options;
        },

        fallback: "No options",

        get children() {
          return props.children;
        }

      }));

      return _el$8;
    }

  });
};

const Option = props => {
  return (() => {
    const _el$9 = _tmpl$8$p.cloneNode(true);

    addEventListener(_el$9, "click", props.pickOption, true);

    insert(_el$9, () => props.children);

    createRenderEffect(_p$ => {
      const _v$11 = props.isDisabled,
        _v$12 = props.isFocused;
      _v$11 !== _p$._v$11 && setAttribute(_el$9, "data-disabled", _p$._v$11 = _v$11);
      _v$12 !== _p$._v$12 && setAttribute(_el$9, "data-focused", _p$._v$12 = _v$12);
      return _p$;
    }, {
      _v$11: undefined,
      _v$12: undefined
    });

    return _el$9;
  })();
};

delegateEvents(["keydown", "click"]);

var style = '';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var toastify = { exports: {} };

/*!
 * Toastify js 1.11.2
 * https://github.com/apvarun/toastify-js
 * @license MIT licensed
 *
 * Copyright (C) 2018 Varun A P
 */

(function (module) {
  (function (root, factory) {
    if (module.exports) {
      module.exports = factory();
    } else {
      root.Toastify = factory();
    }
  })(commonjsGlobal, function (global) {
    // Object initialization
    var Toastify = function (options) {
      // Returning a new init object
      return new Toastify.lib.init(options);
    },
      // Library version
      version = "1.11.2";

    // Set the default global options
    Toastify.defaults = {
      oldestFirst: true,
      text: "Toastify is awesome!",
      node: undefined,
      duration: 3000,
      selector: undefined,
      callback: function () {
      },
      destination: undefined,
      newWindow: false,
      close: false,
      gravity: "toastify-top",
      positionLeft: false,
      position: '',
      backgroundColor: '',
      avatar: "",
      className: "",
      stopOnFocus: true,
      onClick: function () {
      },
      offset: { x: 0, y: 0 },
      escapeMarkup: true,
      style: { background: '' }
    };

    // Defining the prototype of the object
    Toastify.lib = Toastify.prototype = {
      toastify: version,

      constructor: Toastify,

      // Initializing the object with required parameters
      init: function (options) {
        // Verifying and validating the input object
        if (!options) {
          options = {};
        }

        // Creating the options object
        this.options = {};

        this.toastElement = null;

        // Validating the options
        this.options.text = options.text || Toastify.defaults.text; // Display message
        this.options.node = options.node || Toastify.defaults.node;  // Display content as node
        this.options.duration = options.duration === 0 ? 0 : options.duration || Toastify.defaults.duration; // Display duration
        this.options.selector = options.selector || Toastify.defaults.selector; // Parent selector
        this.options.callback = options.callback || Toastify.defaults.callback; // Callback after display
        this.options.destination = options.destination || Toastify.defaults.destination; // On-click destination
        this.options.newWindow = options.newWindow || Toastify.defaults.newWindow; // Open destination in new window
        this.options.close = options.close || Toastify.defaults.close; // Show toast close icon
        this.options.gravity = options.gravity === "bottom" ? "toastify-bottom" : Toastify.defaults.gravity; // toast position - top or bottom
        this.options.positionLeft = options.positionLeft || Toastify.defaults.positionLeft; // toast position - left or right
        this.options.position = options.position || Toastify.defaults.position; // toast position - left or right
        this.options.backgroundColor = options.backgroundColor || Toastify.defaults.backgroundColor; // toast background color
        this.options.avatar = options.avatar || Toastify.defaults.avatar; // img element src - url or a path
        this.options.className = options.className || Toastify.defaults.className; // additional class names for the toast
        this.options.stopOnFocus = options.stopOnFocus === undefined ? Toastify.defaults.stopOnFocus : options.stopOnFocus; // stop timeout on focus
        this.options.onClick = options.onClick || Toastify.defaults.onClick; // Callback after click
        this.options.offset = options.offset || Toastify.defaults.offset; // toast offset
        this.options.escapeMarkup = options.escapeMarkup !== undefined ? options.escapeMarkup : Toastify.defaults.escapeMarkup;
        this.options.style = options.style || Toastify.defaults.style;
        if (options.backgroundColor) {
          this.options.style.background = options.backgroundColor;
        }

        // Returning the current object for chaining functions
        return this;
      },

      // Building the DOM element
      buildToast: function () {
        // Validating if the options are defined
        if (!this.options) {
          throw "Toastify is not initialized";
        }

        // Creating the DOM object
        var divElement = document.createElement("div");
        divElement.className = "toastify on " + this.options.className;

        // Positioning toast to left or right or center
        if (!!this.options.position) {
          divElement.className += " toastify-" + this.options.position;
        } else {
          // To be depreciated in further versions
          if (this.options.positionLeft === true) {
            divElement.className += " toastify-left";
            console.warn('Property `positionLeft` will be depreciated in further versions. Please use `position` instead.');
          } else {
            // Default position
            divElement.className += " toastify-right";
          }
        }

        // Assigning gravity of element
        divElement.className += " " + this.options.gravity;

        if (this.options.backgroundColor) {
          // This is being deprecated in favor of using the style HTML DOM property
          console.warn('DEPRECATION NOTICE: "backgroundColor" is being deprecated. Please use the "style.background" property.');
        }

        // Loop through our style object and apply styles to divElement
        for (var property in this.options.style) {
          divElement.style[property] = this.options.style[property];
        }

        // Adding the toast message/node
        if (this.options.node && this.options.node.nodeType === Node.ELEMENT_NODE) {
          // If we have a valid node, we insert it
          divElement.appendChild(this.options.node);
        } else {
          if (this.options.escapeMarkup) {
            divElement.innerText = this.options.text;
          } else {
            divElement.innerHTML = this.options.text;
          }

          if (this.options.avatar !== "") {
            var avatarElement = document.createElement("img");
            avatarElement.src = this.options.avatar;

            avatarElement.className = "toastify-avatar";

            if (this.options.position == "left" || this.options.positionLeft === true) {
              // Adding close icon on the left of content
              divElement.appendChild(avatarElement);
            } else {
              // Adding close icon on the right of content
              divElement.insertAdjacentElement("afterbegin", avatarElement);
            }
          }
        }

        // Adding a close icon to the toast
        if (this.options.close === true) {
          // Create a span for close element
          var closeElement = document.createElement("span");
          closeElement.innerHTML = "&#10006;";

          closeElement.className = "toast-close";

          // Triggering the removal of toast from DOM on close click
          closeElement.addEventListener(
            "click",
            function (event) {
              event.stopPropagation();
              this.removeElement(this.toastElement);
              window.clearTimeout(this.toastElement.timeOutValue);
            }.bind(this)
          );

          //Calculating screen width
          var width = window.innerWidth > 0 ? window.innerWidth : screen.width;

          // Adding the close icon to the toast element
          // Display on the right if screen width is less than or equal to 360px
          if ((this.options.position == "left" || this.options.positionLeft === true) && width > 360) {
            // Adding close icon on the left of content
            divElement.insertAdjacentElement("afterbegin", closeElement);
          } else {
            // Adding close icon on the right of content
            divElement.appendChild(closeElement);
          }
        }

        // Clear timeout while toast is focused
        if (this.options.stopOnFocus && this.options.duration > 0) {
          var self = this;
          // stop countdown
          divElement.addEventListener(
            "mouseover",
            function (event) {
              window.clearTimeout(divElement.timeOutValue);
            }
          );
          // add back the timeout
          divElement.addEventListener(
            "mouseleave",
            function () {
              divElement.timeOutValue = window.setTimeout(
                function () {
                  // Remove the toast from DOM
                  self.removeElement(divElement);
                },
                self.options.duration
              );
            }
          );
        }

        // Adding an on-click destination path
        if (typeof this.options.destination !== "undefined") {
          divElement.addEventListener(
            "click",
            function (event) {
              event.stopPropagation();
              if (this.options.newWindow === true) {
                window.open(this.options.destination, "_blank");
              } else {
                window.location = this.options.destination;
              }
            }.bind(this)
          );
        }

        if (typeof this.options.onClick === "function" && typeof this.options.destination === "undefined") {
          divElement.addEventListener(
            "click",
            function (event) {
              event.stopPropagation();
              this.options.onClick();
            }.bind(this)
          );
        }

        // Adding offset
        if (typeof this.options.offset === "object") {

          var x = getAxisOffsetAValue("x", this.options);
          var y = getAxisOffsetAValue("y", this.options);

          var xOffset = this.options.position == "left" ? x : "-" + x;
          var yOffset = this.options.gravity == "toastify-top" ? y : "-" + y;

          divElement.style.transform = "translate(" + xOffset + "," + yOffset + ")";

        }

        // Returning the generated element
        return divElement;
      },

      // Displaying the toast
      showToast: function () {
        // Creating the DOM object for the toast
        this.toastElement = this.buildToast();

        // Getting the root element to with the toast needs to be added
        var rootElement;
        if (typeof this.options.selector === "string") {
          rootElement = document.getElementById(this.options.selector);
        } else if (this.options.selector instanceof HTMLElement || (typeof ShadowRoot !== 'undefined' && this.options.selector instanceof ShadowRoot)) {
          rootElement = this.options.selector;
        } else {
          rootElement = document.body;
        }

        // Validating if root element is present in DOM
        if (!rootElement) {
          throw "Root element is not defined";
        }

        // Adding the DOM element
        var elementToInsert = Toastify.defaults.oldestFirst ? rootElement.firstChild : rootElement.lastChild;
        rootElement.insertBefore(this.toastElement, elementToInsert);

        // Repositioning the toasts in case multiple toasts are present
        Toastify.reposition();

        if (this.options.duration > 0) {
          this.toastElement.timeOutValue = window.setTimeout(
            function () {
              // Remove the toast from DOM
              this.removeElement(this.toastElement);
            }.bind(this),
            this.options.duration
          ); // Binding `this` for function invocation
        }

        // Supporting function chaining
        return this;
      },

      hideToast: function () {
        if (this.toastElement.timeOutValue) {
          clearTimeout(this.toastElement.timeOutValue);
        }
        this.removeElement(this.toastElement);
      },

      // Removing the element from the DOM
      removeElement: function (toastElement) {
        // Hiding the element
        // toastElement.classList.remove("on");
        toastElement.className = toastElement.className.replace(" on", "");

        // Removing the element from DOM after transition end
        window.setTimeout(
          function () {
            // remove options node if any
            if (this.options.node && this.options.node.parentNode) {
              this.options.node.parentNode.removeChild(this.options.node);
            }

            // Remove the element from the DOM, only when the parent node was not removed before.
            if (toastElement.parentNode) {
              toastElement.parentNode.removeChild(toastElement);
            }

            // Calling the callback function
            this.options.callback.call(toastElement);

            // Repositioning the toasts again
            Toastify.reposition();
          }.bind(this),
          400
        ); // Binding `this` for function invocation
      },
    };

    // Positioning the toasts on the DOM
    Toastify.reposition = function () {

      // Top margins with gravity
      var topLeftOffsetSize = {
        top: 15,
        bottom: 15,
      };
      var topRightOffsetSize = {
        top: 15,
        bottom: 15,
      };
      var offsetSize = {
        top: 15,
        bottom: 15,
      };

      // Get all toast messages on the DOM
      var allToasts = document.getElementsByClassName("toastify");

      var classUsed;

      // Modifying the position of each toast element
      for (var i = 0; i < allToasts.length; i++) {
        // Getting the applied gravity
        if (containsClass(allToasts[i], "toastify-top") === true) {
          classUsed = "toastify-top";
        } else {
          classUsed = "toastify-bottom";
        }

        var height = allToasts[i].offsetHeight;
        classUsed = classUsed.substr(9, classUsed.length - 1);
        // Spacing between toasts
        var offset = 15;

        var width = window.innerWidth > 0 ? window.innerWidth : screen.width;

        // Show toast in center if screen with less than or equal to 360px
        if (width <= 360) {
          // Setting the position
          allToasts[i].style[classUsed] = offsetSize[classUsed] + "px";

          offsetSize[classUsed] += height + offset;
        } else {
          if (containsClass(allToasts[i], "toastify-left") === true) {
            // Setting the position
            allToasts[i].style[classUsed] = topLeftOffsetSize[classUsed] + "px";

            topLeftOffsetSize[classUsed] += height + offset;
          } else {
            // Setting the position
            allToasts[i].style[classUsed] = topRightOffsetSize[classUsed] + "px";

            topRightOffsetSize[classUsed] += height + offset;
          }
        }
      }

      // Supporting function chaining
      return this;
    };

    // Helper function to get offset.
    function getAxisOffsetAValue(axis, options) {

      if (options.offset[axis]) {
        if (isNaN(options.offset[axis])) {
          return options.offset[axis];
        }
        else {
          return options.offset[axis] + 'px';
        }
      }

      return '0px';

    }

    function containsClass(elem, yourClass) {
      if (!elem || typeof yourClass !== "string") {
        return false;
      } else if (
        elem.className &&
        elem.className
          .trim()
          .split(/\s+/gi)
          .indexOf(yourClass) > -1
      ) {
        return true;
      } else {
        return false;
      }
    }

    // Setting up the prototype for the init object
    Toastify.lib.init.prototype = Toastify.lib;

    // Returning the Toastify function to be assigned to the window object/module
    return Toastify;
  });
}(toastify));

var Toastify = toastify.exports;

const [locale, setLocale] = createStore({
  status: 1,
  details: {
    language: [{
      componentAdded: "The component was successfully added!",
      componentDeleted: "The component was successfully deleted!",
      componentEdited: "The component was successfully edited!",
      componentEmpty: "The component can not be empty",
      componentNotAllowed: "Only 1 component is allowed to edit",
      componentRendered: "Related components is rendering, please wait.",
      componentSelected: "This component has already being selected",
      fetchFailed: "Failed to fetch the data.",
      fileInvalidFormat: "Please submit the appropriate format!",
      fileInvalidMaxSize: "The maximum of allowed size is ",
      fileInvalidMinSize: "The minimum of allowed size is ",
      fileUploaded: "File uploaded successfully!",
      locationAcquired: "Location successfully acquired!",
      remarkAdded: "The remark was successfully added!",
      remarkEmpty: "The remark can not be empty!",
      submitEmpty: "Please make sure your submission is fully filled",
      submitInvalid: "Please make sure your submission is valid",
      submitWarning: "The submission you are about to submit still contains a warning",
      summaryAnswer: "Answer",
      summaryBlank: "Blank",
      summaryError: "Error",
      summaryRemark: "Remark",
      uploadCsv: "Upload CSV file",
      uploadImage: "Upload image file",
      validationDate: "Invalid date format",
      validationInclude: "Allowed values are $values",
      validationMax: "The biggest value is",
      validationMaxLength: "The maximum of allowed character is",
      validationMin: "The smallest value is",
      validationMinLength: "The minimum of allowed character is",
      validationRequired: "Required",
      validationStep: "The value must be a multiple of",
      verificationInvalid: "Please provide verification correctly",
      verificationSubmitted: "The data is now being submitted. Thank you!",
      validationUrl: "Invalid URL address, please provide with https://",
      validationEmail: "Invalid email address",
      validationApi: "Invalid input from api response",
      errorSaving: "Something went wrong while saving on component ",
      errorExpression: "Something went wrong while evaluating expression on component ",
      errorEnableExpression: "Something went wrong while evaluating enable on component ",
      errorValidationExpression: "Something went wrong while evaluating validation expression on component "
    }]
  }
});

const [sidebar$1, setSidebar] = createStore({
  details: []
});

const [note, setNote] = createStore({
  status: 1,
  details: {
    dataKey: '',
    notes: []
  }
});

const [preset, setPreset] = createStore({
  status: 1,
  details: {
    description: '',
    dataKey: '',
    predata: []
  }
});

const [remark, setRemark] = createStore({
  status: 1,
  details: {
    dataKey: '',
    notes: []
  }
});

const [response, setResponse] = createStore({
  status: 1,
  details: {
    dataKey: '',
    answers: [],
    summary: [],
    counter: []
  }
});

const [template, setTemplate] = createStore({
  status: 1,
  details: {
    description: '',
    dataKey: '',
    acronym: '',
    title: '',
    version: '',
    components: []
  }
});

const [validation, setValidation] = createStore({
  status: 1,
  details: {
    description: '',
    dataKey: '',
    version: '',
    testFunctions: []
  }
});

const [counter, setCounter] = createStore({
  render: 0,
  validate: 0
});

const [input, setInput] = createStore({
  currentDataKey: ""
});

var ClientMode = /* @__PURE__ */ ((ClientMode2) => {
  ClientMode2[ClientMode2["CAWI"] = 1] = "CAWI";
  ClientMode2[ClientMode2["CAPI"] = 2] = "CAPI";
  ClientMode2[ClientMode2["PAPI"] = 3] = "PAPI";
  return ClientMode2;
})(ClientMode || {});

var dayjs_min = { exports: {} };

(function (module, exports) {
  !function (t, e) { module.exports = e(); }(commonjsGlobal, (function () { var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", f = "month", h = "quarter", c = "year", d = "date", $ = "Invalid Date", l = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_") }, m = function (t, e, n) { var r = String(t); return !r || r.length >= e ? t : "" + Array(e + 1 - r.length).join(n) + t }, g = { s: m, z: function (t) { var e = -t.utcOffset(), n = Math.abs(e), r = Math.floor(n / 60), i = n % 60; return (e <= 0 ? "+" : "-") + m(r, 2, "0") + ":" + m(i, 2, "0") }, m: function t(e, n) { if (e.date() < n.date()) return -t(n, e); var r = 12 * (n.year() - e.year()) + (n.month() - e.month()), i = e.clone().add(r, f), s = n - i < 0, u = e.clone().add(r + (s ? -1 : 1), f); return +(-(r + (n - i) / (s ? i - u : u - i)) || 0) }, a: function (t) { return t < 0 ? Math.ceil(t) || 0 : Math.floor(t) }, p: function (t) { return { M: f, y: c, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: h }[t] || String(t || "").toLowerCase().replace(/s$/, "") }, u: function (t) { return void 0 === t } }, v = "en", D = {}; D[v] = M; var p = function (t) { return t instanceof _ }, S = function t(e, n, r) { var i; if (!e) return v; if ("string" == typeof e) { var s = e.toLowerCase(); D[s] && (i = s), n && (D[s] = n, i = s); var u = e.split("-"); if (!i && u.length > 1) return t(u[0]) } else { var a = e.name; D[a] = e, i = a; } return !r && i && (v = i), i || !r && v }, w = function (t, e) { if (p(t)) return t.clone(); var n = "object" == typeof e ? e : {}; return n.date = t, n.args = arguments, new _(n) }, O = g; O.l = S, O.i = p, O.w = function (t, e) { return w(t, { locale: e.$L, utc: e.$u, x: e.$x, $offset: e.$offset }) }; var _ = function () { function M(t) { this.$L = S(t.locale, null, !0), this.parse(t); } var m = M.prototype; return m.parse = function (t) { this.$d = function (t) { var e = t.date, n = t.utc; if (null === e) return new Date(NaN); if (O.u(e)) return new Date; if (e instanceof Date) return new Date(e); if ("string" == typeof e && !/Z$/i.test(e)) { var r = e.match(l); if (r) { var i = r[2] - 1 || 0, s = (r[7] || "0").substring(0, 3); return n ? new Date(Date.UTC(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s)) : new Date(r[1], i, r[3] || 1, r[4] || 0, r[5] || 0, r[6] || 0, s) } } return new Date(e) }(t), this.$x = t.x || {}, this.init(); }, m.init = function () { var t = this.$d; this.$y = t.getFullYear(), this.$M = t.getMonth(), this.$D = t.getDate(), this.$W = t.getDay(), this.$H = t.getHours(), this.$m = t.getMinutes(), this.$s = t.getSeconds(), this.$ms = t.getMilliseconds(); }, m.$utils = function () { return O }, m.isValid = function () { return !(this.$d.toString() === $) }, m.isSame = function (t, e) { var n = w(t); return this.startOf(e) <= n && n <= this.endOf(e) }, m.isAfter = function (t, e) { return w(t) < this.startOf(e) }, m.isBefore = function (t, e) { return this.endOf(e) < w(t) }, m.$g = function (t, e, n) { return O.u(t) ? this[e] : this.set(n, t) }, m.unix = function () { return Math.floor(this.valueOf() / 1e3) }, m.valueOf = function () { return this.$d.getTime() }, m.startOf = function (t, e) { var n = this, r = !!O.u(e) || e, h = O.p(t), $ = function (t, e) { var i = O.w(n.$u ? Date.UTC(n.$y, e, t) : new Date(n.$y, e, t), n); return r ? i : i.endOf(a) }, l = function (t, e) { return O.w(n.toDate()[t].apply(n.toDate("s"), (r ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e)), n) }, y = this.$W, M = this.$M, m = this.$D, g = "set" + (this.$u ? "UTC" : ""); switch (h) { case c: return r ? $(1, 0) : $(31, 11); case f: return r ? $(1, M) : $(0, M + 1); case o: var v = this.$locale().weekStart || 0, D = (y < v ? y + 7 : y) - v; return $(r ? m - D : m + (6 - D), M); case a: case d: return l(g + "Hours", 0); case u: return l(g + "Minutes", 1); case s: return l(g + "Seconds", 2); case i: return l(g + "Milliseconds", 3); default: return this.clone() } }, m.endOf = function (t) { return this.startOf(t, !1) }, m.$set = function (t, e) { var n, o = O.p(t), h = "set" + (this.$u ? "UTC" : ""), $ = (n = {}, n[a] = h + "Date", n[d] = h + "Date", n[f] = h + "Month", n[c] = h + "FullYear", n[u] = h + "Hours", n[s] = h + "Minutes", n[i] = h + "Seconds", n[r] = h + "Milliseconds", n)[o], l = o === a ? this.$D + (e - this.$W) : e; if (o === f || o === c) { var y = this.clone().set(d, 1); y.$d[$](l), y.init(), this.$d = y.set(d, Math.min(this.$D, y.daysInMonth())).$d; } else $ && this.$d[$](l); return this.init(), this }, m.set = function (t, e) { return this.clone().$set(t, e) }, m.get = function (t) { return this[O.p(t)]() }, m.add = function (r, h) { var d, $ = this; r = Number(r); var l = O.p(h), y = function (t) { var e = w($); return O.w(e.date(e.date() + Math.round(t * r)), $) }; if (l === f) return this.set(f, this.$M + r); if (l === c) return this.set(c, this.$y + r); if (l === a) return y(1); if (l === o) return y(7); var M = (d = {}, d[s] = e, d[u] = n, d[i] = t, d)[l] || 1, m = this.$d.getTime() + r * M; return O.w(m, this) }, m.subtract = function (t, e) { return this.add(-1 * t, e) }, m.format = function (t) { var e = this, n = this.$locale(); if (!this.isValid()) return n.invalidDate || $; var r = t || "YYYY-MM-DDTHH:mm:ssZ", i = O.z(this), s = this.$H, u = this.$m, a = this.$M, o = n.weekdays, f = n.months, h = function (t, n, i, s) { return t && (t[n] || t(e, r)) || i[n].slice(0, s) }, c = function (t) { return O.s(s % 12 || 12, t, "0") }, d = n.meridiem || function (t, e, n) { var r = t < 12 ? "AM" : "PM"; return n ? r.toLowerCase() : r }, l = { YY: String(this.$y).slice(-2), YYYY: this.$y, M: a + 1, MM: O.s(a + 1, 2, "0"), MMM: h(n.monthsShort, a, f, 3), MMMM: h(f, a), D: this.$D, DD: O.s(this.$D, 2, "0"), d: String(this.$W), dd: h(n.weekdaysMin, this.$W, o, 2), ddd: h(n.weekdaysShort, this.$W, o, 3), dddd: o[this.$W], H: String(s), HH: O.s(s, 2, "0"), h: c(1), hh: c(2), a: d(s, u, !0), A: d(s, u, !1), m: String(u), mm: O.s(u, 2, "0"), s: String(this.$s), ss: O.s(this.$s, 2, "0"), SSS: O.s(this.$ms, 3, "0"), Z: i }; return r.replace(y, (function (t, e) { return e || l[t] || i.replace(":", "") })) }, m.utcOffset = function () { return 15 * -Math.round(this.$d.getTimezoneOffset() / 15) }, m.diff = function (r, d, $) { var l, y = O.p(d), M = w(r), m = (M.utcOffset() - this.utcOffset()) * e, g = this - M, v = O.m(this, M); return v = (l = {}, l[c] = v / 12, l[f] = v, l[h] = v / 3, l[o] = (g - m) / 6048e5, l[a] = (g - m) / 864e5, l[u] = g / n, l[s] = g / e, l[i] = g / t, l)[y] || g, $ ? v : O.a(v) }, m.daysInMonth = function () { return this.endOf(f).$D }, m.$locale = function () { return D[this.$L] }, m.locale = function (t, e) { if (!t) return this.$L; var n = this.clone(), r = S(t, e, !0); return r && (n.$L = r), n }, m.clone = function () { return O.w(this.$d, this) }, m.toDate = function () { return new Date(this.valueOf()) }, m.toJSON = function () { return this.isValid() ? this.toISOString() : null }, m.toISOString = function () { return this.$d.toISOString() }, m.toString = function () { return this.$d.toUTCString() }, M }(), T = _.prototype; return w.prototype = T, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", f], ["$y", c], ["$D", d]].forEach((function (t) { T[t[1]] = function (e) { return this.$g(e, t[0], t[1]) }; })), w.extend = function (t, e) { return t.$i || (t(e, _, w), t.$i = !0), w }, w.locale = S, w.isDayjs = p, w.unix = function (t) { return w(1e3 * t) }, w.en = D[v], w.Ls = D, w.p = {}, w }));
}(dayjs_min));

var dayjs = dayjs_min.exports;

const default_eval_enable = true;
const default_eval_validation = true;
var getConfig;
const globalConfig = config => {
  getConfig = config;
};
const getValue = dataKey => {
  let tmpDataKey = dataKey.split('@');
  let splitDataKey = tmpDataKey[0].split('#');
  let splLength = splitDataKey.length;

  switch (tmpDataKey[1]) {
    case '$ROW$':
      {
        dataKey = tmpDataKey[0];
        break;
      }

    case '$ROW1$':
      {
        if (splLength > 2) splitDataKey.length = splLength - 1;
        dataKey = splitDataKey.join('#');
        break;
      }

    case '$ROW2$':
      {
        if (splLength > 3) splitDataKey.length = splLength - 2;
        dataKey = splitDataKey.join('#');
        break;
      }
  }

  const componentIndex = referenceIndexLookup(dataKey);
  let answer = componentIndex !== -1 && reference.details[componentIndex]?.answer && reference.details[componentIndex]?.enable ? reference.details[componentIndex].answer : '';
  return answer;
};
const createComponent = (dataKey, nestedPosition, componentPosition, sidebarPosition, components, parentIndex, parentName) => {
  const eval_enable = (eval_text, dataKey) => {
    try {
      return eval(eval_text);
    } catch (e) {
      console.log(e);
      toastInfo$1(locale.details.language[0].errorEnableExpression + dataKey, 3000, "", "bg-pink-600/80");
      return default_eval_enable;
    }
  };

  let newComp = JSON.parse(JSON.stringify(components));
  newComp.dataKey = newComp.dataKey + '#' + nestedPosition;
  newComp.name = newComp.name + '#' + nestedPosition;
  let tmp_type = newComp.type;
  newComp.answer = tmp_type === 21 || tmp_type === 22 ? [{
    "label": "lastId#0",
    "value": 0
  }] : newComp.answer ? newComp.answer : '';
  newComp.sourceSelect = newComp.sourceSelect !== undefined ? newComp.sourceSelect : [];

  if (newComp.sourceSelect.length > 0) {
    if (newComp.sourceSelect[0].parentCondition.length > 0) {
      newComp.sourceSelect[0].parentCondition.map((item, index) => {
        let editedParentCondition = item.value.split('@');

        if (editedParentCondition[editedParentCondition.length - 1] === '$ROW$' || editedParentCondition[editedParentCondition.length - 1] === '$ROW1$' || editedParentCondition[editedParentCondition.length - 1] === '$ROW2$') {
          item.value = editedParentCondition[0] + '#' + nestedPosition + '@' + editedParentCondition[1];
        }
      });
    }
  }

  if (parentIndex.length == 0) {
    newComp.index[newComp.index.length - 2] = nestedPosition;
    let label = newComp.label.replace('$NAME$', parentName);
    newComp.label = label;
  } else {
    newComp.index = JSON.parse(JSON.stringify(parentIndex));
    newComp.index = newComp.index.concat(0, componentPosition);
  }

  newComp.sourceQuestion = newComp.sourceQuestion !== undefined ? newComp.sourceQuestion + '#' + nestedPosition : undefined;
  let originSourceOption = newComp.sourceOption;

  if (originSourceOption !== undefined && originSourceOption !== '') {
    let tmpKey = originSourceOption.split('@');
    let compNew;

    if (tmpKey[1] === '$ROW$' || tmpKey[1] === '$ROW1$' || tmpKey[1] === '$ROW2$') {
      compNew = tmpKey[0] + '#' + nestedPosition + '@' + tmpKey[1];
    } else {
      compNew = originSourceOption;
    }

    newComp.sourceOption = compNew;
  } //variabel


  newComp.componentVar = newComp.componentVar !== undefined ? newComp.componentVar : [];
  let originCompVar = newComp.componentVar;

  if (newComp.componentVar.length !== 0) {
    const editedComponentVar = newComp.componentVar.map(comp => {
      let tmpKey = comp.split('@');
      let compNew;

      if (tmpKey[1] === '$ROW$' || tmpKey[1] === '$ROW1$' || tmpKey[1] === '$ROW2$') {
        compNew = tmpKey[0] + '#' + nestedPosition + '@' + tmpKey[1];
      } else {
        compNew = comp;
      }

      return compNew;
    });
    newComp.componentVar = editedComponentVar;
  }

  if (newComp.expression !== undefined) {
    let originExpression = newComp.expression;
    let cr_len = newComp.componentVar.length;

    for (let cr = 0; cr < cr_len; cr++) {
      originExpression = originExpression.replace(originCompVar[cr], newComp.componentVar[cr]);
    }

    newComp.expression = originExpression;
  } else {
    newComp.expression = undefined;
  } //enable


  newComp.componentEnable = newComp.componentEnable !== undefined ? newComp.componentEnable : [];
  let originCompEnable = newComp.componentEnable;

  if (newComp.componentEnable.length !== 0) {
    const editedComponentEnable = newComp.componentEnable.map(comp => {
      let tmpKey = comp.split('@');
      let compNew;

      if (tmpKey[1] === '$ROW$' || tmpKey[1] === '$ROW1$' || tmpKey[1] === '$ROW2$') {
        compNew = tmpKey[0] + '#' + nestedPosition + '@' + tmpKey[1];
      } else {
        compNew = comp;
      }

      return compNew;
    });
    newComp.componentEnable = editedComponentEnable;
  }

  if (newComp.enableCondition !== undefined) {
    let originEnableCondition = newComp.enableCondition;
    let ce_len = newComp.componentEnable.length;

    for (let ce = 0; ce < ce_len; ce++) {
      originEnableCondition = originEnableCondition.replace(originCompEnable[ce], newComp.componentEnable[ce]);
    }

    newComp.enableCondition = originEnableCondition;
  } else {
    newComp.enableCondition = undefined;
  }

  newComp.enable = newComp.enableCondition === undefined || newComp.enableCondition === '' ? true : eval_enable(newComp.enableCondition, newComp.dataKey);
  newComp.hasRemark = false;

  if (newComp.enableRemark === undefined || newComp.enableRemark !== undefined && newComp.enableRemark) {
    let remarkPosition = remark.details.notes.findIndex(obj => obj.dataKey === newComp.dataKey);

    if (remarkPosition !== -1) {
      let newNote = remark.details.notes[remarkPosition];
      let updatedNote = JSON.parse(JSON.stringify(note.details.notes));
      updatedNote.push(newNote);
      newComp.hasRemark = true;
      setNote('details', 'notes', updatedNote);
    }
  }

  if (tmp_type < 3) {
    let comp_array = [];
    newComp.components[0].forEach((element, index) => comp_array.push(createComponent(element.dataKey, nestedPosition, index, sidebarPosition, newComp.components[0][index], JSON.parse(JSON.stringify(newComp.index)), null)));
    newComp.components[0] = JSON.parse(JSON.stringify(comp_array));
  }

  return newComp;
};
const insertSidebarArray = (dataKey, answer, beforeAnswer, sidebarPosition) => {
  const refPosition = referenceIndexLookup(dataKey);
  let defaultRef = JSON.parse(JSON.stringify(reference.details[refPosition]));
  let components = [];
  defaultRef.components[0].forEach((element, index) => {
    let newComp = createComponent(defaultRef.components[0][index].dataKey, Number(answer.value), Number(index), sidebarPosition, defaultRef.components[0][index], [], answer.label);
    components.push(newComp);
  });
  let startPosition = 0;
  let updatedRef = JSON.parse(JSON.stringify(reference.details));
  let newIndexLength = components[0].index.length;

  for (let looping = newIndexLength; looping > 1; looping--) {
    let loopingState = true;
    let myIndex = JSON.parse(JSON.stringify(components[0].index));
    myIndex.length = looping;
    let refLength = reference.details.length;

    for (let y = refLength - 1; y >= 0; y--) {
      let refIndexToBeFound = JSON.parse(JSON.stringify(reference.details[y].index));
      refIndexToBeFound.length = looping;

      if (JSON.stringify(refIndexToBeFound) === JSON.stringify(myIndex)) {
        startPosition = y + 1;
        loopingState = false;
        break;
      }
    }

    if (!loopingState) break;
  }

  let history = [];
  components.forEach(el => {
    if (!(el.dataKey in referenceMap())) {
      updatedRef.splice(startPosition, 0, el);
      history.push({
        'pos': startPosition,
        'data': JSON.parse(JSON.stringify(el.dataKey))
      });
      startPosition += 1;
    }
  });
  addHistory('insert_ref_detail', null, refPosition, null, history);
  batch(() => {
    loadReferenceMap(updatedRef);
    setReference('details', updatedRef);
  });
  components.forEach(newComp => {
    let initial = 0;
    let value = [];
    value = newComp.answer ? newComp.answer : value;

    if (Number(newComp.type) === 4) {
      const getRowIndex = positionOffset => {
        let editedDataKey = newComp.dataKey.split('@');
        let splitDataKey = editedDataKey[0].split('#');
        let splLength = splitDataKey.length;
        let reducer = positionOffset + 1;
        return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
      };

      createSignal(getRowIndex(0));
      initial = 1;

      try {
        let value_local = eval(newComp.expression);
        value = value_local;
      } catch (e) {
        value = undefined;
        toastInfo$1(locale.details.language[0].errorExpression + newComp.dataKey, 3000, "", "bg-pink-600/80");
      }
    } else {
      let answerIndex = response.details.answers.findIndex(obj => obj.dataKey === newComp.dataKey);
      value = answerIndex !== -1 && response.details.answers[answerIndex] !== undefined ? response.details.answers[answerIndex].answer : value;

      if (answerIndex === -1) {
        initial = 1;
        const presetIndex = preset.details.predata.findIndex(obj => obj.dataKey === newComp.dataKey);

        if (presetIndex !== -1 && preset.details.predata[presetIndex] !== undefined && (getConfig.initialMode == 2 || getConfig.initialMode == 1 && newComp.presetMaster !== undefined && newComp.presetMaster)) {
          value = preset.details.predata[presetIndex].answer;
          initial = 0;
        } else {
          initial = 1;
        }
      }
    }

    saveAnswer(newComp.dataKey, 'answer', value, sidebarPosition, null, initial);
  });
  let newSide = {
    dataKey: dataKey + '#' + answer.value,
    label: defaultRef.label,
    description: answer.label,
    level: defaultRef.level,
    index: [...defaultRef.index, Number(answer.value)],
    components: [components],
    sourceQuestion: defaultRef.sourceQuestion !== undefined ? defaultRef.sourceQuestion : '',
    enable: defaultRef.enable !== undefined ? defaultRef.enable : true,
    enableCondition: defaultRef.enableCondition === undefined ? undefined : defaultRef.enableCondition,
    componentEnable: defaultRef.componentEnable !== undefined ? defaultRef.componentEnable : []
  };
  let updatedSidebar = JSON.parse(JSON.stringify(sidebar$1.details));

  if (sidebar$1.details.findIndex(obj => obj.dataKey === newSide.dataKey) === -1) {
    let newSideLength = newSide.index.length;
    let y_tmp = 0;

    for (let looping = newSideLength; looping > 1; looping--) {
      let loopingState = true;
      let myIndex = JSON.parse(JSON.stringify(newSide.index));
      myIndex.length = looping;
      let sideLength = sidebar$1.details.length;

      if (y_tmp == 0) {
        for (let y = sideLength - 1; y >= sidebarPosition; y--) {
          if (sidebar$1.details[y] !== undefined) {
            let sidebarIndexToBeFound = JSON.parse(JSON.stringify(sidebar$1.details[y].index));
            sidebarIndexToBeFound.length = looping;

            if (JSON.stringify(sidebarIndexToBeFound) === JSON.stringify(myIndex)) {
              let indexMe = Number(newSide.index[looping]);
              let indexFind = sidebar$1.details[y].index[looping] == undefined ? 0 : Number(sidebar$1.details[y].index[looping]);

              if (looping == newSideLength - 1 || indexMe >= indexFind) {
                updatedSidebar.splice(y + 1, 0, newSide);
                loopingState = false;
                break;
              } else if (indexMe < indexFind) {
                y_tmp = y;
              }
            }
          }
        }

        if (!loopingState) break;
      } else {
        updatedSidebar.splice(y_tmp, 0, newSide);
        break;
      }
    }
  }

  addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
  setSidebar('details', updatedSidebar);
};
const deleteSidebarArray = (dataKey, answer, beforeAnswer, sidebarPosition) => {
  const refPosition = referenceIndexLookup(dataKey);
  let updatedRef = JSON.parse(JSON.stringify(reference.details));
  let updatedSidebar = JSON.parse(JSON.stringify(sidebar$1.details));
  let componentForeignIndexRef = JSON.parse(JSON.stringify(reference.details[refPosition].index));
  let newComponentForeignIndexRef = [...componentForeignIndexRef, Number(beforeAnswer.value)];
  let history = [];
  let refLength = reference.details.length;

  for (let j = refLength - 1; j > refPosition; j--) {
    let tmpChildIndex = JSON.parse(JSON.stringify(reference.details[j].index));
    tmpChildIndex.length = newComponentForeignIndexRef.length;

    if (JSON.stringify(tmpChildIndex) === JSON.stringify(newComponentForeignIndexRef)) {
      updatedRef.splice(j, 1);
      history.push({
        'pos': j,
        'data': JSON.parse(JSON.stringify(reference.details[j]))
      });
    }
  }

  let sideLength = sidebar$1.details.length;

  for (let x = sideLength - 1; x > sidebarPosition; x--) {
    let tmpSidebarIndex = JSON.parse(JSON.stringify(sidebar$1.details[x].index));
    tmpSidebarIndex.length = newComponentForeignIndexRef.length;

    if (JSON.stringify(tmpSidebarIndex) === JSON.stringify(newComponentForeignIndexRef)) {
      updatedSidebar.splice(x, 1);
    }
  }

  addHistory('delete_ref_detail', null, refPosition, null, history);
  batch(() => {
    loadReferenceMap(updatedRef);
    setReference('details', updatedRef);
  });
  addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
  setSidebar('details', updatedSidebar);
};
const changeSidebarArray = (dataKey, answer, beforeAnswer, sidebarPosition) => {
  const refPosition = referenceIndexLookup(dataKey);
  let now = [];
  let nestedPositionNow = -1;
  let answerLength = answer.length;
  let beforeAnswerLength = beforeAnswer.length;
  answer.forEach((element, index) => {
    if (beforeAnswer.findIndex(obj => Number(obj.value) === Number(answer[index].value)) === -1) {
      now.push(answer[index]);
      nestedPositionNow = Number(index);
    }
  });
  let changedValue = -1;

  if (nestedPositionNow == -1) {
    //different label in sidebar
    for (let i = 0; i < answerLength; i++) {
      for (let j = 0; j < beforeAnswerLength; j++) {
        if (answer[i].value === beforeAnswer[j].value) {
          if (answer[i].label !== beforeAnswer[j].label) {
            changedValue = Number(answer[i].value);
            nestedPositionNow = i;
            break;
          }
        }
      }

      if (changedValue !== -1) {
        break;
      }
    }

    if (nestedPositionNow !== -1) {
      let componentForeignIndexRef = JSON.parse(JSON.stringify(reference.details[refPosition].index));
      let newComponentForeignIndexRef = componentForeignIndexRef.concat(Number(answer[nestedPositionNow].value));
      let sidebarPosition = sidebar$1.details.findIndex(obj => JSON.stringify(obj.index) === JSON.stringify(newComponentForeignIndexRef));
      let updatedSidebarDescription = answer[nestedPositionNow].label;
      let oldDesc = sidebar$1.details[sidebarPosition].description;
      let newSidebarComp = JSON.parse(JSON.stringify(sidebar$1.details[sidebarPosition]));
      let editedComp = [];
      newSidebarComp.components[0].forEach((element, index) => {
        let editedLabel = element.label.replace(oldDesc, updatedSidebarDescription);
        element.label = editedLabel;
        editedComp.push(element);
      });
      newSidebarComp.description = updatedSidebarDescription;
      newSidebarComp.components[0] = editedComp;
      addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
      setSidebar('details', sidebarPosition, newSidebarComp);
    }
  } else {
    let valueToAdd = JSON.parse(JSON.stringify(answer));
    let beforeValueToDel = JSON.parse(JSON.stringify(beforeAnswer));

    for (let i = 0; i < answerLength; i++) {
      let cekBefore = beforeValueToDel.findIndex(obj => Number(obj.value) === Number(answer[i].value));
      if (cekBefore !== -1) beforeValueToDel.splice(cekBefore, 1);
      let cekValue = valueToAdd.findIndex(obj => Number(obj.value) === Number(beforeAnswer[i].value));
      if (cekValue !== -1) valueToAdd.splice(cekValue, 1);
    }

    insertSidebarArray(dataKey, valueToAdd[0], [], sidebarPosition);
    deleteSidebarArray(dataKey, [], beforeValueToDel[0], sidebarPosition);
  }
};
const insertSidebarNumber = (dataKey, answer, beforeAnswer, sidebarPosition) => {
  const refPosition = referenceIndexLookup(dataKey);
  let defaultRef = JSON.parse(JSON.stringify(reference.details[refPosition]));
  let components = [];
  let now = Number(beforeAnswer) + 1;

  for (let c in defaultRef.components[0]) {
    let newComp = createComponent(defaultRef.components[0][c].dataKey, now, Number(c), sidebarPosition, defaultRef.components[0][c], [], now.toString());
    components.push(newComp);
  }

  if (components.length > 0) {
    let startPosition = 0;
    let updatedRef = JSON.parse(JSON.stringify(reference.details));
    let newIndexLength = components[0].index.length;

    for (let looping = newIndexLength; looping > 1; looping--) {
      let loopingState = true;
      let myIndex = JSON.parse(JSON.stringify(components[0].index));
      myIndex.length = looping;
      let refLength = reference.details.length;

      for (let y = refLength - 1; y >= 0; y--) {
        let refIndexToBeFound = JSON.parse(JSON.stringify(reference.details[y].index));
        refIndexToBeFound.length = looping;

        if (JSON.stringify(refIndexToBeFound) === JSON.stringify(myIndex)) {
          startPosition = y + 1;
          loopingState = false;
          break;
        }
      }

      if (!loopingState) break;
    }

    let history = [];
    components.forEach(el => {
      if (!(el.dataKey in referenceMap())) {
        updatedRef.splice(startPosition, 0, el);
        history.push({
          'pos': startPosition,
          'data': JSON.parse(JSON.stringify(el.dataKey))
        });
        startPosition += 1;
      }
    });
    addHistory('insert_ref_detail', null, refPosition, null, history);
    batch(() => {
      loadReferenceMap(updatedRef);
      setReference('details', updatedRef);
    });
    components.forEach(newComp => {
      let initial = 0;
      let value = [];
      value = newComp.answer ? newComp.answer : value;

      if (Number(newComp.type) === 4) {
        const getRowIndex = positionOffset => {
          let editedDataKey = newComp.dataKey.split('@');
          let splitDataKey = editedDataKey[0].split('#');
          let splLength = splitDataKey.length;
          let reducer = positionOffset + 1;
          return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
        };

        createSignal(getRowIndex(0));
        initial = 1;

        try {
          let value_local = eval(newComp.expression);
          value = value_local;
        } catch (e) {
          value = undefined;
          toastInfo$1(locale.details.language[0].errorExpression + newComp.dataKey, 3000, "", "bg-pink-600/80");
        }
      } else {
        let answerIndex = response.details.answers.findIndex(obj => obj.dataKey === newComp.dataKey);
        value = answerIndex !== -1 && response.details.answers[answerIndex] !== undefined ? response.details.answers[answerIndex].answer : value;

        if (answerIndex === -1) {
          initial = 1;
          const presetIndex = preset.details.predata.findIndex(obj => obj.dataKey === newComp.dataKey);

          if (presetIndex !== -1 && preset.details.predata[presetIndex] !== undefined && (getConfig.initialMode == 2 || getConfig.initialMode == 1 && newComp.presetMaster !== undefined && newComp.presetMaster)) {
            value = preset.details.predata[presetIndex].answer;
            initial = 0;
          } else {
            initial = 1;
          }
        }
      }

      saveAnswer(newComp.dataKey, 'answer', value, sidebarPosition, null, initial);
    });
    let newSide = {
      dataKey: dataKey + '#' + now,
      label: defaultRef.label,
      description: '<i>___________ # ' + now + '</i>',
      level: defaultRef.level,
      index: [...defaultRef.index, now],
      components: [components],
      sourceQuestion: defaultRef.sourceQuestion !== undefined ? defaultRef.sourceQuestion + '#' + (Number(beforeAnswer) + 1) : '',
      enable: defaultRef.enable !== undefined ? defaultRef.enable : true,
      enableCondition: defaultRef.enableCondition === undefined ? undefined : defaultRef.enableCondition,
      componentEnable: defaultRef.componentEnable !== undefined ? defaultRef.componentEnable : []
    };
    let updatedSidebar = JSON.parse(JSON.stringify(sidebar$1.details));

    if (sidebar$1.details.findIndex(obj => obj.dataKey === newSide.dataKey) === -1) {
      let newSideLength = newSide.index.length;
      let y_tmp = 0;

      for (let looping = newSideLength; looping > 1; looping--) {
        let loopingState = true;
        let myIndex = JSON.parse(JSON.stringify(newSide.index));
        myIndex.length = looping;
        let sideLength = sidebar$1.details.length;

        if (y_tmp == 0) {
          for (let y = sideLength - 1; y >= sidebarPosition; y--) {
            let sidebarIndexToBeFound = JSON.parse(JSON.stringify(sidebar$1.details[y].index));
            sidebarIndexToBeFound.length = looping;

            if (JSON.stringify(sidebarIndexToBeFound) === JSON.stringify(myIndex)) {
              let indexMe = Number(newSide.index[looping]);
              let indexFind = sidebar$1.details[y].index[looping] == undefined ? 0 : Number(sidebar$1.details[y].index[looping]);

              if (looping == newSideLength - 1 || indexMe >= indexFind) {
                updatedSidebar.splice(y + 1, 0, newSide);
                loopingState = false;
                break;
              } else if (indexMe < indexFind) {
                y_tmp = y;
              }
            }
          }

          if (!loopingState) break;
        } else {
          updatedSidebar.splice(y_tmp, 0, newSide);
          break;
        }
      }
    }

    addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
    setSidebar('details', updatedSidebar);
  }

  if (now < answer) insertSidebarNumber(dataKey, answer, now, sidebarPosition);
};
const deleteSidebarNumber = (dataKey, answer, beforeAnswer, sidebarPosition) => {
  const refPosition = referenceIndexLookup(dataKey);
  let updatedRef = JSON.parse(JSON.stringify(reference.details));
  let updatedSidebar = JSON.parse(JSON.stringify(sidebar$1.details));
  let componentForeignIndexRef = JSON.parse(JSON.stringify(reference.details[refPosition].index));
  let newComponentForeignIndexRef = [...componentForeignIndexRef, Number(beforeAnswer)];
  let history = [];
  let refLength = reference.details.length;

  for (let j = refLength - 1; j > refPosition; j--) {
    let tmpChildIndex = JSON.parse(JSON.stringify(reference.details[j].index));
    tmpChildIndex.length = newComponentForeignIndexRef.length;

    if (JSON.stringify(tmpChildIndex) === JSON.stringify(newComponentForeignIndexRef)) {
      updatedRef.splice(j, 1);
      history.push({
        'pos': j,
        'data': JSON.parse(JSON.stringify(reference.details[j]))
      });
    }
  }

  let sideLength = sidebar$1.details.length;

  for (let x = sideLength - 1; x > sidebarPosition; x--) {
    let tmpSidebarIndex = JSON.parse(JSON.stringify(sidebar$1.details[x].index));
    tmpSidebarIndex.length = newComponentForeignIndexRef.length;

    if (JSON.stringify(tmpSidebarIndex) === JSON.stringify(newComponentForeignIndexRef)) {
      updatedSidebar.splice(x, 1);
    }
  }

  addHistory('delete_ref_detail', null, refPosition, null, history);
  setReference('details', updatedRef);
  addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
  setSidebar('details', updatedSidebar);
  let now = beforeAnswer - 1;

  if (now > answer) {
    deleteSidebarNumber(dataKey, answer, now, sidebarPosition);
  } else {
    loadReferenceMap();
  }
};
const runVariableComponent = (dataKey, activeComponentPosition, initial) => {
  const getRowIndex = positionOffset => {
    let editedDataKey = dataKey.split('@');
    let splitDataKey = editedDataKey[0].split('#');
    let splLength = splitDataKey.length;
    let reducer = positionOffset + 1;
    return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
  };

  createSignal(getRowIndex(0));
  const refPosition = referenceIndexLookup(dataKey);

  if (refPosition !== -1) {
    let updatedRef = JSON.parse(JSON.stringify(reference.details[refPosition]));

    try {
      let answerVariable = eval(updatedRef.expression);
      let init = initial == 1 ? 1 : answerVariable == undefined || answerVariable != undefined && answerVariable.length == 0 ? 1 : 0;
      saveAnswer(dataKey, 'answer', answerVariable, activeComponentPosition, null, init);
    } catch (e) {
      console.log(e, dataKey);
      toastInfo$1(locale.details.language[0].errorExpression + dataKey, 3000, "", "bg-pink-600/80");
      saveAnswer(dataKey, 'answer', undefined, activeComponentPosition, null, 1);
    }
  }
};
const runEnabling = (dataKey, activeComponentPosition, prop, enableCondition) => {

  const eval_enable = (eval_text, dataKey) => {
    try {
      return eval(eval_text);
    } catch (e) {
      console.log(e, dataKey, eval_text);
      toastInfo$1(locale.details.language[0].errorEnableExpression + dataKey, 3000, "", "bg-pink-600/80");
      return default_eval_enable;
    }
  };

  const getRowIndex = positionOffset => {
    let editedDataKey = dataKey.split('@');
    let splitDataKey = editedDataKey[0].split('#');
    let splLength = splitDataKey.length;
    let reducer = positionOffset + 1;
    return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
  };

  createSignal(getRowIndex(0));
  let enable = eval_enable(enableCondition, dataKey);
  saveAnswer(dataKey, 'enable', enable, activeComponentPosition, null, 0);
};
const runValidation = (dataKey, updatedRef, activeComponentPosition, clientMode) => {
  const getRowIndex = positionOffset => {
    let editedDataKey = dataKey.split('@');
    let splitDataKey = editedDataKey[0].split('#');
    let splLength = splitDataKey.length;
    let reducer = positionOffset + 1;
    return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
  };

  createSignal(getRowIndex(0));
  updatedRef.validationMessage = [];
  updatedRef.validationState = 0;

  if (!updatedRef.hasRemark) {
    updatedRef.validations?.forEach((el, i) => {
      let result = default_eval_validation;

      try {
        result = eval(el.test);
      } catch (e) {
        console.log(e, updatedRef.dataKey, el.test);
        toastInfo$1(locale.details.language[0].errorValidationExpression + updatedRef.dataKey, 3000, "", "bg-pink-600/80");
      }

      if (result) {
        updatedRef.validationMessage.push(el.message);
        updatedRef.validationState = updatedRef.validationState < el.type ? el.type : updatedRef.validationState;
      } // }

    });

    if (updatedRef.urlValidation && (updatedRef.type == 24 || updatedRef.type == 25 || updatedRef.type == 28 || updatedRef.type == 30 || updatedRef.type == 31)) {
      let resultTest = false;
      let fetchStatus;
      let url = `${updatedRef.urlValidation}`;

      let onlineValidation = async url => await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: updatedRef.answer
        })
      }).catch(error => {
        let temp = {
          result: false
        };
        fetchStatus = false;
        resultTest = temp.result;

        if (!resultTest || !fetchStatus) {
          let validationMessage = locale.details.language[0].validationApi;
          updatedRef.validationMessage.push(validationMessage);
          updatedRef.validationState = 2;
          saveAnswer(dataKey, 'validate', updatedRef, activeComponentPosition, null, 0);
        }
      }).then(res => {
        if (res.status === 200) {
          let temp = res.json();
          fetchStatus = true;
          return temp;
        } else {
          let temp = {
            result: false
          };
          fetchStatus = false;
          return temp;
        }
      }).then(res => {
        resultTest = res.result;

        if (!resultTest || !fetchStatus) {
          let validationMessage = locale.details.language[0].validationApi;

          if (res.message && (res.message != '' || res.message != undefined)) {
            validationMessage = res.message;
          }

          updatedRef.validationMessage.push(validationMessage);
          updatedRef.validationState = 2;
          saveAnswer(dataKey, 'validate', updatedRef, activeComponentPosition, null, 0);
        }
      });

      onlineValidation(url);
    }

    if (updatedRef.lengthInput !== undefined && updatedRef.lengthInput.length > 0 && updatedRef.answer !== undefined && typeof updatedRef.answer !== 'object') {
      if (updatedRef.lengthInput[0].maxlength !== undefined && updatedRef.answer.length > updatedRef.lengthInput[0].maxlength) {
        updatedRef.validationMessage.push(locale.details.language[0].validationMaxLength + " " + updatedRef.lengthInput[0].maxlength);
        updatedRef.validationState = 2;
      }

      if (updatedRef.lengthInput[0].minlength !== undefined && updatedRef.answer.length < updatedRef.lengthInput[0].minlength) {
        updatedRef.validationMessage.push(locale.details.language[0].validationMinLength + " " + updatedRef.lengthInput[0].minlength);
        updatedRef.validationState = 2;
      }
    }

    if (updatedRef.rangeInput !== undefined && updatedRef.rangeInput.length > 0 && updatedRef.answer !== undefined && typeof updatedRef.answer !== 'object') {
      if (updatedRef.rangeInput[0].max !== undefined && Number(updatedRef.answer) > updatedRef.rangeInput[0].max) {
        updatedRef.validationMessage.push(locale.details.language[0].validationMax + " " + updatedRef.rangeInput[0].max);
        updatedRef.validationState = 2;
      }

      if (updatedRef.rangeInput[0].min !== undefined && Number(updatedRef.answer) < updatedRef.rangeInput[0].min) {
        updatedRef.validationMessage.push(locale.details.language[0].validationMin + " " + updatedRef.rangeInput[0].min);
        updatedRef.validationState = 2;
      }
    }

    if (updatedRef.type == 31 && updatedRef.answer !== undefined && typeof updatedRef.answer !== 'object') {
      let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

      if (!re.test(updatedRef.answer)) {
        updatedRef.validationMessage.push(locale.details.language[0].validationEmail);
        updatedRef.validationState = 2;
      }
    }

    if (updatedRef.type == 19 && updatedRef.answer !== undefined && typeof updatedRef.answer !== 'object') {
      let re = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

      if (!re.test(updatedRef.answer)) {
        updatedRef.validationMessage.push(locale.details.language[0].validationUrl);
        updatedRef.validationState = 2;
      }
    }
    /**
     * Handle PAPI validation.
     */


    if (clientMode == ClientMode.PAPI && updatedRef.answer !== undefined) {
      const val = updatedRef.answer;
      /** Validate radio input */

      if (updatedRef.type == ControlType.RadioInput) {
        const allowedVals = updatedRef.options?.map(opt => opt.value);

        if (allowedVals !== undefined) {
          if (val[0] && !allowedVals.includes(val[0].value)) {
            const validationMessage = templating(locale.details.language[0].validationInclude, {
              values: allowedVals.join(",")
            });
            updatedRef.validationMessage.push(validationMessage);
            updatedRef.validationState = 2;
          }
        }
      }
      /** Validate date && datetime input */


      if (updatedRef.type == ControlType.DateInput || updatedRef.type == ControlType.DateTimeLocalInput) {
        if (!validateDateString(updatedRef.answer)) {
          updatedRef.validationMessage.push(locale.details.language[0].validationDate);
          updatedRef.validationState = 2;
        } else {
          const date = new Date(updatedRef.answer);

          if (updatedRef?.rangeInput[0]?.max !== undefined) {
            const maxDate = updatedRef.rangeInput[0].max === 'today' ? new Date() : new Date(updatedRef.rangeInput[0].max);

            if (date.getTime() > maxDate.getTime()) {
              updatedRef.validationMessage.push(locale.details.language[0].validationMax + " " + dayjs(maxDate).format('DD/MM/YYYY'));
              updatedRef.validationState = 2;
            }
          }

          if (updatedRef?.rangeInput[0]?.min !== undefined) {
            const minDate = updatedRef.rangeInput[0].min === 'today' ? new Date() : new Date(updatedRef.rangeInput[0].min);

            if (date.getTime() < minDate.getTime()) {
              updatedRef.validationMessage.push(locale.details.language[0].validationMin + " " + dayjs(minDate).format('DD/MM/YYYY'));
              updatedRef.validationState = 2;
            }
          }
        }
      }
      /** Validate range slider input*/


      if (updatedRef.type == ControlType.RangeSliderInput) {
        const step = updatedRef?.rangeInput[0]?.step;

        if (step !== undefined && updatedRef.answer % step !== 0) {
          updatedRef.validationMessage.push(locale.details.language[0].validationStep + " " + step);
          updatedRef.validationState = 2;
        }
      }
    }
  }

  saveAnswer(dataKey, 'validate', updatedRef, activeComponentPosition, null, 0);
};
const setEnableFalse = () => {
  const indexEnableFalse = [];
  setReferenceEnableFalse([]);
  sidebar$1.details.forEach(element => {
    if (!element.enable) {
      let idx = JSON.parse(JSON.stringify(element.index));
      idx.length = idx.length;
      indexEnableFalse.push({
        parentIndex: idx
      });
    }
  });
  setReferenceEnableFalse(JSON.parse(JSON.stringify(indexEnableFalse)));
};
const saveAnswer = (dataKey, attributeParam, answer, activeComponentPosition, prop, initial) => {
  const eval_enable = (eval_text, dataKey) => {
    try {
      return eval(eval_text);
    } catch (e) {
      console.log(e);
      toastInfo$1(locale.details.language[0].errorEnableExpression + dataKey, 3000, "", "bg-pink-600/80");
      return default_eval_enable;
    }
  };

  let refPosition = referenceIndexLookup(dataKey);

  if (refPosition > -1 && (attributeParam === 'answer' || attributeParam === 'enable')) {
    let beforeAnswer = typeof answer === 'number' || typeof answer === 'string' ? 0 : [];
    beforeAnswer = reference.details[refPosition]?.answer !== undefined && reference.details[refPosition].answer !== '' ? reference.details[refPosition].answer : beforeAnswer;
    addHistory('saveAnswer', dataKey, refPosition, attributeParam, reference.details[refPosition][attributeParam]);
    setReference('details', refPosition, attributeParam, answer); //validate for its own dataKey 

    if (referenceHistoryEnable() && (reference.details[refPosition].validations !== undefined || reference.details[refPosition].rangeInput !== undefined || reference.details[refPosition].lengthInput !== undefined || reference.details[refPosition].type == 31 || 19) && initial == 0) runValidation(dataKey, JSON.parse(JSON.stringify(reference.details[refPosition])), activeComponentPosition, prop?.clientMode); //do nothing if no changes, thanks to Budi's idea on pull request #5

    if (attributeParam === 'answer') {
      if (JSON.stringify(beforeAnswer) === JSON.stringify(answer)) {
        return;
      }
    }

    if (attributeParam === 'enable') {
      if (reference.details[refPosition]['enable'] === answer) {
        return;
      }
    } //enabling ~ run when answer


    if (attributeParam === 'answer') {
      const hasSideCompEnable = JSON.parse(JSON.stringify(sidebar$1.details.filter(obj => {
        if (obj.componentEnable !== undefined) {
          const cekInsideIndex = obj.componentEnable.findIndex(objChild => {
            let newDataKey = '';
            let tmpDataKey = objChild.split('@');
            let splitDataKey = tmpDataKey[0].split('#');
            let splLength = splitDataKey.length;

            switch (tmpDataKey[1]) {
              case '$ROW$':
                {
                  newDataKey = tmpDataKey[0];
                  break;
                }

              case '$ROW1$':
                {
                  if (splLength > 2) splitDataKey.length = splLength - 1;
                  newDataKey = splitDataKey.join('#');
                  break;
                }

              case '$ROW2$':
                {
                  if (splLength > 3) splitDataKey.length = splLength - 2;
                  newDataKey = splitDataKey.join('#');
                  break;
                }

              default:
                {
                  newDataKey = objChild;
                  break;
                }
            }

            return newDataKey === dataKey ? true : false;
          });
          return cekInsideIndex == -1 ? false : true;
        }
      })));

      if (hasSideCompEnable.length > 0) {
        //at least there is minimal 1 enable in this datakey
        hasSideCompEnable.forEach(sidebarEnable => {
          let sidePosition = sidebar$1.details.findIndex(objSide => objSide.dataKey === sidebarEnable.dataKey);
          let enableSideBefore = sidebar$1.details[sidePosition]['enable'];
          let enableSide = eval_enable(sidebarEnable.enableCondition, sidebarEnable.dataKey);
          addHistory('update_sidebar', null, null, null, JSON.parse(JSON.stringify(sidebar$1.details)));
          setSidebar('details', sidePosition, 'enable', enableSide);
          let updatedRef = JSON.parse(JSON.stringify(reference.details));
          let tmpVarComp = [];
          let tmpIndex = [];

          if (enableSide !== enableSideBefore) {
            sidebarEnable.components[0].forEach((element, index) => {
              // let refPos = updatedRef.findIndex(objRef => objRef.dataKey === element.dataKey);
              let refPos = referenceIndexLookup(element.dataKey);

              if (refPos !== -1) {
                if (!enableSide) {
                  setReference('details', refPos, 'enable', enableSide);
                } else {
                  if (Number(updatedRef[refPos].type) === 4) {
                    tmpVarComp.push(updatedRef[refPos]);
                    tmpIndex.push(index);
                  }

                  let newEnab = true;

                  if (updatedRef[refPos].enableCondition === undefined || updatedRef[refPos].enableCondition === '') {
                    newEnab = true;
                  } else {
                    newEnab = eval_enable(updatedRef[refPos].enableCondition, updatedRef[refPos].dataKey);
                  }

                  setReference('details', refPos, 'enable', newEnab);
                }
              }
            });

            if (tmpVarComp.length > 0) {
              const getRowIndex = positionOffset => {
                let editedDataKey = dataKey.split('@');
                let splitDataKey = editedDataKey[0].split('#');
                let splLength = splitDataKey.length;
                let reducer = positionOffset + 1;
                return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
              };

              createSignal(getRowIndex(0));
              tmpVarComp.forEach((t, i) => {
                try {
                  let evVal = eval(t.expression);
                  saveAnswer(t.dataKey, 'answer', evVal, tmpIndex[i], null, 0);
                } catch (e) {
                  toastInfo$1(locale.details.language[0].errorExpression + t.dataKey, 3000, "", "bg-pink-600/80");
                  saveAnswer(e.dataKey, 'answer', undefined, tmpIndex[i], null, 1);
                }
              });
            }
          }
        });
      }

      const hasComponentEnable = get_CompEnable(dataKey);

      if (hasComponentEnable.length > 0) {
        //this datakey at least appear in minimum 1 enable
        hasComponentEnable.forEach(elementEnableDatakey => {
          let element_pos = referenceIndexLookup(elementEnableDatakey);

          if (element_pos !== -1) {
            let elementEnable = reference.details[element_pos];
            runEnabling(elementEnable.dataKey, activeComponentPosition, prop, elementEnable.enableCondition);
          }
        });
      }
    }

    if (reference.details[refPosition].enable) {
      //validating ~ run weel when answer or enable
      if (initial == 0) {
        // const hasComponentValidation = JSON.parse(JSON.stringify(reference.details.filter(obj => {
        //     let editedDataKey = obj.dataKey.split('@');
        //     let newEdited = editedDataKey[0].split('#');
        //     if ((obj.enable) && obj.componentValidation !== undefined) {
        //         if (obj.level < 2 || obj.level > 1 && newEdited[1] !== undefined) {
        //             const cekInsideIndex = obj.componentValidation.findIndex(objChild => {
        //                 let newKey = dataKey.split('@');//reduce or split @
        //                 let newNewKey = newKey[0].split('#');//remove the row
        //                 return (objChild === newNewKey[0]) ? true : false;
        //             });
        //             return (cekInsideIndex == -1) ? false : true;
        //         }
        //     }
        // })));
        const hasComponentValidation = get_CompValid(dataKey);

        if (hasComponentValidation.length > 0) {
          //at least this dataKey appears in minimum 1 validation
          hasComponentValidation.forEach(elementVal => {
            let componentIndex = referenceIndexLookup(elementVal);
            if (reference.details[componentIndex].enable) runValidation(elementVal, JSON.parse(JSON.stringify(reference.details[componentIndex])), activeComponentPosition, prop?.clientMode); // runValidation(elementVal.dataKey, JSON.parse(JSON.stringify(elementVal)), activeComponentPosition);
          });
        } else if (prop?.clientMode === ClientMode.PAPI && OPTION_INPUT_CONTROL.includes(reference.details[refPosition].type)) {
          runValidation(dataKey, JSON.parse(JSON.stringify(reference.details[refPosition])), activeComponentPosition, prop?.clientMode);
        }
      } //cek opt ~ run well on answer or enable


      const hasSourceOption = JSON.parse(JSON.stringify(reference.details.filter(obj => {
        if (obj.enable && obj.sourceOption !== undefined) {
          let editedSourceOption = obj.sourceOption.split('@');
          return dataKey == editedSourceOption[0] ? true : false;
        }
      })));

      if (hasSourceOption.length > 0) {
        //at least dataKey appear in minimal 1 sourceOption
        hasSourceOption.forEach(elementSourceOption => {
          if (elementSourceOption.answer) {
            let x = [];
            elementSourceOption.answer.forEach(val => {
              answer.forEach(op => {
                if (val.value == op.value) {
                  x.push(op);
                }
              });
            });
            saveAnswer(elementSourceOption.dataKey, 'answer', x, activeComponentPosition, null, 0);
          }
        });
      } //variabel ~ executed when enable = TRUE


      const hasComponentVar = JSON.parse(JSON.stringify(reference.details.filter(obj => {
        if (obj.componentVar !== undefined) {
          const cekInsideIndex = obj.componentVar.findIndex(objChild => {
            let newKey = dataKey.split('@'); //mereduce @

            let newNewKey = newKey[0].split('#'); //menghilangkan row nya

            return objChild === newNewKey[0] ? true : false;
          });
          return cekInsideIndex == -1 ? false : true;
        }
      })));

      if (hasComponentVar.length > 0) {
        //at least dataKey appeasr in minimum 1 variable
        hasComponentVar.forEach(elementVar => {
          runVariableComponent(elementVar.dataKey, 0, initial);
        });
      }

      const hasComponentUsing = JSON.parse(JSON.stringify(reference.details.filter(obj => obj.type === 2 && obj.sourceQuestion == dataKey)));

      if (hasComponentUsing.length > 0) {
        //this dataKey is used as a source in Nested at minimum 1 component
        if (reference.details[refPosition].answer == undefined && reference.details[refPosition].type === 4) beforeAnswer = [];

        if (typeof answer !== 'boolean' && !(answer == undefined && JSON.stringify(beforeAnswer) == '[]')) {
          console.time('Nested 🚀');
          hasComponentUsing.forEach(element => {
            if (typeof answer === 'number' || typeof answer === 'string') {
              beforeAnswer = beforeAnswer === undefined ? 0 : beforeAnswer;

              if (Number(answer) > Number(beforeAnswer)) {
                insertSidebarNumber(element.dataKey, answer, beforeAnswer, activeComponentPosition);
              } else if (Number(answer) < Number(beforeAnswer)) {
                deleteSidebarNumber(element.dataKey, answer, beforeAnswer, activeComponentPosition);
              }
            } else if (typeof answer === 'object') {
              beforeAnswer = beforeAnswer === undefined ? [] : beforeAnswer;
              answer = JSON.parse(JSON.stringify(answer));
              beforeAnswer = JSON.parse(JSON.stringify(beforeAnswer));

              if (answer.length > 0) {
                let tmp_index = answer.findIndex(obj => Number(obj.value) === 0);

                if (tmp_index !== -1) {
                  let tmp_label = answer[tmp_index].label.split('#');
                  if (tmp_label[1]) answer.splice(tmp_index, 1);
                }
              }

              if (beforeAnswer.length > 0) {
                let tmp_index = beforeAnswer.findIndex(obj => Number(obj.value) === 0);

                if (tmp_index !== -1) {
                  let tmp_label = beforeAnswer[tmp_index].label.split('#');
                  if (tmp_label[1]) beforeAnswer.splice(tmp_index, 1);
                }
              }

              let answerLength = answer.length;
              let beforeAnswerLength = beforeAnswer.length;

              if (answerLength > beforeAnswerLength) {
                answer.forEach(componentAnswer => {
                  let checked = element.dataKey + '#' + Number(componentAnswer.value);

                  if (sidebar$1.details.findIndex(obj => obj.dataKey === checked) === -1) {
                    insertSidebarArray(element.dataKey, componentAnswer, [], activeComponentPosition);
                  }
                });
              } else if (answerLength < beforeAnswerLength) {
                if (answer.length > 0) {
                  beforeAnswer.forEach(component => {
                    if (answer.findIndex(obj => Number(obj.value) === Number(component.value)) === -1) {
                      deleteSidebarArray(element.dataKey, [], component, activeComponentPosition);
                    }
                  });
                } else {
                  deleteSidebarArray(element.dataKey, [], beforeAnswer[0], activeComponentPosition);
                }
              } else if (answerLength === beforeAnswerLength) {
                answerLength > 0 && changeSidebarArray(element.dataKey, answer, beforeAnswer, activeComponentPosition);
              }
            }
          });
          console.timeEnd('Nested 🚀');
        }
      }
    }

    setEnableFalse();
  } else if (attributeParam === 'validate') {
    let counterValidate = counter.validate;
    setCounter('validate', counterValidate += 1);
    let item_refff = JSON.parse(JSON.stringify(reference.details[refPosition]));
    addHistory('saveAnswer', dataKey, refPosition, attributeParam, {
      'validationState': item_refff.validationState,
      'validationMessage': item_refff.validationMessage
    });
    setReference('details', refPosition, answer);
  }
};
function referenceIndexLookup(datakey, index_lookup = 0) {
  try {
    if (datakey in referenceMap()) {
      try {
        if (reference.details[referenceMap()[datakey][0][0]].dataKey === datakey) {
          if (index_lookup == 0) {
            return referenceMap()[datakey][0][0];
          } else {
            return referenceMap()[datakey][1];
          }
        } else {
          loadReferenceMap();

          if (datakey in referenceMap()) {
            if (index_lookup == 0) {
              return referenceMap()[datakey][0][0];
            } else {
              return referenceMap()[datakey][1];
            }
          } else {
            return -1;
          }
        }
      } catch (e) {
        loadReferenceMap();

        if (datakey in referenceMap()) {
          if (index_lookup == 0) {
            return referenceMap()[datakey][0][0];
          } else {
            return referenceMap()[datakey][1];
          }
        } else {
          return -1;
        }
      }
    } else {
      return -1;
    }
  } catch (ex) {
    return -1;
  }
} // laad_reference_map, and add map for dependency for validasion, enable, componentVar, sourceOption and sourceQuestion

function initReferenceMap(reference_local = null) {
  let compEnableMap_local = new Object();
  let compValidMap_local = new Object();
  let compSourceOption_local = new Object();
  let compVar_local = new Object();
  let compSourceQuestion_local = new Object();

  const loopTemplate = element => {
    let el_len = element.length;

    for (let i = 0; i < el_len; i++) {
      let obj = element[i];

      if (obj.componentEnable !== undefined) {
        obj.componentEnable.forEach(item => {
          let itemKeyBased = item.split('@')[0].split('#')[0];

          if (!(itemKeyBased in compEnableMap_local)) {
            compEnableMap_local[itemKeyBased] = new Object();
          }

          if (!(item in compEnableMap_local[itemKeyBased])) {
            compEnableMap_local[itemKeyBased][item] = [];
          }

          if (!compEnableMap_local[itemKeyBased][item].includes(obj.dataKey)) {
            compEnableMap_local[itemKeyBased][item].push(obj.dataKey);
          }
        });
      }

      if (obj.sourceOption !== undefined) {
        if (!(obj.sourceOption.split('@')[0] in compSourceOption_local)) {
          compSourceOption_local[obj.sourceOption.split('@')[0]] = [];
        }

        if (!compSourceOption_local[obj.sourceOption.split('@')[0]].includes(obj.dataKey)) {
          compSourceOption_local[obj.sourceOption.split('@')[0]].push(obj.dataKey);
        }
      }

      if (obj.componentVar !== undefined && obj.type === 4) {
        obj.componentVar.forEach(item => {
          if (!(item in compVar_local)) {
            compVar_local[item] = [];
          }

          if (!compVar_local[item].includes(obj.dataKey)) {
            compVar_local[item].push(obj.dataKey);
          }
        });
      }

      if (obj.sourceQuestion !== undefined && obj.type === 2) {
        if (!(obj.sourceQuestion in compSourceQuestion_local)) {
          compSourceQuestion_local[obj.sourceQuestion] = [];
        }

        if (!compSourceQuestion_local[obj.sourceQuestion].includes(obj.dataKey)) {
          compSourceQuestion_local[obj.sourceQuestion].push(obj.dataKey);
        }
      }

      element[i].components && element[i].components.forEach((element, index) => loopTemplate(element));
    }
  };

  template.details.components.forEach((element, index) => loopTemplate(element));

  for (let index = 0; index < validation.details.testFunctions.length; index++) {
    let obj = validation.details.testFunctions[index];

    if (obj.componentValidation !== undefined) {
      obj.componentValidation.forEach(item => {
        if (!(item in compValidMap_local)) {
          compValidMap_local[item] = [];
        }

        compValidMap_local[item].push(obj.dataKey);
      });
    }
  }

  setCompEnableMap(compEnableMap_local);
  setCompValidMap(compValidMap_local);
  setCompSourceOptionMap(compSourceOption_local);
  setCompVarMap(compVar_local);
  setCompSourceQuestionMap(compSourceQuestion_local); // console.log(compEnableMap())
  // console.log(compValidMap())
  // console.log(compSourceOptionMap())
  // console.log(compVarMap())
  // console.log(compSourceQuestionMap())

  if (reference_local === null) {
    reference_local = JSON.parse(JSON.stringify(reference.details));
  }

  loadReferenceMap(reference_local);
} //make referenceMap, referenceMap is index, etc of component by datakey save as dictionary

function loadReferenceMap(reference_local = null) {
  // console.time('loadReferenceMap');
  if (reference_local === null) {
    reference_local = JSON.parse(JSON.stringify(reference.details));
  }

  let reference_map_local = new Object();

  for (let index__ = 0; index__ < reference_local.length; index__++) {
    let fullDataKey = reference_local[index__].dataKey;

    if (!(fullDataKey in reference_map_local)) {
      reference_map_local[fullDataKey] = [[], []];
    }

    reference_map_local[fullDataKey][0].push(index__);
    reference_map_local[fullDataKey][1].push(fullDataKey);
    let splitDataKey = fullDataKey.split('#');

    if (splitDataKey.length > 1) {
      if (!(splitDataKey[0] in reference_map_local)) {
        reference_map_local[splitDataKey[0]] = [[], []];
      }

      reference_map_local[splitDataKey[0]][1].push(fullDataKey);
    }
  }

  setReferenceMap(reference_map_local); // console.timeEnd('loadReferenceMap');
}
function get_CompEnable(dataKey) {
  let itemKeyBased = dataKey.split('@')[0].split('#')[0];
  let returnDataKey = [];

  if (itemKeyBased in compEnableMap()) {
    for (let key_comp in compEnableMap()[itemKeyBased]) {
      compEnableMap()[itemKeyBased][key_comp].forEach(element_item => {
        let list_key = referenceIndexLookup(element_item, 1);

        if (list_key !== -1 && list_key) {
          list_key.forEach(objChild => {
            let newDataKey = '';
            let tmpDataKey = key_comp.split('@');
            let splitDataKey = objChild.split('@')[0].split('#');
            let splLength = splitDataKey.length;

            if (splLength > 0) {
              splitDataKey[0] = itemKeyBased;
            }

            switch (tmpDataKey[1]) {
              case '$ROW$':
                {
                  newDataKey = splitDataKey.join('#');
                  break;
                }

              case '$ROW1$':
                {
                  if (splLength > 2) splitDataKey.length = splLength - 1;
                  newDataKey = splitDataKey.join('#');
                  break;
                }

              case '$ROW2$':
                {
                  if (splLength > 3) splitDataKey.length = splLength - 2;
                  newDataKey = splitDataKey.join('#');
                  break;
                }

              default:
                {
                  newDataKey = key_comp;
                  break;
                }
            }

            if (newDataKey === dataKey) {
              returnDataKey.push(objChild);
            }
          });
        }
      });
    }
  }

  return returnDataKey;
}
function get_CompValid(dataKey) {
  let itemKeyBased = dataKey.split('@')[0].split('#')[0];
  let returnDataKey = [];

  if (itemKeyBased in compValidMap()) {
    if (compValidMap()[itemKeyBased].length > 0) {
      compValidMap()[itemKeyBased].forEach(item => {
        let list_key = referenceIndexLookup(item, 1);

        if (list_key !== -1 && list_key) {
          returnDataKey = returnDataKey.concat(list_key);
        }
      });
    }
  }

  return returnDataKey;
}
function addHistory(type, datakey, position, attributeParam, data) {
  if (!referenceHistoryEnable()) {
    return;
  }

  if (type === "update_sidebar") {
    if (sidebarHistory().length === 0) {
      setSidebarHistory(data);
    }
  } else {
    setReferenceHistory([...referenceHistory(), {
      'type': type,
      'datakey': datakey,
      'position': position,
      'attributeParam': attributeParam,
      'data': data
    }]);
  }
}
function reloadDataFromHistory() {
  let detail_local = JSON.parse(JSON.stringify(reference.details));

  for (let index_history = referenceHistory().length - 1; index_history >= 0; index_history--) {
    let type = referenceHistory()[index_history]['type'];
    let datakey = referenceHistory()[index_history]['datakey'];
    let position = referenceHistory()[index_history]['position'];
    let attributeParam = referenceHistory()[index_history]['attributeParam'];
    let data = referenceHistory()[index_history]['data'];

    if (type === "insert_ref_detail") {
      for (let index_local = data.length - 1; index_local >= 0; index_local--) {
        let item_post = data[index_local]['pos'];

        if (detail_local[data[index_local]['pos']].dataKey !== data[index_local]['data']) {
          let refPostion = detail_local.findIndex(element => {
            element.dataKey === data[index_local]['data'];
          });
          item_post = refPostion;
        }

        if (item_post !== -1) {
          detail_local.splice(item_post, 1);
        }
      }
    } else if (type === "delete_ref_detail") {
      for (let index_local = data.length - 1; index_local >= 0; index_local--) {
        let item_post = data[index_local]['pos'];
        detail_local.splice(item_post, 0, JSON.parse(JSON.stringify(data[index_local]['data'])));
      }
    } else if (type === 'saveAnswer') {
      if (detail_local[position].dataKey !== datakey) {
        let refPostion = detail_local.findIndex(element => {
          element.dataKey === datakey;
        });
        position = refPostion;
      }

      if (position !== -1) {
        if (attributeParam === 'answer') {
          detail_local[position][attributeParam] = data;
        } else if (attributeParam === 'enable') {
          detail_local[position][attributeParam] = data;
        } else if (attributeParam === 'validate') {
          detail_local[position]['validationState'] = data['validationState'];
          detail_local[position]['validationMessage'] = JSON.parse(JSON.stringify(data['validationMessage']));
        }
      }
    }
  }

  loadReferenceMap(detail_local);
  setReference('details', detail_local);

  if (sidebarHistory().length > 0) {
    setSidebar('details', JSON.parse(JSON.stringify(sidebarHistory())));
  }
}
const toastInfo$1 = (text, duration, position, bgColor) => {
  Toastify({
    text: text == '' ? locale.details.language[0].componentDeleted : text,
    duration: duration >= 0 ? duration : 500,
    gravity: "top",
    position: position == '' ? "right" : position,
    stopOnFocus: true,
    className: bgColor == '' ? "bg-blue-600/80" : bgColor,
    style: {
      background: "rgba(8, 145, 178, 0.7)",
      width: "400px"
    }
  }).showToast();
};
/**
 * Handle additional PAPI input validation
 */

const focusFirstInput = () => {
  const elem = document.querySelector("input:not(.hidden-input):not(:disabled),textarea:not(.hidden-input):not(:disabled)");
  elem?.focus();
};
const refocusLastSelector = () => {
  if (input.currentDataKey !== "") {
    const lastElement = document.querySelector(`[name="${input.currentDataKey}"]`);

    if (lastElement) {
      lastElement?.focus();
    } else {
      focusFirstInput();
    }
  }
};
const scrollCenterInput = (elem, container) => {
  if (container == null) {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      container = document.querySelector(".mobile-component-div");
    } else {
      container = document.querySelector(".component-div");
    }
  }

  let center = container.clientHeight / 2;
  let top = elem.offsetTop;
  let middle = container.clientWidth / 2;
  let left = elem.offsetLeft;

  if (left > middle || top > center) {
    container.scrollTo({
      top: top - center,
      left: left - middle,
      behavior: "smooth"
    });
  }
};
const validateDateString = date => {
  const dateObject = new Date(date);
  const isValidDate = dateObject.toString() != "Invalid Date" && !isNaN(dateObject);
  return isValidDate;
};
const templating = (template, data) => {
  return template.replace(/\$(\w*)/g, function (m, key) {
    return data.hasOwnProperty(key) ? data[key] : "";
  });
};
const findSumCombination = (number, listNumbers) => {
  let sumCombination = [];
  const sortedNumbers = listNumbers.sort(function (a, b) {
    return b - a;
  });

  if (listNumbers.includes(number)) {
    sumCombination.push(number);
  } else {
    let remaining = number;

    for (let i = 0; i < sortedNumbers.length; i++) {
      if (sortedNumbers[i] <= remaining) {
        sumCombination.push(sortedNumbers[i]);
        remaining -= sortedNumbers[i];
      }
    }

    if (remaining !== 0) {
      sumCombination = [];
    }
  }

  return sumCombination;
};
const sum = arr => {
  return arr.reduce((sum, it) => Number(sum) + Number(it), 0);
};
const transformCheckboxOptions = options => {
  return options.map((option, index) => ({
    ...option,
    checkboxValue: Math.pow(2, index)
  }));
};

const _tmpl$$M = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$A = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$y = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$v = /*#__PURE__*/template$1(`<div class=""><div></div></div>`),
  _tmpl$5$s = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$6$s = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.50] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"></div></div>`),
  _tmpl$7$s = /*#__PURE__*/template$1(`<div class=" w-full mx-auto col-span-12"><div class="animate-pulse flex space-x-4"><div class="flex-1 space-y-3 py-1"><div class="h-3 bg-gray-100 rounded-full"></div><div class="h-3 bg-gray-100 rounded-full"></div><div class="h-3 bg-gray-100 rounded-full"></div></div></div></div>`),
  _tmpl$8$o = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$d = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$c = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const SelectInput$1 = props => {
  const [label, setLabel] = createSignal('');
  const [isLoading, setLoading] = createSignal(false);
  const [options, setOptions] = createSignal([]);
  const [selectedOption, setSelectedOption] = createSignal('');
  const isPublic = false;
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);

  const toastInfo = text => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: "bg-pink-700/80",
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  switch (props.component.typeOption) {
    case 1:
      {
        try {
          let options = props.component.options.map((item, value) => {
            return {
              value: item.value,
              label: item.label
            };
          });
          let checker = props.value ? props.value != '' ? props.value[0].value : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : '';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 2:
      {
        try {
          if (config.lookupMode === 1) {
            let url;
            let params;
            let urlHead;
            let urlParams;

            if (!isPublic) {
              params = props.component.sourceSelect; // url = `${config.baseUrl}/${params[0].id}`

              url = `${config.baseUrl}/${params[0].id}/filter?version=${params[0].version}`;

              if (params[0].parentCondition.length > 0) {
                urlHead = url;
                urlParams = params[0].parentCondition.map((item, index) => {
                  let newParams = item.value.split('@');
                  let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                  if (tobeLookup.answer) {
                    if (tobeLookup.answer.length > 0) {
                      let parentValue = encodeURI(tobeLookup.answer[tobeLookup.answer.length - 1].value);
                      url = `${config.lookupKey}=${item.key}&${config.lookupValue}=${parentValue}`;
                    }
                  } else {
                    url = `${config.lookupKey}=${item.key}&${config.lookupValue}=''`;
                  }

                  return url;
                }).join('&'); // url = `${urlHead}?${urlParams}`

                url = `${urlHead}&${urlParams}`;
              }
            } // console.log('Lookup URL ', url)


            const [fetched] = createResource(url, props.MobileOnlineSearch);
            let checker = props.value ? props.value != '' ? props.value[0].value : '' : '';
            createEffect(() => {
              setLabel(props.component.label);

              if (fetched()) {
                if (!fetched().success) {
                  toastInfo(locale.details.language[0].fetchFailed);
                } else {
                  let arr;

                  if (!isPublic) {
                    arr = []; // let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
                    // let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)

                    let cekValue = params[0].value;
                    let cekLabel = params[0].desc; // fetched().data.data.map((item, value) => {
                    //     arr.push(
                    //         {
                    //             value: item[cekValue],
                    //             label: item[cekLabel],
                    //         }
                    //     )
                    // })

                    fetched().data.map((item, value) => {
                      arr.push({
                        value: item[cekValue],
                        label: item[cekLabel]
                      });
                    });
                  }

                  let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : '';
                  setOptions(arr);
                  setSelectedOption(ans);
                  setLoading(true);
                }
              }
            });
          } else if (config.lookupMode === 2) {
            let params;
            let tempArr = [];
            params = props.component.sourceSelect;
            let id = params[0].id;
            let version = params[0].version;

            if (params[0].parentCondition.length > 0) {
              params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = tobeLookup.answer[tobeLookup.answer.length - 1].value.toString();
                    tempArr.push({
                      "key": item.key,
                      "value": parentValue
                    });
                  }
                }
              });
            } // console.log('id : ', id)
            // console.log('version : ', version)
            // console.log('kondisi : ', tempArr)


            let getResult = result => {
              let arr = [];

              if (result.data.length > 0) {
                let cekValue = params[0].value;
                let cekLabel = params[0].desc;
                let checker = props.value ? props.value != '' ? props.value[0].value : '' : '';
                result.data.map((item, value) => {
                  arr.push({
                    value: item[cekValue],
                    label: item[cekLabel]
                  });
                });
                let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : '';
                setLabel(props.component.label);
                setOptions(arr);
                setSelectedOption(ans);
                setLoading(true);
              }
            };

            const fetched = props.MobileOfflineSearch(id, version, tempArr, getResult); // let checker = props.value ? props.value != '' ? props.value[0].value : '' : ''
            // createEffect(() => {
            //     setLabel(props.component.label)
            //     if (fetched()) {
            //         if (!fetched().success) {
            //             toastInfo(locale.details.language[0].fetchFailed)
            //         } else {
            //             let arr
            //             if (!isPublic) {
            //                 arr = []
            //                 let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
            //                 let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)
            // let cekValue = params[0].value
            // let cekLabel = params[0].desc
            // fetched().data.data.map((item, value) => {
            //     arr.push(
            //         {
            //             value: item[cekValue],
            //             label: item[cekLabel],
            //         }
            //     )
            // })
            // fetched().data.map((item, value) => {
            //     arr.push(
            //         {
            //             value: item[cekValue],
            //             label: item[cekLabel],
            //         }
            //     )
            // })
            //         } else {
            //             arr = fetched().data
            //         }
            //         let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : ''
            //         setOptions(arr)
            //         setSelectedOption(ans)
            //         setLoading(true)
            //     }
            // }
            // })
          }
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 3:
      {
        try {
          let optionsSource;
          let finalOptions;
          let checker = props.value ? props.value != '' ? props.value[0].value : '' : '';

          if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
            const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === props.component.sourceOption);

            if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
              optionsSource = reference.details[componentAnswerIndex].answer;

              if (optionsSource != undefined) {
                finalOptions = optionsSource.filter((item, value) => item.value != 0).map((item, value) => {
                  return {
                    value: item.value,
                    label: item.label
                  };
                });
              } else {
                finalOptions = [];
              }
            }
          }

          let ans = finalOptions.find(obj => obj.value == checker) && checker != '' ? finalOptions.find(obj => obj.value == checker).label : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(finalOptions);
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    default:
      {
        try {
          let options;

          if (props.component.options) {
            options = props.component.options.map((item, value) => {
              return {
                value: item.value,
                label: item.label
              };
            });
          } else {
            options = [];
          }

          let checker = props.value ? props.value != '' ? props.value[0].value : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : '';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }
  }

  let checkDependent = parentKey => {
    reference.details.map(ref => {
      if (ref.sourceSelect) {
        if (ref.sourceSelect.length > 0) {
          if (ref.sourceSelect[0].parentCondition.length > 0) {
            let check = ref.sourceSelect[0].parentCondition;
            check.map(child => {
              if (child.value == parentKey && ref.answer != null) {
                // console.log('this ', ref)
                let sidePosition = sidebar$1.details.findIndex((obj, index) => {
                  const cekInsideIndex = obj.components[0].findIndex((objChild, index) => {
                    objChild.dataKey === ref.dataKey;
                    return index;
                  });
                  return cekInsideIndex == -1 ? 0 : index;
                });
                saveAnswer(ref.dataKey, 'answer', null, sidePosition, {
                  'clientMode': config.clientMode,
                  'baseUrl': config.baseUrl
                }, 0);
                checkDependent(ref.dataKey);
              } else {
                return;
              }
            });
          }
        }
      }
    });
  };

  let handleOnChange = (value, label) => {
    if (value != '' && value != undefined) {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        label: label
      });
      props.onValueChange(updatedAnswer);
      checkDependent(props.component.dataKey);
    }
  }; // console.log('valueny sekarang : ', props)


  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$6$s.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$M.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$A.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$y.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return isLoading();
      },

      get fallback() {
        return _tmpl$7$s.cloneNode(true);
      },

      get children() {
        return [(() => {
          const _el$10 = _tmpl$4$v.cloneNode(true),
            _el$11 = _el$10.firstChild;

          insert(_el$11, createComponent$1(Select, mergeProps({
            "class": "formgear-select w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          }, () => createOptions(options() || [], {
            key: "label",
            filterable: true
          }), {
            get disabled() {
              return disableInput();
            },

            onChange: e => handleOnChange(e ? e.value : '', e ? e.label : ''),

            get initialValue() {
              return {
                value: props.value ? props.value != '' ? props.value[0].value : '' : '',
                label: selectedOption
              };
            }

          })));

          insert(_el$10, createComponent$1(Show, {
            get when() {
              return props.validationMessage.length > 0;
            },

            get children() {
              return createComponent$1(For, {
                get each() {
                  return props.validationMessage;
                },

                children: item => (() => {
                  const _el$17 = _tmpl$10$c.cloneNode(true),
                    _el$18 = _el$17.firstChild,
                    _el$21 = _el$18.firstChild;

                  insert(_el$18, createComponent$1(Switch, {
                    get children() {
                      return [createComponent$1(Match, {
                        get when() {
                          return props.classValidation === 1;
                        },

                        get children() {
                          return _tmpl$8$o.cloneNode(true);
                        }

                      }), createComponent$1(Match, {
                        get when() {
                          return props.classValidation === 2;
                        },

                        get children() {
                          return _tmpl$9$d.cloneNode(true);
                        }

                      })];
                    }

                  }), _el$21);

                  _el$21.innerHTML = item;

                  createRenderEffect(_$p => classList(_el$18, {
                    ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
                    ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
                  }, _$p));

                  return _el$17;
                })()
              });
            }

          }), null);

          createRenderEffect(_p$ => {
            const _v$ = {
              'col-span-11 lg:-mr-4': enableRemark(),
              'col-span-12': !enableRemark()
            },
              _v$2 = {
                ' border rounded border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
                ' border rounded border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
              };
            _p$._v$ = classList(_el$10, _v$, _p$._v$);
            _p$._v$2 = classList(_el$11, _v$2, _p$._v$2);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined
          });

          return _el$10;
        })(), createComponent$1(Show, {
          get when() {
            return enableRemark();
          },

          get children() {
            const _el$12 = _tmpl$5$s.cloneNode(true),
              _el$13 = _el$12.firstChild,
              _el$14 = _el$13.firstChild,
              _el$15 = _el$14.nextSibling;

            _el$13.$$click = e => props.openRemark(props.component.dataKey);

            insert(_el$15, () => props.comments);

            createRenderEffect(_p$ => {
              const _v$3 = disableClickRemark(),
                _v$4 = props.comments === 0;

              _v$3 !== _p$._v$3 && (_el$13.disabled = _p$._v$3 = _v$3);
              _v$4 !== _p$._v$4 && _el$15.classList.toggle("hidden", _p$._v$4 = _v$4);
              return _p$;
            }, {
              _v$3: undefined,
              _v$4: undefined
            });

            return _el$12;
          }

        })];
      }

    }));

    createRenderEffect(() => _el$4.innerHTML = label());

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$L = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$z = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$x = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$u = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder="">`),
  _tmpl$5$r = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder="" oninput="javascript: if (this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);">`),
  _tmpl$6$r = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$7$r = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3  p-2 border-b border-gray-300/[.40] dark:border-gray-200/[.10]"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""></div></div></div>`),
  _tmpl$8$n = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$c = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$b = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const NumberInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$7$r.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$L.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$z.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$x.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput === undefined;
      },

      get children() {
        const _el$11 = _tmpl$4$u.cloneNode(true);

        _el$11.addEventListener("change", e => {
          props.onValueChange(parseInt(e.currentTarget.value));
        });

        createRenderEffect(_p$ => {
          const _v$ = props.value,
            _v$2 = props.component.dataKey,
            _v$3 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$4 = disableInput();

          _v$ !== _p$._v$ && (_el$11.value = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$11, "name", _p$._v$2 = _v$2);
          _p$._v$3 = classList(_el$11, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$11.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$11;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
      },

      get children() {
        const _el$12 = _tmpl$5$r.cloneNode(true);

        _el$12.addEventListener("change", e => {
          props.onValueChange(parseInt(e.currentTarget.value));
        });

        createRenderEffect(_p$ => {
          const _v$5 = props.value,
            _v$6 = props.component.dataKey,
            _v$7 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$8 = disableInput(),
            _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
            _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '',
            _v$11 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
            _v$12 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

          _v$5 !== _p$._v$5 && (_el$12.value = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && setAttribute(_el$12, "name", _p$._v$6 = _v$6);
          _p$._v$7 = classList(_el$12, _v$7, _p$._v$7);
          _v$8 !== _p$._v$8 && (_el$12.disabled = _p$._v$8 = _v$8);
          _v$9 !== _p$._v$9 && setAttribute(_el$12, "maxlength", _p$._v$9 = _v$9);
          _v$10 !== _p$._v$10 && setAttribute(_el$12, "minlength", _p$._v$10 = _v$10);
          _v$11 !== _p$._v$11 && setAttribute(_el$12, "max", _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && setAttribute(_el$12, "min", _p$._v$12 = _v$12);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined,
          _v$7: undefined,
          _v$8: undefined,
          _v$9: undefined,
          _v$10: undefined,
          _v$11: undefined,
          _v$12: undefined
        });

        return _el$12;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$17 = _tmpl$10$b.cloneNode(true),
              _el$18 = _el$17.firstChild,
              _el$21 = _el$18.firstChild;

            insert(_el$18, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$n.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$c.cloneNode(true);
                  }

                })];
              }

            }), _el$21);

            _el$21.innerHTML = item;

            createRenderEffect(_$p => classList(_el$18, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$17;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$6$r.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$13 = disableClickRemark(),
            _v$14 = props.comments === 0;

          _v$13 !== _p$._v$13 && (_el$14.disabled = _p$._v$13 = _v$13);
          _v$14 !== _p$._v$14 && _el$16.classList.toggle("hidden", _p$._v$14 = _v$14);
          return _p$;
        }, {
          _v$13: undefined,
          _v$14: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$15 = props.component.label,
        _v$16 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        };
      _v$15 !== _p$._v$15 && (_el$4.innerHTML = _p$._v$15 = _v$15);
      _p$._v$16 = classList(_el$10, _v$16, _p$._v$16);
      return _p$;
    }, {
      _v$15: undefined,
      _v$16: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$K = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$y = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$w = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$t = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
									text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$q = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.50] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><div class="cursor-pointer"><div class="grid font-light text-sm col-span-2 content-start"></div></div></div></div></div>`),
  _tmpl$6$q = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1"><label class="cursor-pointer text-sm"><input class="appearance-none h-4 w-4 border 
                                                            border-gray-300 rounded-sm bg-white 
                                                            checked:bg-blue-600 checked:border-blue-600 
                                                            focus:outline-none transition duration-200 align-top 
                                                            bg-no-repeat bg-center bg-contain float-left mr-2 cursor-pointer" type="checkbox"></label></div><div class="col-span-11"><input type="text" class="w-full
                                                            font-light
                                                            px-4
                                                            py-2.5
                                                            text-sm
                                                            text-gray-700
                                                            bg-white bg-clip-padding
                                                            border border-solid border-gray-300
                                                            rounded
                                                            transition
                                                            ease-in-out
                                                            m-0
                                                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"></div></div>`),
  _tmpl$7$q = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1"><label class="cursor-pointer text-sm"><input class=" appearance-none h-4 w-4 border 
                                                                border-gray-300 rounded-sm bg-white 
                                                                checked:bg-blue-600 checked:border-blue-600 
                                                                focus:outline-none transition duration-200 mt-1 align-top 
                                                                bg-no-repeat bg-center bg-contain float-left mr-2 cursor-pointer
                                                                checked:disabled:bg-gray-500 checked:dark:disabled:bg-gray-300 
                                                                disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" type="checkbox"></label></div><div class="col-span-11"></div></div>`),
  _tmpl$8$m = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$b = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$a = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const CheckboxInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);

  let handleOnChange = (value, label, open) => {
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));

    if (props.value) {
      if (props.value.some(d => String(d.value) === String(value))) {
        if (open) {
          let valueIndex = options().findIndex(item => item.value == value);
          updatedAnswer = updatedAnswer.filter(item => item.value != value);
          if (options()[valueIndex].label !== label) updatedAnswer.push({
            value: value,
            label: label,
            open: true
          });
        } else {
          updatedAnswer = updatedAnswer.filter(item => item.value != value);
        }
      } else {
        updatedAnswer.splice(updatedAnswer.length, 0, {
          value: value,
          label: label
        });
      }
    } else {
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        label: label
      });
    }

    props.onValueChange(updatedAnswer);
  };

  let handleLabelClick = index => {
    let id = "checkbox-" + props.component.dataKey + "-" + index;
    document.getElementById(id).click();
  };

  let tick = value => {
    return props.value ? props.value.some(d => String(d.value) === String(value)) ? true : false : false;
  };

  let optionLabel = value => {
    let optionIndex = props.value.findIndex(d => String(d.value) === String(value));
    return props.value[optionIndex].label;
  };

  let getOptions = createMemo(() => {
    if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
      let newSourceOption = props.component.sourceOption.split('@');
      const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === newSourceOption[0]);

      if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
        return reference.details[componentAnswerIndex].answer;
      }
    }

    return [];
  });
  const [options] = createSignal(props.component.sourceOption !== undefined ? getOptions() : props.component.options);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$q.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild,
      _el$12 = _el$11.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$K.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$y.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$w.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$12, createComponent$1(For, {
      get each() {
        return options();
      },

      children: (item, index) => createComponent$1(Switch, {
        get children() {
          return [createComponent$1(Match, {
            get when() {
              return memo(() => !!item.open, true)() && tick(item.value);
            },

            get children() {
              const _el$17 = _tmpl$6$q.cloneNode(true),
                _el$18 = _el$17.firstChild,
                _el$19 = _el$18.firstChild,
                _el$20 = _el$19.firstChild,
                _el$21 = _el$18.nextSibling,
                _el$22 = _el$21.firstChild;

              _el$20.addEventListener("change", e => handleOnChange(e.currentTarget.value, item.label, item.open));

              _el$22.addEventListener("change", e => handleOnChange(item.value, e.currentTarget.value, item.open));

              createRenderEffect(_p$ => {
                const _v$11 = "chexbox" + index(),
                  _v$12 = item.value,
                  _v$13 = item.value ? tick(item.value) : false,
                  _v$14 = "checkbox-" + props.component.dataKey + "-" + index(),
                  _v$15 = optionLabel(item.value);

                _v$11 !== _p$._v$11 && setAttribute(_el$19, "for", _p$._v$11 = _v$11);
                _v$12 !== _p$._v$12 && (_el$20.value = _p$._v$12 = _v$12);
                _v$13 !== _p$._v$13 && (_el$20.checked = _p$._v$13 = _v$13);
                _v$14 !== _p$._v$14 && setAttribute(_el$20, "id", _p$._v$14 = _v$14);
                _v$15 !== _p$._v$15 && (_el$22.value = _p$._v$15 = _v$15);
                return _p$;
              }, {
                _v$11: undefined,
                _v$12: undefined,
                _v$13: undefined,
                _v$14: undefined,
                _v$15: undefined
              });

              return _el$17;
            }

          }), createComponent$1(Match, {
            get when() {
              return !item.open || !tick(item.value);
            },

            get children() {
              const _el$23 = _tmpl$7$q.cloneNode(true),
                _el$24 = _el$23.firstChild,
                _el$25 = _el$24.firstChild,
                _el$26 = _el$25.firstChild,
                _el$27 = _el$24.nextSibling;

              _el$23.$$click = e => handleLabelClick(index());

              _el$26.addEventListener("change", e => handleOnChange(e.currentTarget.value, item.label, item.open));

              createRenderEffect(_p$ => {
                const _v$16 = disableInput(),
                  _v$17 = item.value,
                  _v$18 = item.value ? tick(item.value) : false,
                  _v$19 = "checkbox-" + props.component.dataKey + "-" + index(),
                  _v$20 = item.label;

                _v$16 !== _p$._v$16 && (_el$26.disabled = _p$._v$16 = _v$16);
                _v$17 !== _p$._v$17 && (_el$26.value = _p$._v$17 = _v$17);
                _v$18 !== _p$._v$18 && (_el$26.checked = _p$._v$18 = _v$18);
                _v$19 !== _p$._v$19 && setAttribute(_el$26, "id", _p$._v$19 = _v$19);
                _v$20 !== _p$._v$20 && (_el$27.innerHTML = _p$._v$20 = _v$20);
                return _p$;
              }, {
                _v$16: undefined,
                _v$17: undefined,
                _v$18: undefined,
                _v$19: undefined,
                _v$20: undefined
              });

              return _el$23;
            }

          })];
        }

      })
    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$28 = _tmpl$10$a.cloneNode(true),
              _el$29 = _el$28.firstChild,
              _el$32 = _el$29.firstChild;

            insert(_el$29, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$m.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$b.cloneNode(true);
                  }

                })];
              }

            }), _el$32);

            _el$32.innerHTML = item;

            createRenderEffect(_$p => classList(_el$29, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$28;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$4$t.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$14.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$16.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        },
        _v$6 = props.component.cols === 1 || props.component.cols === undefined,
        _v$7 = props.component.cols === 2,
        _v$8 = props.component.cols === 3,
        _v$9 = props.component.cols === 4,
        _v$10 = props.component.cols === 5;

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _p$._v$5 = classList(_el$11, _v$5, _p$._v$5);
      _v$6 !== _p$._v$6 && _el$12.classList.toggle("grid-cols-1", _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && _el$12.classList.toggle("grid-cols-2", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && _el$12.classList.toggle("grid-cols-3", _p$._v$8 = _v$8);
      _v$9 !== _p$._v$9 && _el$12.classList.toggle("grid-cols-4", _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && _el$12.classList.toggle("grid-cols-5", _p$._v$10 = _v$10);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$J = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$x = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$v = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$s = /*#__PURE__*/template$1(`<textarea class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"></textarea>`),
  _tmpl$5$p = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$6$p = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""></div></div></div>`),
  _tmpl$7$p = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$8$l = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$9$a = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const TextAreaInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$6$p.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$J.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$x.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$v.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput === undefined;
      },

      get children() {
        const _el$11 = _tmpl$4$s.cloneNode(true);

        _el$11.addEventListener("change", e => {
          props.onValueChange(e.currentTarget.value);
        });

        createRenderEffect(_p$ => {
          const _v$ = props.value,
            _v$2 = props.component.rows || 2,
            _v$3 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$4 = disableInput();

          _v$ !== _p$._v$ && (_el$11.value = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$11, "rows", _p$._v$2 = _v$2);
          _p$._v$3 = classList(_el$11, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$11.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$11;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
      },

      get children() {
        const _el$12 = _tmpl$4$s.cloneNode(true);

        _el$12.addEventListener("change", e => {
          props.onValueChange(e.currentTarget.value);
        });

        createRenderEffect(_p$ => {
          const _v$5 = props.value,
            _v$6 = props.component.rows || 2,
            _v$7 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$8 = disableInput(),
            _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
            _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

          _v$5 !== _p$._v$5 && (_el$12.value = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && setAttribute(_el$12, "rows", _p$._v$6 = _v$6);
          _p$._v$7 = classList(_el$12, _v$7, _p$._v$7);
          _v$8 !== _p$._v$8 && (_el$12.disabled = _p$._v$8 = _v$8);
          _v$9 !== _p$._v$9 && setAttribute(_el$12, "maxlength", _p$._v$9 = _v$9);
          _v$10 !== _p$._v$10 && setAttribute(_el$12, "minlength", _p$._v$10 = _v$10);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined,
          _v$7: undefined,
          _v$8: undefined,
          _v$9: undefined,
          _v$10: undefined
        });

        return _el$12;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$17 = _tmpl$9$a.cloneNode(true),
              _el$18 = _el$17.firstChild,
              _el$21 = _el$18.firstChild;

            insert(_el$18, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$7$p.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$8$l.cloneNode(true);
                  }

                })];
              }

            }), _el$21);

            _el$21.innerHTML = item;

            createRenderEffect(_$p => classList(_el$18, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$17;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$5$p.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$11 = disableClickRemark(),
            _v$12 = props.comments === 0;

          _v$11 !== _p$._v$11 && (_el$14.disabled = _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && _el$16.classList.toggle("hidden", _p$._v$12 = _v$12);
          return _p$;
        }, {
          _v$11: undefined,
          _v$12: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$13 = props.component.label,
        _v$14 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        };
      _v$13 !== _p$._v$13 && (_el$4.innerHTML = _p$._v$13 = _v$13);
      _p$._v$14 = classList(_el$10, _v$14, _p$._v$14);
      return _p$;
    }, {
      _v$13: undefined,
      _v$14: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$I = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$w = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$u = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$r = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$o = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="email" placeholder=""></div></div></div>`),
  _tmpl$6$o = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$o = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$k = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const EmailInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let classInput = 'w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400';
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$o.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$I.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$w.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$u.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$k.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$o.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$o.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$r.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = classInput + props.classValidation,
        _v$8 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$9 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && (_el$11.className = _p$._v$7 = _v$7);
      _p$._v$8 = classList(_el$11, _v$8, _p$._v$8);
      _v$9 !== _p$._v$9 && (_el$11.disabled = _p$._v$9 = _v$9);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$H = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$v = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$t = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$q = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$n = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="url" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$n = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$n = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$j = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const UrlInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$n.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$H.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$v.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$t.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$j.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$n.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$n.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$q.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$G = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$u = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$s = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$p = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$m = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="date" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$m = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$m = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$i = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const DateInput$2 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  let today = new Date();
  let dd = String(today.getDate());
  let mm = String(today.getMonth() + 1); //January is 0!

  let yyyy = String(today.getFullYear());

  if (Number(dd) < 10) {
    dd = '0' + dd;
  }

  if (Number(mm) < 10) {
    mm = '0' + mm;
  }

  let todayDate = yyyy + '-' + mm + '-' + dd;
  let minDate, maxDate;
  createMemo(() => {
    if (props.component.rangeInput) {
      minDate = props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min === 'today' ? todayDate : props.component.rangeInput[0].min : '';
      maxDate = props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max === 'today' ? todayDate : props.component.rangeInput[0].max : '';
    }
  });
  return (() => {
    const _el$ = _tmpl$5$m.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$G.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$u.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$s.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    setAttribute(_el$11, "min", minDate);

    setAttribute(_el$11, "max", maxDate);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$i.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$m.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$m.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$p.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$F = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$t = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$r = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$o = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$l = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="datetime-local" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$l = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$l = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$h = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const DateTimeLocalInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  let today = new Date();
  let dd = String(today.getDate());
  let mm = String(today.getMonth() + 1); //January is 0!

  let yyyy = String(today.getFullYear());

  if (Number(dd) < 10) {
    dd = '0' + dd;
  }

  if (Number(mm) < 10) {
    mm = '0' + mm;
  }

  let todayDate = yyyy + '-' + mm + '-' + dd;
  let minDate, maxDate;
  createMemo(() => {
    if (props.component.rangeInput) {
      minDate = props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min === 'today' ? todayDate : props.component.rangeInput[0].min : '';
      maxDate = props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max === 'today' ? todayDate : props.component.rangeInput[0].max : '';
    }
  });
  return (() => {
    const _el$ = _tmpl$5$l.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$F.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$t.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$r.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    setAttribute(_el$11, "min", minDate + 'T00:00');

    setAttribute(_el$11, "max", maxDate + 'T23:59');

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$h.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$l.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$l.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$o.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$E = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$s = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$q = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$n = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$k = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="time" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$k = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$k = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$g = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const TimeInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$k.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$E.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$s.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$q.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$g.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$k.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$k.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$n.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$D = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$r = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$p = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$m = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$j = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="month" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$j = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$j = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$f = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const MonthInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$j.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$D.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$r.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$p.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$f.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$j.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$j.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$m.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$C = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$q = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$o = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$l = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$i = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="week" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$i = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$i = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$e = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const MonthInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$i.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$C.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$q.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$o.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.addEventListener("change", e => {
      props.onValueChange(e.currentTarget.value);
    });

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$e.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$i.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$i.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$l.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$B = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$p = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$n = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$k = /*#__PURE__*/template$1(`<div class="grid grid-cols-12 border-b border-gray-300/[.50] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-x-2 py-2.5 px-2  form-check"><input class=" appearance-none h-4 w-4 border 
                    border-gray-300 rounded-sm bg-white 
                    checked:bg-blue-600 checked:border-blue-600 
                    focus:outline-none transition duration-200 mt-1 align-top 
                    bg-no-repeat bg-center bg-contain float-left mr-2 cursor-pointer" type="checkbox"></div><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-10"><div><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div></div></div>`),
  _tmpl$5$h = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$6$h = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$7$h = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const SingleCheckInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  let handleLabelClick = () => {
    let id = "singlecheck-" + props.component.dataKey + "_id";
    document.getElementById(id).click();
  };

  return (() => {
    const _el$ = _tmpl$4$k.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$2.nextSibling,
      _el$5 = _el$4.firstChild,
      _el$6 = _el$5.firstChild,
      _el$7 = _el$6.firstChild,
      _el$10 = _el$6.nextSibling;

    _el$3.addEventListener("change", e => props.onValueChange(e.target.checked));

    _el$7.$$click = e => handleLabelClick();

    insert(_el$6, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$B.cloneNode(true);
      }

    }), null);

    insert(_el$6, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$9 = _tmpl$2$p.cloneNode(true);

        _el$9.$$click = showInstruction;
        return _el$9;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$11 = _tmpl$3$n.cloneNode(true);

        createRenderEffect(() => _el$11.innerHTML = props.component.hint);

        return _el$11;
      }

    }));

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$12 = _tmpl$7$h.cloneNode(true),
              _el$13 = _el$12.firstChild,
              _el$16 = _el$13.firstChild;

            insert(_el$13, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$5$h.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$6$h.cloneNode(true);
                  }

                })];
              }

            }), _el$16);

            _el$16.innerHTML = item;

            createRenderEffect(_$p => classList(_el$13, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$12;
          })()
        });
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$ = 'singlecheck-' + props.component.dataKey + '_id',
        _v$2 = disableInput(),
        _v$3 = props.value ? props.value : false,
        _v$4 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        },
        _v$5 = props.component.label;

      _v$ !== _p$._v$ && setAttribute(_el$3, "id", _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && (_el$3.disabled = _p$._v$2 = _v$2);
      _v$3 !== _p$._v$3 && (_el$3.checked = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$5, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$7.innerHTML = _p$._v$5 = _v$5);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$A = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$o = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$m = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$j = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-8 grid-cols-8 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-7"><div><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 flex justify-end"><button type="button" class="relative inline-flex flex-shrink-0
                    h-7 w-12 border-2 border-transparent rounded-full
                    cursor-pointer shadow-sm transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                "><span class="relative inline-block h-6 w-6 ring-0
                    rounded-full transform bg-white shadow
                    transition duration-200 ease-in-out pointer-events-none
                    "><span class="absolute inset-0 h-full w-full flex justify-center items-center transition-opacity
                    "><svg class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12"><path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></span><span class=" absolute inset-0 h-full w-full flex items-center justify-center transition-opacity "><svg class="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 12 12"><path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z"></path></svg></span></span></button></div></div>`),
  _tmpl$5$g = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$6$g = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$7$g = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const ToggleInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [val, setVal] = createSignal(props.value !== '' ? props.value : false);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  let handleLabelClick = () => {
    let id = "toggle-" + props.component.dataKey + "_id";
    document.getElementById(id).click();
  };

  return (() => {
    const _el$ = _tmpl$4$j.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.firstChild,
      _el$8 = _el$4.nextSibling,
      _el$10 = _el$2.nextSibling,
      _el$11 = _el$10.firstChild,
      _el$12 = _el$11.firstChild,
      _el$13 = _el$12.firstChild,
      _el$14 = _el$13.nextSibling;

    _el$5.$$click = e => handleLabelClick();

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$A.cloneNode(true);
      }

    }), null);

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$7 = _tmpl$2$o.cloneNode(true);

        _el$7.$$click = showInstruction;
        return _el$7;
      }

    }), null);

    insert(_el$8, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$9 = _tmpl$3$m.cloneNode(true);

        createRenderEffect(() => _el$9.innerHTML = props.component.hint);

        return _el$9;
      }

    }));

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$15 = _tmpl$7$g.cloneNode(true),
              _el$16 = _el$15.firstChild,
              _el$19 = _el$16.firstChild;

            insert(_el$16, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$5$g.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$6$g.cloneNode(true);
                  }

                })];
              }

            }), _el$19);

            _el$19.innerHTML = item;

            createRenderEffect(_$p => classList(_el$16, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$15;
          })()
        });
      }

    }), null);

    _el$11.$$click = e => props.onValueChange(!val());

    createRenderEffect(_p$ => {
      const _v$ = {
        ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
        ' border-b border-pink-600 pb-3 ': props.classValidation === 2
      },
        _v$2 = props.component.label,
        _v$3 = val() === true,
        _v$4 = val() === false,
        _v$5 = 'toggle-' + props.component.dataKey + '_id',
        _v$6 = disableInput(),
        _v$7 = val() === true,
        _v$8 = val() === false,
        _v$9 = {
          'opacity-0 ease-out duration-100': val() === true,
          'opacity-100 ease-in duration-200': val() === false
        },
        _v$10 = {
          'opacity-100 ease-in duration-200': val() === true,
          'opacity-0 ease-out duration-100': val() === false
        };

      _p$._v$ = classList(_el$3, _v$, _p$._v$);
      _v$2 !== _p$._v$2 && (_el$5.innerHTML = _p$._v$2 = _v$2);
      _v$3 !== _p$._v$3 && _el$11.classList.toggle("bg-blue-600", _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && _el$11.classList.toggle("bg-gray-200", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && setAttribute(_el$11, "id", _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && (_el$11.disabled = _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && _el$12.classList.toggle("translate-x-5", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && _el$12.classList.toggle("translate-x-0", _p$._v$8 = _v$8);
      _p$._v$9 = classList(_el$13, _v$9, _p$._v$9);
      _p$._v$10 = classList(_el$14, _v$10, _p$._v$10);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$z = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$n = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$l = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$i = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$f = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><div class=" grid grid-cols-12"><div class="col-span-10"><input type="range" class="
                        form-range
                        w-full
                        font-light
                        px-2
                        text-sm
                        text-gray-700
                        bg-white bg-clip-padding
                        border border-solid border-gray-300
                        rounded
                        transition
                        ease-in-out
                        m-0
                        focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"></div><div class="col-span-1 text-center"></div></div></div></div></div>`),
  _tmpl$6$f = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$f = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$d = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const RangeSliderInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$f.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild,
      _el$12 = _el$11.firstChild,
      _el$13 = _el$12.firstChild,
      _el$14 = _el$12.nextSibling;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$z.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$n.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$l.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$13.addEventListener("change", e => props.onValueChange(e.currentTarget.value));

    insert(_el$14, () => props.value || 0);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$19 = _tmpl$8$d.cloneNode(true),
              _el$20 = _el$19.firstChild,
              _el$23 = _el$20.firstChild;

            insert(_el$20, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$f.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$f.cloneNode(true);
                  }

                })];
              }

            }), _el$23);

            _el$23.innerHTML = item;

            createRenderEffect(_$p => classList(_el$20, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$19;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$15 = _tmpl$4$i.cloneNode(true),
          _el$16 = _el$15.firstChild,
          _el$17 = _el$16.firstChild,
          _el$18 = _el$17.nextSibling;

        _el$16.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$18, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$16.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$18.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$15;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = {
          ' border-b border-orange-500 pb-5 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-5 ': props.classValidation === 2
        },
        _v$6 = props.value || 0,
        _v$7 = props.component.rangeInput[0].min,
        _v$8 = props.component.rangeInput[0].max,
        _v$9 = props.component.rangeInput[0].step,
        _v$10 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _p$._v$5 = classList(_el$11, _v$5, _p$._v$5);
      _v$6 !== _p$._v$6 && (_el$13.value = _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && setAttribute(_el$13, "min", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && setAttribute(_el$13, "max", _p$._v$8 = _v$8);
      _v$9 !== _p$._v$9 && setAttribute(_el$13, "step", _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && (_el$13.disabled = _p$._v$10 = _v$10);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$y = /*#__PURE__*/template$1(`<div></div>`);

const DateInput$1 = props => {
  return (() => {
    const _el$ = _tmpl$$y.cloneNode(true);

    createRenderEffect(() => _el$.innerHTML = props.component.label);

    return _el$;
  })();
};

// src/index.ts
function createDebounce(func, wait) {
  let timeoutId;
  const clear = () => clearTimeout(timeoutId);
  onCleanup(clear);
  const debounced = function (...args) {
    if (timeoutId !== void 0)
      clear();
    timeoutId = setTimeout(() => func(...args), wait);
  };
  return Object.assign(debounced, { clear });
}
var src_default = createDebounce;

const _tmpl$$x = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$m = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$k = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$h = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$e = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="text" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder=""></div></div></div>`),
  _tmpl$6$e = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$e = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$c = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const CurrencyInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);

  let checkFormat = e => {
    let tobeChecked = String.fromCharCode(!e.charCode ? e.which : e.charCode);
    let templ = props.component.separatorFormat === 'id-ID' ? /^\d{1,99}(?:\,\d{0,10})?$/ : /^\d{1,99}(?:\.\d{0,10})?$/;
    let value = document.getElementById('currencyInput' + props.index).value;
    let currentVal = modifier(value);

    if (!templ.test(currentVal + tobeChecked)) {
      e.preventDefault ? e.preventDefault() : e.returnValue = false;
    }
  };

  let handleOnKeyup = src_default(value => {
    let modified = modifier(value);
    let result = props.component.separatorFormat === 'id-ID' ? modified.replace(',', '.') : modified;
    props.onValueChange(result);
  }, 1500);

  let modifier = value => {
    let firstRemoved;
    let allowedChars;

    if (props.component.separatorFormat === 'id-ID') {
      firstRemoved = props.component.isDecimal ? value.indexOf(',00') != -1 ? value.substring(0, value.indexOf(',00')) : value : value.indexOf(',') != -1 ? value.substring(0, value.indexOf(',')) : value;
      allowedChars = "0123456789,";
    } else if (props.component.separatorFormat === 'en-US') {
      firstRemoved = props.component.isDecimal ? value.indexOf('.00') != -1 ? value.substring(0, value.indexOf('.00')) : value : value.indexOf('.') != -1 ? value.substring(0, value.indexOf('.')) : value;
      allowedChars = "0123456789.";
    }

    return Array.from(firstRemoved).filter(f => allowedChars.includes(f)).join('');
  };

  let current = Number(props.value).toLocaleString(props.component.separatorFormat, {
    style: 'currency',
    currency: props.component.currency,
    minimumFractionDigits: 0
  });
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$e.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$x.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$m.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$k.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    _el$11.$$keyup = e => handleOnKeyup(e.currentTarget.value);

    _el$11.addEventListener("keypress", e => checkFormat(e));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$c.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$e.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$e.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$h.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.component.separatorFormat === 'id-ID' ? current.replace(",00", "") : current.replace("IDR", "Rp"),
        _v$6 = props.component.dataKey,
        _v$7 = {
          ' border border-solid border-gray-300 ': props.classValidation === 0,
          ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        },
        _v$8 = disableInput(),
        _v$9 = "currencyInput" + props.index,
        _v$10 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
        _v$11 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "name", _p$._v$6 = _v$6);
      _p$._v$7 = classList(_el$11, _v$7, _p$._v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      _v$9 !== _p$._v$9 && setAttribute(_el$11, "id", _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && setAttribute(_el$11, "max", _p$._v$10 = _v$10);
      _v$11 !== _p$._v$11 && setAttribute(_el$11, "min", _p$._v$11 = _v$11);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined,
      _v$9: undefined,
      _v$10: undefined,
      _v$11: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click", "keyup"]);

const _tmpl$$w = /*#__PURE__*/template$1(`<div class="modal-delete fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="sm:flex sm:items-start"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"><svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalDelete">Deactivate account</h3><div class="mt-2"><p class="text-sm text-gray-500" id="contentModalDelete">Are you sure you want to deactivate your account? All of your data will be permanently removed. This action cannot be undonssse.</p></div></div></div></div><div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">Delete</button><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button></div></div></div></div>`),
  _tmpl$2$l = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$3$j = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$4$g = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$5$d = /*#__PURE__*/template$1(`<div class="grid grid-cols-12 "><div class="col-span-10 mr-2"><input type="text" class="w-full
										font-light
										px-4
										py-2.5
										text-sm
										text-gray-700
										bg-white bg-clip-padding
										border border-solid border-gray-300
										rounded
										transition
										ease-in-out
										m-0
										focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-teal-400 text-white p-2 rounded-full focus:outline-none hover:bg-teal-300  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><button class="bg-gray-500 text-white p-2 rounded-full focus:outline-none hover:bg-gray-400  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$6$d = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-6 p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-5"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 pt-2.5 px-2 flex justify-end "><button class="bg-pink-600 text-white p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-pink-500  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg></button></div></div><div class="grid md:grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm  pb-2.5 px-2 col-start-2 col-end-12 space-y-4 transition-all delay-100"></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$7$d = /*#__PURE__*/template$1(`<div class="grid grid-cols-12"><div class="col-span-10 mr-2"><input type="text" class="w-full
													font-light
													px-4
													py-2.5
													text-sm
													text-gray-700
													bg-white bg-clip-padding
													border border-solid border-gray-300
													rounded
													transition
													ease-in-out
													m-0
													focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-teal-400 text-white p-2 rounded-full focus:outline-none hover:bg-teal-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><button class="bg-gray-500 text-white p-2 rounded-full focus:outline-none hover:bg-gray-400 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$8$b = /*#__PURE__*/template$1(`<div class="grid grid-cols-12"><div class="col-span-10 mr-2"><input type="text" class="w-full
													font-light
													px-4
													py-2.5
													text-sm
													text-gray-700
													bg-gray-200 bg-clip-padding
													dark:bg-gray-300
													border border-solid border-gray-300
													rounded
													transition
													ease-in-out
													m-0
													focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
													disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" disabled></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-orange-400 text-white p-2 rounded-full focus:outline-none hover:bg-orange-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button><button class="bg-red-600 text-white p-2 rounded-full focus:outline-none hover:bg-red-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$9$9 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$10$9 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$11$5 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const ListTextInputRepeat = props => {
  const [flag, setFlag] = createSignal(0); //untuk flag open textinput

  const [edited, setEdited] = createSignal(0); //untuk flag id yg akan diedit

  const [localAnswer, setLocalAnswer] = createSignal(JSON.parse(JSON.stringify(props.value)));
  const [tmpInput, setTmpInput] = createSignal('');
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let getLastId = createMemo(() => {
    const lastId = props.value[0].label.split("#");
    return Number(lastId[1]);
  });

  let handleOnPlus = () => {
    if (flag() === 0 && edited() === 0) {
      setFlag(1); //plus / edit

      setEdited(0);
    } else {
      toastInfo(locale.details.language[0].componentNotAllowed);
    }
  };

  let handleOnEdit = id => {
    if (flag() === 0 && edited() === 0) {
      setFlag(1); //plus / edit

      setEdited(id);
    } else {
      toastInfo(locale.details.language[0].componentNotAllowed);
    }
  };

  let handleOnCancel = id => {
    setFlag(0);
    setEdited(0);
    setTmpInput('');
  };

  let handleOnDelete = id => {
    if (flag() === 0 && edited() === 0) {
      setFlag(2);
      setEdited(id);
      modalDelete();
    } else if (flag() === 1) {
      toastInfo("Only 1 component is allowed to edit");
    } else if (flag() === 2) {
      let updatedAnswer = JSON.parse(JSON.stringify(localAnswer()));
      let answerIndex = updatedAnswer.findIndex(item => item.value == id);
      updatedAnswer.splice(answerIndex, 1);
      props.onValueChange(updatedAnswer);
      toastInfo(locale.details.language[0].componentDeleted);
      setFlag(0);
      setEdited(0);
    }
  };

  let handleOnSave = id => {
    // setisLoading(true)
    if (tmpInput() !== "") {
      // let duplicate = 0;
      // const localAnswerLength = localAnswer().length;
      // if (localAnswerLength > 0) {
      // 	for (let j = 0; j < localAnswerLength; j++) {
      // 		if (localAnswer()[j].label === tmpInput().trim()) {
      // 			duplicate = 1;
      // 			break;
      // 		}
      // 	}
      // }
      // if (duplicate === 0) {
      let updatedAnswer = JSON.parse(JSON.stringify(localAnswer()));

      if (edited() === 0) {
        updatedAnswer = [...updatedAnswer, {
          "value": id,
          "label": tmpInput()
        }];
        updatedAnswer[0].label = "lastId#" + id;
      } else {
        let answerIndex = updatedAnswer.findIndex(item => item.value == id);
        updatedAnswer[answerIndex].label = tmpInput();
      }

      props.onValueChange(updatedAnswer);

      if (edited() === 0) {
        toastInfo(locale.details.language[0].componentAdded);
      } else {
        toastInfo(locale.details.language[0].componentEdited);
      }

      setFlag(0);
      setEdited(0); // } else {
      // 	toastInfo(locale.details.language[0].componentSelected);
      // }
    } else {
      if (edited() === 0) {
        toastInfo(locale.details.language[0].componentEmpty);
      } else {
        setFlag(0);
        setEdited(0);
      }
    }
  };

  let handleOnChange = e => {
    setTmpInput(e.target.value.trim());
  };

  const modalDelete = () => {
    let titleModal = document.querySelector("#titleModalDelete");
    let contentModal = document.querySelector("#contentModalDelete");
    titleModal.innerHTML = props.component.titleModalDelete !== undefined ? props.component.titleModalDelete : 'Confirm Delete?';
    contentModal.innerHTML = props.component.contentModalDelete !== undefined ? props.component.contentModalDelete : 'Deletion will also delete related components, including child components from this parent.';
  };

  const toastInfo = text => {
    Toastify({
      text: text == '' ? locale.details.language[0].componentDeleted : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: "bg-blue-600/80",
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  return (() => {
    const _el$ = _tmpl$6$d.cloneNode(true),
      _el$11 = _el$.firstChild,
      _el$12 = _el$11.firstChild,
      _el$13 = _el$12.firstChild,
      _el$14 = _el$13.firstChild,
      _el$17 = _el$13.nextSibling,
      _el$19 = _el$12.nextSibling,
      _el$20 = _el$19.firstChild,
      _el$21 = _el$11.nextSibling,
      _el$22 = _el$21.firstChild,
      _el$29 = _el$22.nextSibling,
      _el$30 = _el$29.nextSibling;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return flag() == 2;
      },

      get children() {
        const _el$2 = _tmpl$$w.cloneNode(true),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.nextSibling,
          _el$6 = _el$5.nextSibling,
          _el$7 = _el$6.firstChild,
          _el$8 = _el$7.nextSibling,
          _el$9 = _el$8.firstChild,
          _el$10 = _el$9.nextSibling;

        _el$9.$$click = e => handleOnDelete(edited());

        _el$10.$$click = e => handleOnCancel(edited());

        return _el$2;
      }

    }), _el$11);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$2$l.cloneNode(true);
      }

    }), null);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$16 = _tmpl$3$j.cloneNode(true);

        _el$16.$$click = showInstruction;
        return _el$16;
      }

    }), null);

    insert(_el$17, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$18 = _tmpl$4$g.cloneNode(true);

        createRenderEffect(() => _el$18.innerHTML = props.component.hint);

        return _el$18;
      }

    }));

    _el$20.$$click = e => handleOnPlus();

    insert(_el$22, createComponent$1(For, {
      get each() {
        return localAnswer();
      },

      children: (item, index) => createComponent$1(Switch, {
        get children() {
          return [createComponent$1(Match, {
            get when() {
              return memo(() => Number(item.value) > 0, true)() && Number(item.value) === edited();
            },

            get children() {
              const _el$31 = _tmpl$7$d.cloneNode(true),
                _el$32 = _el$31.firstChild,
                _el$33 = _el$32.firstChild,
                _el$34 = _el$32.nextSibling,
                _el$35 = _el$34.firstChild,
                _el$36 = _el$35.nextSibling;

              _el$33.addEventListener("change", e => handleOnChange(e));

              _el$35.$$click = e => handleOnSave(Number(item.value));

              _el$36.$$click = e => handleOnCancel(Number(item.value));

              createRenderEffect(_p$ => {
                const _v$7 = props.component.dataKey + "_input_" + Number(item.value),
                  _v$8 = item.label,
                  _v$9 = disableInput(),
                  _v$10 = disableInput();

                _v$7 !== _p$._v$7 && setAttribute(_el$33, "id", _p$._v$7 = _v$7);
                _v$8 !== _p$._v$8 && (_el$33.value = _p$._v$8 = _v$8);
                _v$9 !== _p$._v$9 && (_el$35.disabled = _p$._v$9 = _v$9);
                _v$10 !== _p$._v$10 && (_el$36.disabled = _p$._v$10 = _v$10);
                return _p$;
              }, {
                _v$7: undefined,
                _v$8: undefined,
                _v$9: undefined,
                _v$10: undefined
              });

              return _el$31;
            }

          }), createComponent$1(Match, {
            get when() {
              return memo(() => Number(item.value) > 0, true)() && Number(item.value) !== edited();
            },

            get children() {
              const _el$37 = _tmpl$8$b.cloneNode(true),
                _el$38 = _el$37.firstChild,
                _el$39 = _el$38.firstChild,
                _el$40 = _el$38.nextSibling,
                _el$41 = _el$40.firstChild,
                _el$42 = _el$41.nextSibling;

              _el$41.$$click = e => handleOnEdit(Number(item.value));

              _el$42.$$click = e => handleOnDelete(Number(item.value));

              createRenderEffect(_p$ => {
                const _v$11 = props.component.dataKey + "_input_" + Number(item.value),
                  _v$12 = item.label,
                  _v$13 = disableInput(),
                  _v$14 = disableInput();

                _v$11 !== _p$._v$11 && setAttribute(_el$39, "id", _p$._v$11 = _v$11);
                _v$12 !== _p$._v$12 && (_el$39.value = _p$._v$12 = _v$12);
                _v$13 !== _p$._v$13 && (_el$41.disabled = _p$._v$13 = _v$13);
                _v$14 !== _p$._v$14 && (_el$42.disabled = _p$._v$14 = _v$14);
                return _p$;
              }, {
                _v$11: undefined,
                _v$12: undefined,
                _v$13: undefined,
                _v$14: undefined
              });

              return _el$37;
            }

          })];
        }

      })
    }), null);

    insert(_el$22, createComponent$1(Show, {
      get when() {
        return memo(() => flag() == 1, true)() && edited() == 0;
      },

      get children() {
        const _el$23 = _tmpl$5$d.cloneNode(true),
          _el$24 = _el$23.firstChild,
          _el$25 = _el$24.firstChild,
          _el$26 = _el$24.nextSibling,
          _el$27 = _el$26.firstChild,
          _el$28 = _el$27.nextSibling;

        _el$25.addEventListener("change", e => handleOnChange(e));

        _el$27.$$click = e => handleOnSave(getLastId() + 1);

        _el$28.$$click = e => handleOnCancel(getLastId() + 1);

        createRenderEffect(_p$ => {
          const _v$ = props.component.dataKey + "_input_" + (getLastId() + 1),
            _v$2 = disableInput(),
            _v$3 = disableInput();

          _v$ !== _p$._v$ && setAttribute(_el$25, "id", _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && (_el$27.disabled = _p$._v$2 = _v$2);
          _v$3 !== _p$._v$3 && (_el$28.disabled = _p$._v$3 = _v$3);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined
        });

        return _el$23;
      }

    }), null);

    insert(_el$30, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$43 = _tmpl$11$5.cloneNode(true),
              _el$44 = _el$43.firstChild,
              _el$47 = _el$44.firstChild;

            insert(_el$44, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$9$9.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$10$9.cloneNode(true);
                  }

                })];
              }

            }), _el$47);

            _el$47.innerHTML = item;

            createRenderEffect(_$p => classList(_el$44, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$43;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$4 = props.component.label,
        _v$5 = disableInput(),
        _v$6 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };

      _v$4 !== _p$._v$4 && (_el$14.innerHTML = _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && (_el$20.disabled = _p$._v$5 = _v$5);
      _p$._v$6 = classList(_el$29, _v$6, _p$._v$6);
      return _p$;
    }, {
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$v = /*#__PURE__*/template$1(`<div class="modal-delete fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="sm:flex sm:items-start"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"><svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalDelete">Deactivate account</h3><div class="mt-2"><p class="text-sm text-gray-500" id="contentModalDelete">Are you sure you want to deactivate your account? All of your data will be permanently removed. This action cannot be undone.</p></div></div></div></div><div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">Delete</button><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button></div></div></div></div>`),
  _tmpl$2$k = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$3$i = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$4$f = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$5$c = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 pt-2.5 px-2 flex justify-end"><button class="bg-pink-600 text-white p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-pink-500  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg></button></div>`),
  _tmpl$6$c = /*#__PURE__*/template$1(`<div class="grid grid-cols-12 "><div class="col-span-10 mr-2"></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-teal-400 text-white p-2 rounded-full focus:outline-none hover:bg-teal-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><button class="bg-gray-500 text-white p-2 rounded-full focus:outline-none hover:bg-gray-400 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$7$c = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-6 p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-5"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div></div><div class="grid md:grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm  pb-2.5 px-2 col-start-2 col-end-12 space-y-4"></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$8$a = /*#__PURE__*/template$1(`<div class="grid grid-cols-12"><div class="col-span-10 mr-2"></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-teal-400 text-white p-2 rounded-full focus:outline-none hover:bg-teal-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><button class="bg-gray-500 text-white p-2 rounded-full focus:outline-none hover:bg-gray-400 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$9$8 = /*#__PURE__*/template$1(`<div class="grid grid-cols-12"><div class="col-span-10 mr-2"><input type="text" class="w-full
													font-light
													px-4
													py-2.5
													text-sm
													text-gray-700
													bg-gray-200 bg-clip-padding
													dark:bg-gray-300
													border border-solid border-gray-300
													rounded
													transition
													ease-in-out
													m-0
													focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
													disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" disabled></div><div class="col-span-2 flex justify-evenly p-1 space-x-1 "><button class="bg-orange-400 text-white p-2 rounded-full focus:outline-none hover:bg-orange-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button><button class="bg-red-600 text-white p-2 rounded-full focus:outline-none hover:bg-red-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button></div></div>`),
  _tmpl$10$8 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$11$4 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$12$3 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const ListSelectInputRepeat = props => {
  const [flag, setFlag] = createSignal(0); //untuk flag open textinput

  const [edited, setEdited] = createSignal(0); //untuk flag id yg akan diedit / hapus

  const [localAnswer, setLocalAnswer] = createSignal(JSON.parse(JSON.stringify(props.value)));
  const [tmpSelected, setTmpSelected] = createSignal({
    value: 0,
    label: ''
  });
  const [isError, setisError] = createSignal(false);
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let getLastId = createMemo(() => {
    return 0;
  });
  let options;
  let getOptions;

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  switch (props.component.typeOption) {
    case 1:
      {
        try {
          getOptions = createMemo(() => {
            let options = JSON.parse(JSON.stringify(props.component.options));
            const localAnswerLength = localAnswer().length;
            let j = 0;

            if (localAnswer()[0] !== undefined) {
              j = localAnswer()[0].value == 0 ? 1 : 0;
            }

            for (j; j < localAnswerLength; j++) {
              if (edited() === 0 || edited() !== Number(localAnswer()[j].value)) {
                let optionsIndex = options.findIndex(item => item.value == localAnswer()[j].value);
                options.splice(optionsIndex, 1);
              }
            }

            return options;
          });
        } catch (e) {
          setisError(true);
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    case 2:
      {
        try {
          if (config.lookupMode === 1) {
            let url;
            let params;
            let urlHead;
            let urlParams;
            params = props.component.sourceSelect; // url = `${config.baseUrl}/${params[0].id}`

            url = `${config.baseUrl}/${params[0].id}/filter?version=${params[0].version}`;

            if (params[0].parentCondition.length > 0) {
              urlHead = url;
              urlParams = params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = encodeURI(tobeLookup.answer[tobeLookup.answer.length - 1].value);
                    url = `${config.lookupKey}=${item.key}&${config.lookupValue}=${parentValue}`;
                  }
                } else {
                  url = `${config.lookupKey}=${item.key}&${config.lookupValue}=''`;
                }

                return url;
              }).join('&'); // url = `${urlHead}?${urlParams}`

              url = `${urlHead}&${urlParams}`;
            }

            const [fetched] = createResource(url, props.MobileOnlineSearch);
            let arr = [];
            getOptions = createMemo(() => {
              if (fetched()) {
                if (!fetched().success) {
                  setisError(true);
                  toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
                } else {
                  // let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
                  // let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)
                  let cekValue = params[0].value;
                  let cekLabel = params[0].desc;
                  fetched().data.map((item, value) => {
                    arr.push({
                      value: item[cekValue],
                      label: item[cekLabel]
                    });
                  });
                  options = arr;
                  const localAnswerLength = localAnswer().length;
                  let j = 0;

                  if (localAnswer()[0] !== undefined) {
                    j = localAnswer()[0].value == 0 ? 1 : 0;
                  }

                  for (j; j < localAnswerLength; j++) {
                    if (edited() === 0 || edited() !== Number(localAnswer()[j].value)) {
                      let optionsIndex = options.findIndex(item => item.value == localAnswer()[j].value);
                      options.splice(optionsIndex, 1);
                    }
                  }

                  return options;
                }
              }
            });
          } else if (config.lookupMode === 2) {
            let params;
            let tempArr = [];
            params = props.component.sourceSelect;
            let id = params[0].id;
            let version = params[0].version;

            if (params[0].parentCondition.length > 0) {
              params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = tobeLookup.answer[tobeLookup.answer.length - 1].value.toString();
                    tempArr.push({
                      "key": item.key,
                      "value": parentValue
                    });
                  }
                }
              });
            } // console.log('id : ', id)
            // console.log('version : ', version)
            // console.log('kondisi : ', tempArr)


            let getResult = result => {
              getOptions = createMemo(() => {
                if (!result.success) {
                  setisError(true);
                  toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
                } else {
                  let arr = [];

                  if (result.data.length > 0) {
                    let cekValue = params[0].value;
                    let cekLabel = params[0].desc;
                    result.data.map((item, value) => {
                      arr.push({
                        value: item[cekValue],
                        label: item[cekLabel]
                      });
                    });
                    options = arr;
                    const localAnswerLength = localAnswer().length;
                    let j = 0;

                    if (localAnswer()[0] !== undefined) {
                      j = localAnswer()[0].value == 0 ? 1 : 0;
                    }

                    for (j; j < localAnswerLength; j++) {
                      if (edited() === 0 || edited() !== Number(localAnswer()[j].value)) {
                        let optionsIndex = options.findIndex(item => item.value == localAnswer()[j].value);
                        options.splice(optionsIndex, 1);
                      }
                    }

                    return options;
                  }
                }
              });
            };

            const fetched = props.MobileOfflineSearch(id, version, tempArr, getResult);
          }
        } catch (e) {
          setisError(true);
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    case 3:
      {
        try {
          getOptions = createMemo(() => {
            let options = props.component.sourceOption !== undefined ? [] : JSON.parse(JSON.stringify(props.component.options));

            if (props.component.sourceOption !== undefined) {
              const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === props.component.sourceOption);

              if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
                if (reference.details[componentAnswerIndex].answer) {
                  options = JSON.parse(JSON.stringify(reference.details[componentAnswerIndex].answer));
                } else {
                  options = [];
                }
              }
            }

            const localAnswerLength = localAnswer().length;
            let j = 0;

            if (localAnswer()[0] !== undefined) {
              j = localAnswer()[0].value == 0 ? 1 : 0;
            }

            for (j; j < localAnswerLength; j++) {
              if (edited() === 0 || edited() !== Number(localAnswer()[j].value)) {
                let optionsIndex = options.findIndex(item => item.value == localAnswer()[j].value);
                options.splice(optionsIndex, 1);
              }
            }

            return options;
          });
        } catch (e) {
          setisError(true);
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    default:
      {
        try {
          getOptions = createMemo(() => {
            let options;

            if (props.component.options) {
              options = JSON.parse(JSON.stringify(props.component.options));
              const localAnswerLength = localAnswer().length;
              let j = 0;

              if (localAnswer()[0] !== undefined) {
                j = localAnswer()[0].value == 0 ? 1 : 0;
              }

              for (j; j < localAnswerLength; j++) {
                if (edited() === 0 || edited() !== Number(localAnswer()[j].value)) {
                  let optionsIndex = options.findIndex(item => item.value == localAnswer()[j].value);
                  options.splice(optionsIndex, 1);
                }
              }
            } else {
              options = [];
            }

            return options;
          });
        } catch (e) {
          setisError(true);
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }
  }

  let handleOnPlus = () => {
    if (flag() === 0 && edited() === 0) {
      setFlag(1); //plus / edit

      setEdited(0);
    } else {
      toastInfo(locale.details.language[0].componentNotAllowed, '');
    }
  };

  let handleOnEdit = id => {
    if (flag() === 0 && edited() === 0) {
      setFlag(1); //plus / edit

      setEdited(id);
    } else {
      toastInfo(locale.details.language[0].componentNotAllowed, '');
    }
  };

  let handleOnCancel = id => {
    setFlag(0);
    setEdited(0);
    setTmpSelected({
      value: 0,
      label: ''
    });
  };

  let handleOnDelete = id => {
    if (flag() === 0 && edited() === 0) {
      //buka modal
      setFlag(2);
      setEdited(id);
      modalDelete();
    } else if (flag() === 1) {
      //tidak bisa buka modal karena isian lain terbuka
      toastInfo(locale.details.language[0].componentNotAllowed, '');
    } else if (flag() === 2) {
      let updatedAnswer = JSON.parse(JSON.stringify(localAnswer()));
      let answerIndex = updatedAnswer.findIndex(item => item.value == id);
      updatedAnswer.splice(answerIndex, 1);
      props.onValueChange(updatedAnswer);
      toastInfo(locale.details.language[0].componentDeleted, '');
      setFlag(0);
      setEdited(0);
    }
  };

  let handleOnSave = id => {
    if (tmpSelected().value !== 0) {
      let updatedAnswer = JSON.parse(JSON.stringify(localAnswer()));

      if (edited() === 0) {
        //insert
        if (updatedAnswer.length == 0) {
          updatedAnswer = [...updatedAnswer, {
            "label": "lastId#0",
            "value": "0"
          }];
        }

        updatedAnswer = [...updatedAnswer, tmpSelected()];
      } else {
        //update
        let answerIndex = updatedAnswer.findIndex(item => item.value == id);
        updatedAnswer.splice(answerIndex, 1, tmpSelected());
      }

      props.onValueChange(updatedAnswer);

      if (edited() === 0) {
        toastInfo(locale.details.language[0].componentAdded, '');
      } else {
        toastInfo(locale.details.language[0].componentEdited, '');
      }

      setFlag(0);
      setEdited(0);
    } else {
      if (edited() === 0) {
        toastInfo(locale.details.language[0].componentEmpty, '');
      } else {
        setFlag(0);
        setEdited(0);
      }
    }
  };

  let handleOnChange = value => {
    setTmpSelected(value);
  };

  const modalDelete = () => {
    let titleModal = document.querySelector("#titleModalDelete");
    let contentModal = document.querySelector("#contentModalDelete");
    titleModal.innerHTML = props.component.titleModalDelete !== undefined ? props.component.titleModalDelete : 'Confirm Delete?';
    contentModal.innerHTML = props.component.contentModalDelete !== undefined ? props.component.contentModalDelete : 'Deletion will also delete related components, including child components from this parent.';
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  return (() => {
    const _el$ = _tmpl$7$c.cloneNode(true),
      _el$11 = _el$.firstChild,
      _el$12 = _el$11.firstChild,
      _el$13 = _el$12.firstChild,
      _el$14 = _el$13.firstChild,
      _el$17 = _el$13.nextSibling,
      _el$21 = _el$11.nextSibling,
      _el$22 = _el$21.firstChild,
      _el$28 = _el$22.nextSibling,
      _el$29 = _el$28.nextSibling;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return flag() == 2;
      },

      get children() {
        const _el$2 = _tmpl$$v.cloneNode(true),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.nextSibling,
          _el$6 = _el$5.nextSibling,
          _el$7 = _el$6.firstChild,
          _el$8 = _el$7.nextSibling,
          _el$9 = _el$8.firstChild,
          _el$10 = _el$9.nextSibling;

        _el$9.$$click = e => handleOnDelete(edited());

        _el$10.$$click = e => handleOnCancel(edited());

        return _el$2;
      }

    }), _el$11);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$2$k.cloneNode(true);
      }

    }), null);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$16 = _tmpl$3$i.cloneNode(true);

        _el$16.$$click = showInstruction;
        return _el$16;
      }

    }), null);

    insert(_el$17, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$18 = _tmpl$4$f.cloneNode(true);

        createRenderEffect(() => _el$18.innerHTML = props.component.hint);

        return _el$18;
      }

    }));

    insert(_el$11, createComponent$1(Show, {
      get when() {
        return !isError();
      },

      get children() {
        const _el$19 = _tmpl$5$c.cloneNode(true),
          _el$20 = _el$19.firstChild;

        _el$20.$$click = e => handleOnPlus();

        createRenderEffect(() => _el$20.disabled = disableInput());

        return _el$19;
      }

    }), null);

    insert(_el$22, createComponent$1(For, {
      get each() {
        return localAnswer();
      },

      children: (item, index) => createComponent$1(Switch, {
        get children() {
          return [createComponent$1(Match, {
            get when() {
              return memo(() => Number(item.value) > 0, true)() && Number(item.value) === edited();
            },

            get children() {
              const _el$30 = _tmpl$8$a.cloneNode(true),
                _el$31 = _el$30.firstChild,
                _el$32 = _el$31.nextSibling,
                _el$33 = _el$32.firstChild,
                _el$34 = _el$33.nextSibling;

              insert(_el$31, createComponent$1(Select, mergeProps({
                "class": "formgear-select w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none"
              }, () => createOptions(getOptions(), {
                key: "label",
                filterable: true
              }), {
                onChange: e => handleOnChange(e),
                initialValue: item
              })));

              _el$33.$$click = e => handleOnSave(Number(item.value));

              _el$34.$$click = e => handleOnCancel(Number(item.value));

              createRenderEffect(_p$ => {
                const _v$5 = disableInput(),
                  _v$6 = disableInput();

                _v$5 !== _p$._v$5 && (_el$33.disabled = _p$._v$5 = _v$5);
                _v$6 !== _p$._v$6 && (_el$34.disabled = _p$._v$6 = _v$6);
                return _p$;
              }, {
                _v$5: undefined,
                _v$6: undefined
              });

              return _el$30;
            }

          }), createComponent$1(Match, {
            get when() {
              return memo(() => Number(item.value) > 0, true)() && Number(item.value) !== edited();
            },

            get children() {
              const _el$35 = _tmpl$9$8.cloneNode(true),
                _el$36 = _el$35.firstChild,
                _el$37 = _el$36.firstChild,
                _el$38 = _el$36.nextSibling,
                _el$39 = _el$38.firstChild,
                _el$40 = _el$39.nextSibling;

              _el$39.$$click = e => handleOnEdit(Number(item.value));

              _el$40.$$click = e => handleOnDelete(Number(item.value));

              createRenderEffect(_p$ => {
                const _v$7 = props.component.dataKey + "_input_" + Number(item.value),
                  _v$8 = item.label,
                  _v$9 = disableInput(),
                  _v$10 = disableInput();

                _v$7 !== _p$._v$7 && setAttribute(_el$37, "id", _p$._v$7 = _v$7);
                _v$8 !== _p$._v$8 && (_el$37.value = _p$._v$8 = _v$8);
                _v$9 !== _p$._v$9 && (_el$39.disabled = _p$._v$9 = _v$9);
                _v$10 !== _p$._v$10 && (_el$40.disabled = _p$._v$10 = _v$10);
                return _p$;
              }, {
                _v$7: undefined,
                _v$8: undefined,
                _v$9: undefined,
                _v$10: undefined
              });

              return _el$35;
            }

          })];
        }

      })
    }), null);

    insert(_el$22, createComponent$1(Show, {
      get when() {
        return memo(() => flag() == 1, true)() && edited() == 0;
      },

      get children() {
        const _el$23 = _tmpl$6$c.cloneNode(true),
          _el$24 = _el$23.firstChild,
          _el$25 = _el$24.nextSibling,
          _el$26 = _el$25.firstChild,
          _el$27 = _el$26.nextSibling;

        insert(_el$24, createComponent$1(Select, mergeProps({
          "class": "formgear-select w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none"
        }, () => createOptions(getOptions(), {
          key: "label",
          filterable: true
        }), {
          onChange: e => handleOnChange(e)
        })));

        _el$26.$$click = e => handleOnSave(getLastId());

        _el$27.$$click = e => handleOnCancel(getLastId());

        createRenderEffect(_p$ => {
          const _v$ = disableInput(),
            _v$2 = disableInput();

          _v$ !== _p$._v$ && (_el$26.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && (_el$27.disabled = _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$23;
      }

    }), null);

    insert(_el$29, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$41 = _tmpl$12$3.cloneNode(true),
              _el$42 = _el$41.firstChild,
              _el$45 = _el$42.firstChild;

            insert(_el$42, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$10$8.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$11$4.cloneNode(true);
                  }

                })];
              }

            }), _el$45);

            _el$45.innerHTML = item;

            createRenderEffect(_$p => classList(_el$42, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$41;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };
      _v$3 !== _p$._v$3 && (_el$14.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$28, _v$4, _p$._v$4);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$u = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$j = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$h = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$e = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$b = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.50] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div><div></div></div></div></div>`),
  _tmpl$6$b = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$b = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$9 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const MultipleSelectInput$1 = props => {
  const [options, setOptions] = createSignal([]);
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let optionsFetch; // type contentMeta = {
  //     name: string,
  //     type: string
  // }

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  switch (props.component.typeOption) {
    case 1:
      {
        try {
          optionsFetch = JSON.parse(JSON.stringify(props.component.options));
          createEffect(() => {
            setOptions(optionsFetch);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    case 2:
      {
        try {
          if (config.lookupMode === 1) {
            let url;
            let params;
            let urlHead;
            let urlParams;
            params = props.component.sourceSelect; // url = `${config.baseUrl}/${params[0].id}`

            url = `${config.baseUrl}/${params[0].id}/filter?version=${params[0].version}`;

            if (params[0].parentCondition.length > 0) {
              urlHead = url;
              urlParams = params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = encodeURI(tobeLookup.answer[tobeLookup.answer.length - 1].value);
                    url = `${config.lookupKey}=${item.key}&${config.lookupValue}=${parentValue}`;
                  }
                } else {
                  url = `${config.lookupKey}=${item.key}&${config.lookupValue}=''`;
                }

                return url;
              }).join('&'); // url = `${urlHead}?${urlParams}`

              url = `${urlHead}&${urlParams}`;
            }

            const [fetched] = createResource(url, props.MobileOnlineSearch);
            createEffect(() => {
              if (fetched()) {
                if (!fetched().success) {
                  toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
                } else {
                  let arr = []; // let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
                  // let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)

                  let cekValue = params[0].value;
                  let cekLabel = params[0].desc;
                  fetched().data.map((item, value) => {
                    arr.push({
                      value: item[cekValue],
                      label: item[cekLabel]
                    });
                  });
                  setOptions(arr);
                }
              }
            });
          } else if (config.lookupMode === 2) {
            let params;
            let tempArr = [];
            params = props.component.sourceSelect;
            let id = params[0].id;
            let version = params[0].version;

            if (params[0].parentCondition.length > 0) {
              params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = tobeLookup.answer[tobeLookup.answer.length - 1].value.toString();
                    tempArr.push({
                      "key": item.key,
                      "value": parentValue
                    });
                  }
                }
              });
            } // console.log('id : ', id)
            // console.log('version : ', version)
            // console.log('kondisi : ', tempArr)


            let getResult = result => {
              if (!result.success) {
                toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
              } else {
                let arr = [];

                if (result.data.length > 0) {
                  let cekValue = params[0].value;
                  let cekLabel = params[0].desc;
                  result.data.map((item, value) => {
                    arr.push({
                      value: item[cekValue],
                      label: item[cekLabel]
                    });
                  });
                  setOptions(arr);
                }
              }
            };

            const fetched = props.MobileOfflineSearch(id, version, tempArr, getResult);
          }
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    case 3:
      {
        try {
          optionsFetch = props.component.sourceOption !== undefined ? [] : JSON.parse(JSON.stringify(props.component.options));

          if (props.component.sourceOption !== undefined) {
            let newSourceOption = props.component.sourceOption.split('@');
            const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === newSourceOption[0]);

            if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
              if (reference.details[componentAnswerIndex].answer) {
                optionsFetch = JSON.parse(JSON.stringify(reference.details[componentAnswerIndex].answer));
              } else {
                optionsFetch = [];
              }
            }
          }

          createEffect(() => {
            setOptions(optionsFetch);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }

    default:
      {
        try {
          let optionsFetch;

          if (props.component.options) {
            optionsFetch = JSON.parse(JSON.stringify(props.component.options));
          } else {
            optionsFetch = [];
          }

          createEffect(() => {
            setOptions(optionsFetch);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed, 'bg-pink-700/80');
        }

        break;
      }
  }

  let handleOnChange = value => {
    if (value != '' && value != undefined && Array.isArray(value)) {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));

      if (props.value.length > value.length) {
        updatedAnswer = value;
      } else {
        let data = value[value.length - 1];

        if (props.value) {
          updatedAnswer.push({
            value: data.value,
            label: data.label
          });
        } else {
          updatedAnswer = [];
          updatedAnswer.push({
            value: data.value,
            label: data.label
          });
        }
      }

      props.onValueChange(updatedAnswer);
    } else {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      props.onValueChange(updatedAnswer);
    }
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$b.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$u.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$j.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$h.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$11, createComponent$1(Select, mergeProps({
      multiple: true,
      "class": "formgear-select w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    }, () => createOptions(props.value == '' ? options : options().filter(item => !props.value.some(f => f.value == item.value)), {
      key: "label",
      filterable: true
    }), {
      get disabled() {
        return disableInput();
      },

      onChange: e => handleOnChange(e),

      get initialValue() {
        return props.value;
      }

    })));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$9.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$b.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$b.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$e.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = {
          ' border rounded border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
          ' border rounded border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
        };
      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _p$._v$5 = classList(_el$11, _v$5, _p$._v$5);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

// src/index.ts
var stringMaskToArray = (mask) => [...mask].map((c) => ({
  9: /\d/,
  a: /[a-z]/i,
  "*": /\w/
})[c] || c);
var maskArrayToFn = (maskArray) => (value, selection) => {
  let pos = 0;
  maskArray.forEach((maskItem) => {
    if (value.length < pos + 1) {
      return;
    }
    if (typeof maskItem === "string") {
      const index = value.slice(pos).indexOf(maskItem);
      if (index !== 0) {
        value = value.slice(0, pos) + maskItem + value.slice(pos);
        selection[0] > pos && (selection[0] += maskItem.length);
        selection[1] > pos && (selection[1] += maskItem.length);
      }
      pos += maskItem.length;
    } else if (maskItem instanceof RegExp) {
      const match = value.slice(pos).match(maskItem);
      if (!match || match.index === void 0) {
        value = value.slice(0, pos);
        return;
      } else if (match.index > 0) {
        value = value.slice(0, pos) + value.slice(pos + match.index);
        pos -= match.index - 1;
        selection[0] > pos && (selection[0] -= match.index);
        selection[1] > pos && (selection[1] -= match.index);
      }
      pos += match[0].length;
    }
  });
  return [value.slice(0, pos), selection];
};
var anyMaskToFn = (mask) => typeof mask === "function" ? mask : maskArrayToFn(Array.isArray(mask) ? mask : stringMaskToArray(mask));
var createInputMask = (mask) => {
  const maskFn = anyMaskToFn(mask);
  const handler = (ev) => {
    const ref = ev.currentTarget || ev.target;
    const [value, selection] = maskFn(ref.value, [
      ref.selectionStart || ref.value.length,
      ref.selectionEnd || ref.value.length
    ]);
    ref.value = value;
    ref.setSelectionRange(...selection);
    return value;
  };
  return handler;
};

const _tmpl$$t = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$i = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$g = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$d = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$5$a = /*#__PURE__*/template$1(`<div class="md:grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""><input type="text" class="w-full border-gray-300 rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"></div></div></div>`),
  _tmpl$6$a = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$7$a = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$8$8 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const MaskingInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const formatMask = createInputMask(props.component.maskingFormat);
  let ref;
  const inputMask = {
    ref,

    get value() {
      return inputMask.ref?.value;
    }

  };

  let handleOnChange = value => {
    // let format = props.component.maskingFormat;
    // let separator = Array.from(new Set(format.replace(/[a9*]/g, ''))).join('');
    // let finalValue = value.replace(new RegExp("[" + separator + "]", "g"), '')
    // props.onValueChange(finalValue)
    props.onValueChange(value);
  };

  createEffect(() => {
    document.getElementById("inputMask" + props.component.dataKey).click();
  });
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$5$a.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$11 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$t.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$i.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$g.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    addEventListener(_el$11, "paste", formatMask);

    addEventListener(_el$11, "input", formatMask, true);

    addEventListener(_el$11, "click", formatMask, true);

    _el$11.addEventListener("change", e => handleOnChange(e.currentTarget.value));

    const _ref$ = inputMask.ref;
    typeof _ref$ === "function" ? _ref$(_el$11) : inputMask.ref = _el$11;

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$16 = _tmpl$8$8.cloneNode(true),
              _el$17 = _el$16.firstChild,
              _el$20 = _el$17.firstChild;

            insert(_el$17, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$6$a.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$7$a.cloneNode(true);
                  }

                })];
              }

            }), _el$20);

            _el$20.innerHTML = item;

            createRenderEffect(_$p => classList(_el$17, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$16;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$12 = _tmpl$4$d.cloneNode(true),
          _el$13 = _el$12.firstChild,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling;

        _el$13.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$15, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$13.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$15.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$12;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        },
        _v$5 = props.value,
        _v$6 = "inputMask" + props.component.dataKey,
        _v$7 = props.component.maskingFormat.replace(/[a]/g, '__').replace(/[9]/g, '#'),
        _v$8 = disableInput();

      _v$3 !== _p$._v$3 && (_el$4.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$10, _v$4, _p$._v$4);
      _v$5 !== _p$._v$5 && (_el$11.value = _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && setAttribute(_el$11, "id", _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && setAttribute(_el$11, "placeholder", _p$._v$7 = _v$7);
      _v$8 !== _p$._v$8 && (_el$11.disabled = _p$._v$8 = _v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
}; // transition ease-in-out m-0

delegateEvents(["click", "input"]);

const _tmpl$$s = /*#__PURE__*/template$1(`<input type="text" class="w-full font-light px-4 py-2.5 text-sm text-gray-700 bg-gray-200 bg-clip-padding dark:bg-gray-300 border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" disabled>`),
  _tmpl$2$h = /*#__PURE__*/template$1(`<small></small>`),
  _tmpl$3$f = /*#__PURE__*/template$1(`<div class="grid space-y-4"></div>`),
  _tmpl$4$c = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-x-2 py-2.5 px-2"><div></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2"></div></div>`);

const VariableInput = props => {
  const config = props.config;
  createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [answer, setAnswer] = createSignal(props.value);
  createEffect(() => {
    setAnswer(props.value);
  });
  return createComponent$1(Show, {
    get when() {
      return props.component.render;
    },

    get children() {
      const _el$ = _tmpl$4$c.cloneNode(true),
        _el$2 = _el$.firstChild,
        _el$3 = _el$2.firstChild,
        _el$4 = _el$2.nextSibling;

      insert(_el$4, createComponent$1(Switch, {
        get children() {
          return [createComponent$1(Match, {
            get when() {
              return props.component.render && props.component.renderType <= 1;
            },

            get children() {
              return [(() => {
                const _el$5 = _tmpl$$s.cloneNode(true);

                createRenderEffect(_p$ => {
                  const _v$ = props.value,
                    _v$2 = props.component.dataKey;
                  _v$ !== _p$._v$ && (_el$5.value = _p$._v$ = _v$);
                  _v$2 !== _p$._v$2 && setAttribute(_el$5, "name", _p$._v$2 = _v$2);
                  return _p$;
                }, {
                  _v$: undefined,
                  _v$2: undefined
                });

                return _el$5;
              })(), (() => {
                const _el$6 = _tmpl$2$h.cloneNode(true);

                insert(_el$6, () => props.validationMessage);

                return _el$6;
              })()];
            }

          }), createComponent$1(Match, {
            get when() {
              return props.component.render && props.component.renderType === 2;
            },

            get children() {
              const _el$7 = _tmpl$3$f.cloneNode(true);

              insert(_el$7, createComponent$1(For, {
                get each() {
                  return props.value;
                },

                children: (item, index) => (() => {
                  const _el$8 = _tmpl$$s.cloneNode(true);

                  createRenderEffect(() => _el$8.value = item.label);

                  return _el$8;
                })()
              }));

              return _el$7;
            }

          })];
        }

      }));

      createRenderEffect(() => _el$3.innerHTML = props.component.label);

      return _el$;
    }

  });
};

const _tmpl$$r = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$g = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$e = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$b = /*#__PURE__*/template$1(`<input class="hidden">`),
  _tmpl$5$9 = /*#__PURE__*/template$1(`<button class="bg-white text-gray-500 p-2 mr-2 rounded-full focus:outline-none h-10 w-10 hover:bg-pink-200 hover:text-pink-400 hover:border-pink-200 border-2 border-gray-300  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></button>`),
  _tmpl$6$9 = /*#__PURE__*/template$1(`<input type="file" accept="image/*" style="color: transparent;" class="hidden w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100">`),
  _tmpl$7$9 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button>`),
  _tmpl$8$7 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4"><div class="preview-class"><div class="container mx-auto"><img class="rounded-md" style="width:100%;height:100%"></div></div></div>`),
  _tmpl$9$7 = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-11"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 space-y-4 flex justify-end -mt-2"></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$10$7 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$11$3 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$12$2 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const PhotoInput$1 = props => {
  const [label, setLabel] = createSignal('');
  const [fileSource, setFileSource] = createSignal('');
  let reader = new FileReader();
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  createEffect(() => {
    setLabel(props.component.label);

    if (props.value[0]) {
      let imgSrc = props.value[0].value;
      setFileSource(imgSrc);
    }
  });

  let handleOnChange = event => {
    var event = JSON.parse(event);
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));
    updatedAnswer = [];
    updatedAnswer.push({
      value: event.image,
      label: event.label,
      type: event.type
    });
    props.onValueChange(updatedAnswer);
  };

  let setValue = data => {
    handleOnChange(data);
  };

  let clickUpload = () => {
    props.MobileUploadHandler(setValue);
  };

  let getFileContent = data => {
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));

    if (data.target.files && data.target.files[0]) {
      var allowedExtension = ['jpeg', 'jpg', 'png', 'gif'];
      let doc = data.target.files[0];
      let ext = doc.name.split('.').pop().toLowerCase();

      if (!allowedExtension.includes(ext)) {
        toastInfo('Please submit the appropriate format!', 'bg-pink-600/70');
      } else {
        reader.readAsDataURL(doc);

        reader.onload = e => {
          var filename = doc.name;
          updatedAnswer = [];
          URL.createObjectURL(doc); // updatedAnswer.push({ value: urlImg, label: filename })

          updatedAnswer.push({
            value: e.target.result,
            label: filename,
            type: data.target.files[0].type
          }); // console.log('hasilny adalah : ', updatedAnswer)

          props.onValueChange(updatedAnswer);
          toastInfo('Image uploaded successfully!', '');
        };
      }
    }
  };

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$9$7.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.firstChild,
      _el$8 = _el$4.nextSibling,
      _el$10 = _el$3.nextSibling,
      _el$22 = _el$10.nextSibling,
      _el$23 = _el$22.nextSibling;

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$r.cloneNode(true);
      }

    }), null);

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$7 = _tmpl$2$g.cloneNode(true);

        _el$7.$$click = showInstruction;
        return _el$7;
      }

    }), null);

    insert(_el$8, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$9 = _tmpl$3$e.cloneNode(true);

        createRenderEffect(() => _el$9.innerHTML = props.component.hint);

        return _el$9;
      }

    }));

    insert(_el$10, createComponent$1(Switch, {
      get children() {
        return [createComponent$1(Match, {
          get when() {
            return config.clientMode == 2;
          },

          get children() {
            return [_tmpl$4$b.cloneNode(true), (() => {
              const _el$12 = _tmpl$5$9.cloneNode(true);

              _el$12.$$click = () => clickUpload();

              createRenderEffect(() => _el$12.disabled = disableInput());

              return _el$12;
            })()];
          }

        }), createComponent$1(Match, {
          get when() {
            return config.clientMode == 1;
          },

          get children() {
            return [(() => {
              const _el$13 = _tmpl$6$9.cloneNode(true);

              _el$13.addEventListener("change", e => {
                getFileContent(e);
              });

              createRenderEffect(_p$ => {
                const _v$ = "inputFile_" + props.component.dataKey,
                  _v$2 = props.component.dataKey;

                _v$ !== _p$._v$ && setAttribute(_el$13, "id", _p$._v$ = _v$);
                _v$2 !== _p$._v$2 && setAttribute(_el$13, "name", _p$._v$2 = _v$2);
                return _p$;
              }, {
                _v$: undefined,
                _v$2: undefined
              });

              return _el$13;
            })(), (() => {
              const _el$14 = _tmpl$5$9.cloneNode(true);

              _el$14.$$click = e => {
                document.getElementById("inputFile_" + props.component.dataKey).click();
              };

              createRenderEffect(_p$ => {
                const _v$3 = disableInput(),
                  _v$4 = locale.details.language[0].uploadImage;

                _v$3 !== _p$._v$3 && (_el$14.disabled = _p$._v$3 = _v$3);
                _v$4 !== _p$._v$4 && setAttribute(_el$14, "title", _p$._v$4 = _v$4);
                return _p$;
              }, {
                _v$3: undefined,
                _v$4: undefined
              });

              return _el$14;
            })()];
          }

        })];
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$15 = _tmpl$7$9.cloneNode(true),
          _el$16 = _el$15.firstChild,
          _el$17 = _el$16.nextSibling;

        _el$15.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$17, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$5 = disableClickRemark(),
            _v$6 = props.comments === 0;

          _v$5 !== _p$._v$5 && (_el$15.disabled = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && _el$17.classList.toggle("hidden", _p$._v$6 = _v$6);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined
        });

        return _el$15;
      }

    }), null);

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return fileSource() != '';
      },

      get children() {
        const _el$18 = _tmpl$8$7.cloneNode(true),
          _el$19 = _el$18.firstChild,
          _el$20 = _el$19.firstChild,
          _el$21 = _el$20.firstChild;

        createRenderEffect(_p$ => {
          const _v$7 = fileSource(),
            _v$8 = "img-preview" + props.component.dataKey;

          _v$7 !== _p$._v$7 && setAttribute(_el$21, "src", _p$._v$7 = _v$7);
          _v$8 !== _p$._v$8 && setAttribute(_el$21, "id", _p$._v$8 = _v$8);
          return _p$;
        }, {
          _v$7: undefined,
          _v$8: undefined
        });

        return _el$18;
      }

    }), _el$22);

    insert(_el$23, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$24 = _tmpl$12$2.cloneNode(true),
              _el$25 = _el$24.firstChild,
              _el$28 = _el$25.firstChild;

            insert(_el$25, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$10$7.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$11$3.cloneNode(true);
                  }

                })];
              }

            }), _el$28);

            _el$28.innerHTML = item;

            createRenderEffect(_$p => classList(_el$25, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$24;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$9 = props.component.label,
        _v$10 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };
      _v$9 !== _p$._v$9 && (_el$5.innerHTML = _p$._v$9 = _v$9);
      _p$._v$10 = classList(_el$22, _v$10, _p$._v$10);
      return _p$;
    }, {
      _v$9: undefined,
      _v$10: undefined
    });

    return _el$;
  })();
}; // transition ease-in-out m-0

delegateEvents(["click"]);

const _tmpl$$q = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$f = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$d = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$a = /*#__PURE__*/template$1(`<button class="bg-white text-gray-500 p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-sky-200 hover:text-sky-400 hover:border-sky-200 border-2 border-gray-300 "><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg></button>`),
  _tmpl$5$8 = /*#__PURE__*/template$1(`<button class="bg-white text-gray-500 p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-teal-200 hover:text-teal-400 hover:border-teal-200 border-2 border-gray-300  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></button>`),
  _tmpl$6$8 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button>`),
  _tmpl$7$8 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4 -mt-2"><div class="preview-class"><div class="container mx-auto space-y-3"><iframe class="border-2 rounded-md mb-2" style="width:100%;height:100%;pointer-events: none;"></iframe><span class="bg-red-100 text-red-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-red-200 dark:text-red-800"></span><span class="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-800"></span></div></div></div>`),
  _tmpl$8$6 = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-11"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 space-y-4 flex justify-end items-end -mt-2"></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$9$6 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$10$6 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$11$2 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const GpsInput = props => {
  const [label, setLabel] = createSignal('');
  const [location, setLocation] = createSignal('');
  const [latLong, setLatlong] = createSignal({
    latitude: null,
    longitude: null
  });
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  createEffect(() => {
    setLabel(props.component.label);

    if (props.value[0]) {
      let coord = props.value[0].value;
      let imgSrc = `https://maps.google.com/maps?q=${coord.latitude},${coord.longitude}` + `&output=embed`;
      setLocation(imgSrc);
      setLatlong({
        latitude: coord.latitude,
        longitude: coord.longitude
      });
    }
  });

  let handleMobileGps = event => {
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));
    updatedAnswer = [];
    let source;

    if (event.coordinat) {
      source = `https://maps.google.com/maps?q=${event.coordinat.latitude},${event.coordinat.longitude}` + `&output=embed`;
      setLocation(source);
    }

    toastInfo(locale.details.language[0].locationAcquired);
    updatedAnswer.push({
      value: {
        'latitude': event.coordinat.latitude,
        'longitude': event.coordinat.longitude
      },
      label: source
    });
    updatedAnswer.push({
      label: 'map',
      value: source
    });
    updatedAnswer.push({
      label: 'latitude',
      value: event.coordinat.latitude
    });
    updatedAnswer.push({
      label: 'longitude',
      value: event.coordinat.longitude
    });
    props.onValueChange(updatedAnswer);
  };

  let clickMobileGps = () => {
    props.MobileGpsHandler(handleMobileGps);
  };

  let clickGps = () => {
    var options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

    function success(pos) {
      pos.coords;

      if (pos.coords) {
        let updatedAnswer = JSON.parse(JSON.stringify(props.value));
        updatedAnswer = [];
        let source = `https://maps.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}` + `&output=embed`;
        setLocation(source);
        updatedAnswer.push({
          value: {
            'latitude': pos.coords.latitude,
            'longitude': pos.coords.longitude
          },
          label: source
        });
        updatedAnswer.push({
          label: 'map',
          value: source
        });
        updatedAnswer.push({
          label: 'latitude',
          value: pos.coords.latitude
        });
        updatedAnswer.push({
          label: 'longitude',
          value: pos.coords.longitude
        });
        toastInfo(locale.details.language[0].locationAcquired);
        props.onValueChange(updatedAnswer);
      } // console.log('Your current position is:');
      // console.log(`Latitude : ${crd.latitude}`);
      // console.log(`Longitude: ${crd.longitude}`);
      // console.log(`More or less ${crd.accuracy} meters.`);

    }

    function error(err) {// console.warn(`ERROR(${err.code}): ${err.message}`);
    }

    navigator.geolocation.getCurrentPosition(success, error, options);
  };

  const toastInfo = text => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: "bg-blue-600/80",
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$8$6.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.firstChild,
      _el$8 = _el$4.nextSibling,
      _el$10 = _el$3.nextSibling,
      _el$24 = _el$10.nextSibling,
      _el$25 = _el$24.nextSibling;

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$q.cloneNode(true);
      }

    }), null);

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$7 = _tmpl$2$f.cloneNode(true);

        _el$7.$$click = showInstruction;
        return _el$7;
      }

    }), null);

    insert(_el$8, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$9 = _tmpl$3$d.cloneNode(true);

        createRenderEffect(() => _el$9.innerHTML = props.component.hint);

        return _el$9;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return location() != '';
      },

      get children() {
        return createComponent$1(Switch, {
          get children() {
            return [createComponent$1(Match, {
              get when() {
                return config.clientMode === 2;
              },

              get children() {
                const _el$11 = _tmpl$4$a.cloneNode(true);

                _el$11.$$click = e => props.MobileOpenMap(props.value[0].value);

                return _el$11;
              }

            }), createComponent$1(Match, {
              get when() {
                return config.clientMode === 1;
              },

              get children() {
                const _el$12 = _tmpl$4$a.cloneNode(true);

                _el$12.$$click = e => window.open(`https://maps.google.com/maps?q=loc:` + latLong().latitude + "," + latLong().longitude, "_blank");

                return _el$12;
              }

            })];
          }

        });
      }

    }), null);

    insert(_el$10, createComponent$1(Switch, {
      get children() {
        return [createComponent$1(Match, {
          get when() {
            return config.clientMode === 2;
          },

          get children() {
            const _el$13 = _tmpl$5$8.cloneNode(true);

            _el$13.$$click = () => clickMobileGps();

            createRenderEffect(() => _el$13.disabled = disableInput());

            return _el$13;
          }

        }), createComponent$1(Match, {
          get when() {
            return config.clientMode === 1;
          },

          get children() {
            const _el$14 = _tmpl$5$8.cloneNode(true);

            _el$14.$$click = () => clickGps();

            createRenderEffect(() => _el$14.disabled = disableInput());

            return _el$14;
          }

        })];
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$15 = _tmpl$6$8.cloneNode(true),
          _el$16 = _el$15.firstChild,
          _el$17 = _el$16.nextSibling;

        _el$15.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$17, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$15.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$17.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$15;
      }

    }), null);

    insert(_el$2, createComponent$1(Show, {
      get when() {
        return location() != '';
      },

      get children() {
        const _el$18 = _tmpl$7$8.cloneNode(true),
          _el$19 = _el$18.firstChild,
          _el$20 = _el$19.firstChild,
          _el$21 = _el$20.firstChild,
          _el$22 = _el$21.nextSibling,
          _el$23 = _el$22.nextSibling;

        insert(_el$22, () => "lon : " + latLong().longitude);

        insert(_el$23, () => "lat : " + latLong().latitude);

        createRenderEffect(() => setAttribute(_el$21, "src", location()));

        return _el$18;
      }

    }), _el$24);

    insert(_el$25, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$26 = _tmpl$11$2.cloneNode(true),
              _el$27 = _el$26.firstChild,
              _el$30 = _el$27.firstChild;

            insert(_el$27, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$9$6.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$10$6.cloneNode(true);
                  }

                })];
              }

            }), _el$30);

            _el$30.innerHTML = item;

            createRenderEffect(_$p => classList(_el$27, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$26;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };
      _v$3 !== _p$._v$3 && (_el$5.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$24, _v$4, _p$._v$4);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined
    });

    return _el$;
  })();
}; // transition ease-in-out m-0

delegateEvents(["click"]);

var papaparse_min = { exports: {} };

/* @license
Papa Parse
v5.3.2
https://github.com/mholt/PapaParse
License: MIT
*/

(function (module, exports) {
  !function (e, t) { module.exports = t(); }(commonjsGlobal, function s() { var f = "undefined" != typeof self ? self : "undefined" != typeof window ? window : void 0 !== f ? f : {}; var n = !f.document && !!f.postMessage, o = n && /blob:/i.test((f.location || {}).protocol), a = {}, h = 0, b = { parse: function (e, t) { var i = (t = t || {}).dynamicTyping || !1; M(i) && (t.dynamicTypingFunction = i, i = {}); if (t.dynamicTyping = i, t.transform = !!M(t.transform) && t.transform, t.worker && b.WORKERS_SUPPORTED) { var r = function () { if (!b.WORKERS_SUPPORTED) return !1; var e = (i = f.URL || f.webkitURL || null, r = s.toString(), b.BLOB_URL || (b.BLOB_URL = i.createObjectURL(new Blob(["(", r, ")();"], { type: "text/javascript" })))), t = new f.Worker(e); var i, r; return t.onmessage = _, t.id = h++, a[t.id] = t }(); return r.userStep = t.step, r.userChunk = t.chunk, r.userComplete = t.complete, r.userError = t.error, t.step = M(t.step), t.chunk = M(t.chunk), t.complete = M(t.complete), t.error = M(t.error), delete t.worker, void r.postMessage({ input: e, config: t, workerId: r.id }) } var n = null; b.NODE_STREAM_INPUT, "string" == typeof e ? n = t.download ? new l(t) : new p(t) : !0 === e.readable && M(e.read) && M(e.on) ? n = new g(t) : (f.File && e instanceof File || e instanceof Object) && (n = new c(t)); return n.stream(e) }, unparse: function (e, t) { var n = !1, _ = !0, m = ",", y = "\r\n", s = '"', a = s + s, i = !1, r = null, o = !1; !function () { if ("object" != typeof t) return; "string" != typeof t.delimiter || b.BAD_DELIMITERS.filter(function (e) { return -1 !== t.delimiter.indexOf(e) }).length || (m = t.delimiter); ("boolean" == typeof t.quotes || "function" == typeof t.quotes || Array.isArray(t.quotes)) && (n = t.quotes); "boolean" != typeof t.skipEmptyLines && "string" != typeof t.skipEmptyLines || (i = t.skipEmptyLines); "string" == typeof t.newline && (y = t.newline); "string" == typeof t.quoteChar && (s = t.quoteChar); "boolean" == typeof t.header && (_ = t.header); if (Array.isArray(t.columns)) { if (0 === t.columns.length) throw new Error("Option columns is empty"); r = t.columns; } void 0 !== t.escapeChar && (a = t.escapeChar + s); ("boolean" == typeof t.escapeFormulae || t.escapeFormulae instanceof RegExp) && (o = t.escapeFormulae instanceof RegExp ? t.escapeFormulae : /^[=+\-@\t\r].*$/); }(); var h = new RegExp(j(s), "g"); "string" == typeof e && (e = JSON.parse(e)); if (Array.isArray(e)) { if (!e.length || Array.isArray(e[0])) return u(null, e, i); if ("object" == typeof e[0]) return u(r || Object.keys(e[0]), e, i) } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), Array.isArray(e.data) && (e.fields || (e.fields = e.meta && e.meta.fields || r), e.fields || (e.fields = Array.isArray(e.data[0]) ? e.fields : "object" == typeof e.data[0] ? Object.keys(e.data[0]) : []), Array.isArray(e.data[0]) || "object" == typeof e.data[0] || (e.data = [e.data])), u(e.fields || [], e.data || [], i); throw new Error("Unable to serialize unrecognized input"); function u(e, t, i) { var r = ""; "string" == typeof e && (e = JSON.parse(e)), "string" == typeof t && (t = JSON.parse(t)); var n = Array.isArray(e) && 0 < e.length, s = !Array.isArray(t[0]); if (n && _) { for (var a = 0; a < e.length; a++)0 < a && (r += m), r += v(e[a], a); 0 < t.length && (r += y); } for (var o = 0; o < t.length; o++) { var h = n ? e.length : t[o].length, u = !1, f = n ? 0 === Object.keys(t[o]).length : 0 === t[o].length; if (i && !n && (u = "greedy" === i ? "" === t[o].join("").trim() : 1 === t[o].length && 0 === t[o][0].length), "greedy" === i && n) { for (var d = [], l = 0; l < h; l++) { var c = s ? e[l] : l; d.push(t[o][c]); } u = "" === d.join("").trim(); } if (!u) { for (var p = 0; p < h; p++) { 0 < p && !f && (r += m); var g = n && s ? e[p] : p; r += v(t[o][g], p); } o < t.length - 1 && (!i || 0 < h && !f) && (r += y); } } return r } function v(e, t) { if (null == e) return ""; if (e.constructor === Date) return JSON.stringify(e).slice(1, 25); var i = !1; o && "string" == typeof e && o.test(e) && (e = "'" + e, i = !0); var r = e.toString().replace(h, a); return (i = i || !0 === n || "function" == typeof n && n(e, t) || Array.isArray(n) && n[t] || function (e, t) { for (var i = 0; i < t.length; i++)if (-1 < e.indexOf(t[i])) return !0; return !1 }(r, b.BAD_DELIMITERS) || -1 < r.indexOf(m) || " " === r.charAt(0) || " " === r.charAt(r.length - 1)) ? s + r + s : r } } }; if (b.RECORD_SEP = String.fromCharCode(30), b.UNIT_SEP = String.fromCharCode(31), b.BYTE_ORDER_MARK = "\ufeff", b.BAD_DELIMITERS = ["\r", "\n", '"', b.BYTE_ORDER_MARK], b.WORKERS_SUPPORTED = !n && !!f.Worker, b.NODE_STREAM_INPUT = 1, b.LocalChunkSize = 10485760, b.RemoteChunkSize = 5242880, b.DefaultDelimiter = ",", b.Parser = E, b.ParserHandle = i, b.NetworkStreamer = l, b.FileStreamer = c, b.StringStreamer = p, b.ReadableStreamStreamer = g, f.jQuery) { var d = f.jQuery; d.fn.parse = function (o) { var i = o.config || {}, h = []; return this.each(function (e) { if (!("INPUT" === d(this).prop("tagName").toUpperCase() && "file" === d(this).attr("type").toLowerCase() && f.FileReader) || !this.files || 0 === this.files.length) return !0; for (var t = 0; t < this.files.length; t++)h.push({ file: this.files[t], inputElem: this, instanceConfig: d.extend({}, i) }); }), e(), this; function e() { if (0 !== h.length) { var e, t, i, r, n = h[0]; if (M(o.before)) { var s = o.before(n.file, n.inputElem); if ("object" == typeof s) { if ("abort" === s.action) return e = "AbortError", t = n.file, i = n.inputElem, r = s.reason, void (M(o.error) && o.error({ name: e }, t, i, r)); if ("skip" === s.action) return void u(); "object" == typeof s.config && (n.instanceConfig = d.extend(n.instanceConfig, s.config)); } else if ("skip" === s) return void u() } var a = n.instanceConfig.complete; n.instanceConfig.complete = function (e) { M(a) && a(e, n.file, n.inputElem), u(); }, b.parse(n.file, n.instanceConfig); } else M(o.complete) && o.complete(); } function u() { h.splice(0, 1), e(); } }; } function u(e) { this._handle = null, this._finished = !1, this._completed = !1, this._halted = !1, this._input = null, this._baseIndex = 0, this._partialLine = "", this._rowCount = 0, this._start = 0, this._nextChunk = null, this.isFirstChunk = !0, this._completeResults = { data: [], errors: [], meta: {} }, function (e) { var t = w(e); t.chunkSize = parseInt(t.chunkSize), e.step || e.chunk || (t.chunkSize = null); this._handle = new i(t), (this._handle.streamer = this)._config = t; }.call(this, e), this.parseChunk = function (e, t) { if (this.isFirstChunk && M(this._config.beforeFirstChunk)) { var i = this._config.beforeFirstChunk(e); void 0 !== i && (e = i); } this.isFirstChunk = !1, this._halted = !1; var r = this._partialLine + e; this._partialLine = ""; var n = this._handle.parse(r, this._baseIndex, !this._finished); if (!this._handle.paused() && !this._handle.aborted()) { var s = n.meta.cursor; this._finished || (this._partialLine = r.substring(s - this._baseIndex), this._baseIndex = s), n && n.data && (this._rowCount += n.data.length); var a = this._finished || this._config.preview && this._rowCount >= this._config.preview; if (o) f.postMessage({ results: n, workerId: b.WORKER_ID, finished: a }); else if (M(this._config.chunk) && !t) { if (this._config.chunk(n, this._handle), this._handle.paused() || this._handle.aborted()) return void (this._halted = !0); n = void 0, this._completeResults = void 0; } return this._config.step || this._config.chunk || (this._completeResults.data = this._completeResults.data.concat(n.data), this._completeResults.errors = this._completeResults.errors.concat(n.errors), this._completeResults.meta = n.meta), this._completed || !a || !M(this._config.complete) || n && n.meta.aborted || (this._config.complete(this._completeResults, this._input), this._completed = !0), a || n && n.meta.paused || this._nextChunk(), n } this._halted = !0; }, this._sendError = function (e) { M(this._config.error) ? this._config.error(e) : o && this._config.error && f.postMessage({ workerId: b.WORKER_ID, error: e, finished: !1 }); }; } function l(e) { var r; (e = e || {}).chunkSize || (e.chunkSize = b.RemoteChunkSize), u.call(this, e), this._nextChunk = n ? function () { this._readChunk(), this._chunkLoaded(); } : function () { this._readChunk(); }, this.stream = function (e) { this._input = e, this._nextChunk(); }, this._readChunk = function () { if (this._finished) this._chunkLoaded(); else { if (r = new XMLHttpRequest, this._config.withCredentials && (r.withCredentials = this._config.withCredentials), n || (r.onload = v(this._chunkLoaded, this), r.onerror = v(this._chunkError, this)), r.open(this._config.downloadRequestBody ? "POST" : "GET", this._input, !n), this._config.downloadRequestHeaders) { var e = this._config.downloadRequestHeaders; for (var t in e) r.setRequestHeader(t, e[t]); } if (this._config.chunkSize) { var i = this._start + this._config.chunkSize - 1; r.setRequestHeader("Range", "bytes=" + this._start + "-" + i); } try { r.send(this._config.downloadRequestBody); } catch (e) { this._chunkError(e.message); } n && 0 === r.status && this._chunkError(); } }, this._chunkLoaded = function () { 4 === r.readyState && (r.status < 200 || 400 <= r.status ? this._chunkError() : (this._start += this._config.chunkSize ? this._config.chunkSize : r.responseText.length, this._finished = !this._config.chunkSize || this._start >= function (e) { var t = e.getResponseHeader("Content-Range"); if (null === t) return -1; return parseInt(t.substring(t.lastIndexOf("/") + 1)) }(r), this.parseChunk(r.responseText))); }, this._chunkError = function (e) { var t = r.statusText || e; this._sendError(new Error(t)); }; } function c(e) { var r, n; (e = e || {}).chunkSize || (e.chunkSize = b.LocalChunkSize), u.call(this, e); var s = "undefined" != typeof FileReader; this.stream = function (e) { this._input = e, n = e.slice || e.webkitSlice || e.mozSlice, s ? ((r = new FileReader).onload = v(this._chunkLoaded, this), r.onerror = v(this._chunkError, this)) : r = new FileReaderSync, this._nextChunk(); }, this._nextChunk = function () { this._finished || this._config.preview && !(this._rowCount < this._config.preview) || this._readChunk(); }, this._readChunk = function () { var e = this._input; if (this._config.chunkSize) { var t = Math.min(this._start + this._config.chunkSize, this._input.size); e = n.call(e, this._start, t); } var i = r.readAsText(e, this._config.encoding); s || this._chunkLoaded({ target: { result: i } }); }, this._chunkLoaded = function (e) { this._start += this._config.chunkSize, this._finished = !this._config.chunkSize || this._start >= this._input.size, this.parseChunk(e.target.result); }, this._chunkError = function () { this._sendError(r.error); }; } function p(e) { var i; u.call(this, e = e || {}), this.stream = function (e) { return i = e, this._nextChunk() }, this._nextChunk = function () { if (!this._finished) { var e, t = this._config.chunkSize; return t ? (e = i.substring(0, t), i = i.substring(t)) : (e = i, i = ""), this._finished = !i, this.parseChunk(e) } }; } function g(e) { u.call(this, e = e || {}); var t = [], i = !0, r = !1; this.pause = function () { u.prototype.pause.apply(this, arguments), this._input.pause(); }, this.resume = function () { u.prototype.resume.apply(this, arguments), this._input.resume(); }, this.stream = function (e) { this._input = e, this._input.on("data", this._streamData), this._input.on("end", this._streamEnd), this._input.on("error", this._streamError); }, this._checkIsFinished = function () { r && 1 === t.length && (this._finished = !0); }, this._nextChunk = function () { this._checkIsFinished(), t.length ? this.parseChunk(t.shift()) : i = !0; }, this._streamData = v(function (e) { try { t.push("string" == typeof e ? e : e.toString(this._config.encoding)), i && (i = !1, this._checkIsFinished(), this.parseChunk(t.shift())); } catch (e) { this._streamError(e); } }, this), this._streamError = v(function (e) { this._streamCleanUp(), this._sendError(e); }, this), this._streamEnd = v(function () { this._streamCleanUp(), r = !0, this._streamData(""); }, this), this._streamCleanUp = v(function () { this._input.removeListener("data", this._streamData), this._input.removeListener("end", this._streamEnd), this._input.removeListener("error", this._streamError); }, this); } function i(m) { var a, o, h, r = Math.pow(2, 53), n = -r, s = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/, u = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))$/, t = this, i = 0, f = 0, d = !1, e = !1, l = [], c = { data: [], errors: [], meta: {} }; if (M(m.step)) { var p = m.step; m.step = function (e) { if (c = e, _()) g(); else { if (g(), 0 === c.data.length) return; i += e.data.length, m.preview && i > m.preview ? o.abort() : (c.data = c.data[0], p(c, t)); } }; } function y(e) { return "greedy" === m.skipEmptyLines ? "" === e.join("").trim() : 1 === e.length && 0 === e[0].length } function g() { return c && h && (k("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + b.DefaultDelimiter + "'"), h = !1), m.skipEmptyLines && (c.data = c.data.filter(function (e) { return !y(e) })), _() && function () { if (!c) return; function e(e, t) { M(m.transformHeader) && (e = m.transformHeader(e, t)), l.push(e); } if (Array.isArray(c.data[0])) { for (var t = 0; _() && t < c.data.length; t++)c.data[t].forEach(e); c.data.splice(0, 1); } else c.data.forEach(e); }(), function () { if (!c || !m.header && !m.dynamicTyping && !m.transform) return c; function e(e, t) { var i, r = m.header ? {} : []; for (i = 0; i < e.length; i++) { var n = i, s = e[i]; m.header && (n = i >= l.length ? "__parsed_extra" : l[i]), m.transform && (s = m.transform(s, n)), s = v(n, s), "__parsed_extra" === n ? (r[n] = r[n] || [], r[n].push(s)) : r[n] = s; } return m.header && (i > l.length ? k("FieldMismatch", "TooManyFields", "Too many fields: expected " + l.length + " fields but parsed " + i, f + t) : i < l.length && k("FieldMismatch", "TooFewFields", "Too few fields: expected " + l.length + " fields but parsed " + i, f + t)), r } var t = 1; !c.data.length || Array.isArray(c.data[0]) ? (c.data = c.data.map(e), t = c.data.length) : c.data = e(c.data, 0); m.header && c.meta && (c.meta.fields = l); return f += t, c }() } function _() { return m.header && 0 === l.length } function v(e, t) { return i = e, m.dynamicTypingFunction && void 0 === m.dynamicTyping[i] && (m.dynamicTyping[i] = m.dynamicTypingFunction(i)), !0 === (m.dynamicTyping[i] || m.dynamicTyping) ? "true" === t || "TRUE" === t || "false" !== t && "FALSE" !== t && (function (e) { if (s.test(e)) { var t = parseFloat(e); if (n < t && t < r) return !0 } return !1 }(t) ? parseFloat(t) : u.test(t) ? new Date(t) : "" === t ? null : t) : t; var i; } function k(e, t, i, r) { var n = { type: e, code: t, message: i }; void 0 !== r && (n.row = r), c.errors.push(n); } this.parse = function (e, t, i) { var r = m.quoteChar || '"'; if (m.newline || (m.newline = function (e, t) { e = e.substring(0, 1048576); var i = new RegExp(j(t) + "([^]*?)" + j(t), "gm"), r = (e = e.replace(i, "")).split("\r"), n = e.split("\n"), s = 1 < n.length && n[0].length < r[0].length; if (1 === r.length || s) return "\n"; for (var a = 0, o = 0; o < r.length; o++)"\n" === r[o][0] && a++; return a >= r.length / 2 ? "\r\n" : "\r" }(e, r)), h = !1, m.delimiter) M(m.delimiter) && (m.delimiter = m.delimiter(e), c.meta.delimiter = m.delimiter); else { var n = function (e, t, i, r, n) { var s, a, o, h; n = n || [",", "\t", "|", ";", b.RECORD_SEP, b.UNIT_SEP]; for (var u = 0; u < n.length; u++) { var f = n[u], d = 0, l = 0, c = 0; o = void 0; for (var p = new E({ comments: r, delimiter: f, newline: t, preview: 10 }).parse(e), g = 0; g < p.data.length; g++)if (i && y(p.data[g])) c++; else { var _ = p.data[g].length; l += _, void 0 !== o ? 0 < _ && (d += Math.abs(_ - o), o = _) : o = _; } 0 < p.data.length && (l /= p.data.length - c), (void 0 === a || d <= a) && (void 0 === h || h < l) && 1.99 < l && (a = d, s = f, h = l); } return { successful: !!(m.delimiter = s), bestDelimiter: s } }(e, m.newline, m.skipEmptyLines, m.comments, m.delimitersToGuess); n.successful ? m.delimiter = n.bestDelimiter : (h = !0, m.delimiter = b.DefaultDelimiter), c.meta.delimiter = m.delimiter; } var s = w(m); return m.preview && m.header && s.preview++, a = e, o = new E(s), c = o.parse(a, t, i), g(), d ? { meta: { paused: !0 } } : c || { meta: { paused: !1 } } }, this.paused = function () { return d }, this.pause = function () { d = !0, o.abort(), a = M(m.chunk) ? "" : a.substring(o.getCharIndex()); }, this.resume = function () { t.streamer._halted ? (d = !1, t.streamer.parseChunk(a, !0)) : setTimeout(t.resume, 3); }, this.aborted = function () { return e }, this.abort = function () { e = !0, o.abort(), c.meta.aborted = !0, M(m.complete) && m.complete(c), a = ""; }; } function j(e) { return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } function E(e) { var S, O = (e = e || {}).delimiter, x = e.newline, I = e.comments, T = e.step, D = e.preview, A = e.fastMode, L = S = void 0 === e.quoteChar || null === e.quoteChar ? '"' : e.quoteChar; if (void 0 !== e.escapeChar && (L = e.escapeChar), ("string" != typeof O || -1 < b.BAD_DELIMITERS.indexOf(O)) && (O = ","), I === O) throw new Error("Comment character same as delimiter"); !0 === I ? I = "#" : ("string" != typeof I || -1 < b.BAD_DELIMITERS.indexOf(I)) && (I = !1), "\n" !== x && "\r" !== x && "\r\n" !== x && (x = "\n"); var F = 0, z = !1; this.parse = function (r, t, i) { if ("string" != typeof r) throw new Error("Input must be a string"); var n = r.length, e = O.length, s = x.length, a = I.length, o = M(T), h = [], u = [], f = [], d = F = 0; if (!r) return C(); if (A || !1 !== A && -1 === r.indexOf(S)) { for (var l = r.split(x), c = 0; c < l.length; c++) { if (f = l[c], F += f.length, c !== l.length - 1) F += x.length; else if (i) return C(); if (!I || f.substring(0, a) !== I) { if (o) { if (h = [], k(f.split(O)), R(), z) return C() } else k(f.split(O)); if (D && D <= c) return h = h.slice(0, D), C(!0) } } return C() } for (var p = r.indexOf(O, F), g = r.indexOf(x, F), _ = new RegExp(j(L) + j(S), "g"), m = r.indexOf(S, F); ;)if (r[F] !== S) if (I && 0 === f.length && r.substring(F, F + a) === I) { if (-1 === g) return C(); F = g + s, g = r.indexOf(x, F), p = r.indexOf(O, F); } else if (-1 !== p && (p < g || -1 === g)) f.push(r.substring(F, p)), F = p + e, p = r.indexOf(O, F); else { if (-1 === g) break; if (f.push(r.substring(F, g)), w(g + s), o && (R(), z)) return C(); if (D && h.length >= D) return C(!0) } else for (m = F, F++; ;) { if (-1 === (m = r.indexOf(S, m + 1))) return i || u.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: h.length, index: F }), E(); if (m === n - 1) return E(r.substring(F, m).replace(_, S)); if (S !== L || r[m + 1] !== L) { if (S === L || 0 === m || r[m - 1] !== L) { -1 !== p && p < m + 1 && (p = r.indexOf(O, m + 1)), -1 !== g && g < m + 1 && (g = r.indexOf(x, m + 1)); var y = b(-1 === g ? p : Math.min(p, g)); if (r.substr(m + 1 + y, e) === O) { f.push(r.substring(F, m).replace(_, S)), r[F = m + 1 + y + e] !== S && (m = r.indexOf(S, F)), p = r.indexOf(O, F), g = r.indexOf(x, F); break } var v = b(g); if (r.substring(m + 1 + v, m + 1 + v + s) === x) { if (f.push(r.substring(F, m).replace(_, S)), w(m + 1 + v + s), p = r.indexOf(O, F), m = r.indexOf(S, F), o && (R(), z)) return C(); if (D && h.length >= D) return C(!0); break } u.push({ type: "Quotes", code: "InvalidQuotes", message: "Trailing quote on quoted field is malformed", row: h.length, index: F }), m++; } } else m++; } return E(); function k(e) { h.push(e), d = F; } function b(e) { var t = 0; if (-1 !== e) { var i = r.substring(m + 1, e); i && "" === i.trim() && (t = i.length); } return t } function E(e) { return i || (void 0 === e && (e = r.substring(F)), f.push(e), F = n, k(f), o && R()), C() } function w(e) { F = e, k(f), f = [], g = r.indexOf(x, F); } function C(e) { return { data: h, errors: u, meta: { delimiter: O, linebreak: x, aborted: z, truncated: !!e, cursor: d + (t || 0) } } } function R() { T(C()), h = [], u = []; } }, this.abort = function () { z = !0; }, this.getCharIndex = function () { return F }; } function _(e) { var t = e.data, i = a[t.workerId], r = !1; if (t.error) i.userError(t.error, t.file); else if (t.results && t.results.data) { var n = { abort: function () { r = !0, m(t.workerId, { data: [], errors: [], meta: { aborted: !0 } }); }, pause: y, resume: y }; if (M(i.userStep)) { for (var s = 0; s < t.results.data.length && (i.userStep({ data: t.results.data[s], errors: t.results.errors, meta: t.results.meta }, n), !r); s++); delete t.results; } else M(i.userChunk) && (i.userChunk(t.results, n, t.file), delete t.results); } t.finished && !r && m(t.workerId, t.results); } function m(e, t) { var i = a[e]; M(i.userComplete) && i.userComplete(t), i.terminate(), delete a[e]; } function y() { throw new Error("Not implemented.") } function w(e) { if ("object" != typeof e || null === e) return e; var t = Array.isArray(e) ? [] : {}; for (var i in e) t[i] = w(e[i]); return t } function v(e, t) { return function () { e.apply(t, arguments); } } function M(e) { return "function" == typeof e } return o && (f.onmessage = function (e) { var t = e.data; void 0 === b.WORKER_ID && t && (b.WORKER_ID = t.workerId); if ("string" == typeof t.input) f.postMessage({ workerId: b.WORKER_ID, results: b.parse(t.input, t.config), finished: !0 }); else if (f.File && t.input instanceof File || t.input instanceof Object) { var i = b.parse(t.input, t.config); i && f.postMessage({ workerId: b.WORKER_ID, results: i, finished: !0 }); } }), (l.prototype = Object.create(u.prototype)).constructor = l, (c.prototype = Object.create(u.prototype)).constructor = c, (p.prototype = Object.create(p.prototype)).constructor = p, (g.prototype = Object.create(u.prototype)).constructor = g, b });
}(papaparse_min));

var Papa = papaparse_min.exports;

const _tmpl$$p = /*#__PURE__*/template$1(`<div class="backdrop-blur-sm overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none justify-center items-center flex"><svg class="w-20 h-20 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94.53 98.372"><circle cx="23.536" cy="16.331" r="8.646" style="fill:#0a77e8"></circle><circle cx="8.646" cy="36.698" r="8.646" style="fill:#0f9af0"></circle><circle cx="8.646" cy="61.867" r="8.646" style="fill:#0f9af0"></circle><circle cx="23.536" cy="82.233" r="8.646" style="fill:#13bdf7"></circle><circle cx="47.361" cy="89.726" r="8.646" style="fill:#13bdf7"></circle><circle cx="71.282" cy="82.233" r="8.646" style="fill:#18e0ff"></circle><circle cx="85.884" cy="61.867" r="8.646" style="fill:#65eaff"></circle><circle cx="85.884" cy="36.698" r="8.646" style="fill:#b2f5ff"></circle><circle cx="47.361" cy="8.646" r="8.646" style="fill:#1d4970"></circle></svg></div>`),
  _tmpl$2$e = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$3$c = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$4$9 = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$5$7 = /*#__PURE__*/template$1(`<button class="bg-white text-gray-500 p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-teal-200 hover:text-teal-400 hover:border-teal-200 border-2 border-gray-300 "><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>`),
  _tmpl$6$7 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                        text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button>`),
  _tmpl$7$7 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4"><div class="preview-class"><div class="container mx-auto"><div class="scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-500 
                        overflow-x-scroll scrollbar-thumb-rounded-full scrollbar-track-rounded-full"><table class="table-auto w-full"><thead class="text-xs font-semibold uppercase text-gray-400 bg-gray-50"><tr></tr></thead><tbody class="text-sm divide-y divide-gray-100"></tbody></table></div><br><span class="bg-red-100 text-red-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-red-200 dark:text-red-800"></span><span class="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-800"></span></div></div></div>`),
  _tmpl$8$5 = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-11"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 space-y-4 flex justify-end -mt-2"><input type="file" accept=".csv" style="color: transparent;" class="hidden w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"><button class="bg-white text-gray-500 p-2 mr-2 rounded-full focus:outline-none h-10 w-10 hover:bg-fuchsia-200 hover:text-fuchsia-400 hover:border-fuchsia-200 border-2 border-gray-300  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></button></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$9$5 = /*#__PURE__*/template$1(`<th class="p-2 whitespace-nowrap"><div class="font-semibold text-left"></div></th>`),
  _tmpl$10$5 = /*#__PURE__*/template$1(`<tr></tr>`),
  _tmpl$11$1 = /*#__PURE__*/template$1(`<td class="p-2 whitespace-nowrap"><div class="text-left"></div></td>`),
  _tmpl$12$1 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$13$1 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$14$1 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const CsvInput = props => {
  const [thead, setTHead] = createSignal([]);
  const [tbody, setTbody] = createSignal([]);
  createSignal('');
  const [isUploading, setIsUploading] = createSignal(false);
  createSignal('');
  let reader = new FileReader();
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  createEffect(() => {
    if (props.value) {
      // console.log('json',props.value)
      // console.log('thead',Object.keys(props.value[0]))
      // console.log('tbody',[...[Object.values(props.value[0])],Object.values(props.value[1]),Object.values(props.value[2]),Object.values(props.value[3]),Object.values(props.value[4])])
      // console.log('rows',props.value.length+1)
      setTHead(Object.keys(props.value[0]));
      setTbody([...[Object.values(props.value[0])], Object.values(props.value[1]), Object.values(props.value[2]), Object.values(props.value[3]), Object.values(props.value[4])]);
    }
  });

  let getFileContent = data => {
    setIsUploading(true);
    JSON.parse(JSON.stringify(props.value));

    if (data.target.files && data.target.files[0]) {
      var allowedExtension = ['csv', 'txt'];
      let doc = data.target.files[0];
      let ext = doc.name.split('.').pop().toLowerCase();

      if (!allowedExtension.includes(ext)) {
        toastInfo(locale.details.language[0].fileInvalidFormat, 'bg-pink-600/70');
      } else {
        let docSize = (doc.size / (1024 * 1024)).toFixed(2);
        let validMinDocSize = true,
          validMaxDocSize = true;

        if (props.component.sizeInput) {
          validMinDocSize = props.component.sizeInput[0].min !== undefined ? Number(docSize) > Number(props.component.sizeInput[0].min) : true;
          validMaxDocSize = props.component.sizeInput[0].max !== undefined ? Number(docSize) < Number(props.component.sizeInput[0].max) : true;
          !validMaxDocSize && toastInfo(locale.details.language[0].fileInvalidMaxSize + props.component.sizeInput[0].max, 'bg-pink-600/70');
          !validMinDocSize && toastInfo(locale.details.language[0].fileInvalidMinSize + props.component.sizeInput[0].min, 'bg-pink-600/70');
          setIsUploading(false);
        }

        if (validMinDocSize && validMaxDocSize) {
          reader.readAsDataURL(doc);

          reader.onload = e => {
            Papa.parse(doc, {
              download: true,
              delimiter: "",
              // auto-detect
              complete: function (results) {
                let keys = results.data[0];
                let rows = [...[results.data[1]], results.data[2], results.data[3], results.data[4], results.data[5]];
                let jsonCsv = results.data.slice(1).map(item => {
                  var arr = {};
                  keys.forEach((i, v) => {
                    arr[i] = item[v];
                  });
                  return arr;
                }); // console.log('keys', keys)
                // console.log('rows', rows)
                // console.log('jsonCsv', jsonCsv)

                setTHead(keys);
                setTbody(rows);
                setIsUploading(false);
                props.onValueChange(jsonCsv);
                toastInfo(locale.details.language[0].fileUploaded, '');
              }
            });
          };
        }
      }
    }
  };

  const downloadFile = ({
    data,
    fileName,
    fileType
  }) => {
    // Create a blob with the data we want to download as a file
    const blob = new Blob([data], {
      type: fileType
    }); // Create an anchor element and dispatch a click event on it
    // to trigger a download

    const a = document.createElement('a');
    a.download = fileName;
    a.href = window.URL.createObjectURL(blob);
    const clickEvt = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    a.dispatchEvent(clickEvt);
    a.remove();
  };

  const downloadCsv = e => {
    e.preventDefault(); //json
    // downloadFile({
    //     data: JSON.stringify(props.value),
    //     fileName: props.component.dataKey+'.json',
    //     fileType: 'text/json',
    // })
    //csv

    downloadFile({
      data: Papa.unparse(props.value, {
        quotes: false,
        //or array of booleans
        quoteChar: '"',
        escapeChar: '"',
        delimiter: "|",
        header: true,
        newline: "\r\n",
        skipEmptyLines: false,
        //other option is 'greedy', meaning skip delimiters, quotes, and whitespace.
        columns: null //or array of strings

      }),
      fileName: props.component.dataKey + '.csv',
      fileType: 'text/csv'
    });
  };

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$8$5.cloneNode(true),
      _el$3 = _el$.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.firstChild,
      _el$6 = _el$5.firstChild,
      _el$9 = _el$5.nextSibling,
      _el$11 = _el$4.nextSibling,
      _el$12 = _el$11.firstChild,
      _el$14 = _el$12.nextSibling,
      _el$29 = _el$11.nextSibling,
      _el$30 = _el$29.nextSibling;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return isUploading();
      },

      get children() {
        return _tmpl$$p.cloneNode(true);
      }

    }), _el$3);

    insert(_el$5, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$2$e.cloneNode(true);
      }

    }), null);

    insert(_el$5, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$8 = _tmpl$3$c.cloneNode(true);

        _el$8.$$click = showInstruction;
        return _el$8;
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$10 = _tmpl$4$9.cloneNode(true);

        createRenderEffect(() => _el$10.innerHTML = props.component.hint);

        return _el$10;
      }

    }));

    _el$12.addEventListener("change", e => {
      getFileContent(e);
    });

    insert(_el$11, createComponent$1(Show, {
      get when() {
        return props.value;
      },

      get children() {
        const _el$13 = _tmpl$5$7.cloneNode(true);

        _el$13.$$click = e => downloadCsv(e);

        return _el$13;
      }

    }), _el$14);

    _el$14.$$click = e => {
      document.getElementById("inputFile_" + props.component.dataKey).click();
    };

    insert(_el$11, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$15 = _tmpl$6$7.cloneNode(true),
          _el$16 = _el$15.firstChild,
          _el$17 = _el$16.nextSibling;

        _el$15.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$17, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$15.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$17.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$15;
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.value;
      },

      get children() {
        const _el$18 = _tmpl$7$7.cloneNode(true),
          _el$19 = _el$18.firstChild,
          _el$20 = _el$19.firstChild,
          _el$21 = _el$20.firstChild,
          _el$22 = _el$21.firstChild,
          _el$23 = _el$22.firstChild,
          _el$24 = _el$23.firstChild,
          _el$25 = _el$23.nextSibling,
          _el$26 = _el$21.nextSibling,
          _el$27 = _el$26.nextSibling,
          _el$28 = _el$27.nextSibling;

        insert(_el$24, createComponent$1(For, {
          get each() {
            return thead();
          },

          children: (item, index) => (() => {
            const _el$31 = _tmpl$9$5.cloneNode(true),
              _el$32 = _el$31.firstChild;

            insert(_el$32, item);

            return _el$31;
          })()
        }));

        insert(_el$25, createComponent$1(For, {
          get each() {
            return tbody();
          },

          children: (item, index) => (() => {
            const _el$33 = _tmpl$10$5.cloneNode(true);

            insert(_el$33, createComponent$1(For, {
              each: item,
              children: (item_td, index_td) => (() => {
                const _el$34 = _tmpl$11$1.cloneNode(true),
                  _el$35 = _el$34.firstChild;

                insert(_el$35, item_td);

                return _el$34;
              })()
            }));

            return _el$33;
          })()
        }));

        insert(_el$27, () => "rows : " + Number(props.value.length + 1));

        insert(_el$28, () => "cols : " + thead().length);

        return _el$18;
      }

    }), _el$29);

    insert(_el$30, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$36 = _tmpl$14$1.cloneNode(true),
              _el$37 = _el$36.firstChild,
              _el$40 = _el$37.firstChild;

            insert(_el$37, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$12$1.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$13$1.cloneNode(true);
                  }

                })];
              }

            }), _el$40);

            _el$40.innerHTML = item;

            createRenderEffect(_$p => classList(_el$37, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$36;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = "inputFile_" + props.component.dataKey,
        _v$5 = props.component.dataKey,
        _v$6 = disableInput(),
        _v$7 = locale.details.language[0].uploadCsv,
        _v$8 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };

      _v$3 !== _p$._v$3 && (_el$6.innerHTML = _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && setAttribute(_el$12, "id", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && setAttribute(_el$12, "name", _p$._v$5 = _v$5);
      _v$6 !== _p$._v$6 && (_el$14.disabled = _p$._v$6 = _v$6);
      _v$7 !== _p$._v$7 && setAttribute(_el$14, "title", _p$._v$7 = _v$7);
      _p$._v$8 = classList(_el$29, _v$8, _p$._v$8);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined,
      _v$6: undefined,
      _v$7: undefined,
      _v$8: undefined
    });

    return _el$;
  })();
}; // transition ease-in-out m-0

delegateEvents(["click"]);

const _tmpl$$o = /*#__PURE__*/template$1(`<div class="modal-confirmation fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="sm:flex sm:items-start"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalConfirmation">Confirmation</h3><div class="mt-2"><p class="text-sm text-gray-500" id="contentModalConfirmation">Are you sure you want to get present time?</p></div></div></div></div><div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">Get Time</button><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button></div></div></div></div>`),
  _tmpl$2$d = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$3$b = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$4$8 = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$5$6 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button>`),
  _tmpl$6$6 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4 -mt-2"><span class="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-800"></span></div>`),
  _tmpl$7$6 = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-11"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 space-y-4 flex justify-end items-end -mt-2"><button class="bg-white text-gray-500 p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-teal-200 hover:text-teal-400 hover:border-teal-200 border-2 border-gray-300  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$8$4 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$4 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$4 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const NowInput = props => {
  const config = props.config;
  const [showModal, setShowModal] = createSignal(0);
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);

  const handleOnClick = () => {
    setShowModal(1);
    modalConfirmation();
  };

  const handleOnPick = () => {
    let dateNow = dayjs().format('YYYY-MM-DD HH:mm:ss');
    props.onValueChange(dateNow);
  };

  let handleOnCancel = () => {
    setShowModal(0);
  };

  const modalConfirmation = () => {
    let titleModal = document.querySelector("#titleModalConfirmation");
    let contentModal = document.querySelector("#contentModalConfirmation");
    titleModal.innerHTML = props.component.titleModalConfirmation !== undefined ? props.component.titleModalConfirmation : 'Confirmation';
    contentModal.innerHTML = props.component.contentModalConfirmation !== undefined ? props.component.contentModalConfirmation : 'Are you certain to generate the current time?';
  };

  return (() => {
    const _el$ = _tmpl$7$6.cloneNode(true),
      _el$11 = _el$.firstChild,
      _el$12 = _el$11.firstChild,
      _el$13 = _el$12.firstChild,
      _el$14 = _el$13.firstChild,
      _el$17 = _el$13.nextSibling,
      _el$19 = _el$12.nextSibling,
      _el$20 = _el$19.firstChild,
      _el$26 = _el$19.nextSibling,
      _el$27 = _el$26.nextSibling;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return showModal() == 1;
      },

      get children() {
        const _el$2 = _tmpl$$o.cloneNode(true),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.nextSibling,
          _el$6 = _el$5.nextSibling,
          _el$7 = _el$6.firstChild,
          _el$8 = _el$7.nextSibling,
          _el$9 = _el$8.firstChild,
          _el$10 = _el$9.nextSibling;

        _el$9.$$click = e => handleOnPick();

        _el$10.$$click = e => handleOnCancel();

        return _el$2;
      }

    }), _el$11);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$2$d.cloneNode(true);
      }

    }), null);

    insert(_el$13, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$16 = _tmpl$3$b.cloneNode(true);

        _el$16.$$click = showInstruction;
        return _el$16;
      }

    }), null);

    insert(_el$17, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$18 = _tmpl$4$8.cloneNode(true);

        createRenderEffect(() => _el$18.innerHTML = props.component.hint);

        return _el$18;
      }

    }));

    _el$20.$$click = () => handleOnClick();

    insert(_el$19, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$21 = _tmpl$5$6.cloneNode(true),
          _el$22 = _el$21.firstChild,
          _el$23 = _el$22.nextSibling;

        _el$21.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$23, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$21.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$23.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$21;
      }

    }), null);

    insert(_el$11, createComponent$1(Show, {
      get when() {
        return props.value !== '';
      },

      get children() {
        const _el$24 = _tmpl$6$6.cloneNode(true),
          _el$25 = _el$24.firstChild;

        insert(_el$25, () => props.value);

        return _el$24;
      }

    }), _el$26);

    insert(_el$27, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$28 = _tmpl$10$4.cloneNode(true),
              _el$29 = _el$28.firstChild,
              _el$32 = _el$29.firstChild;

            insert(_el$29, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$4.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$4.cloneNode(true);
                  }

                })];
              }

            }), _el$32);

            _el$32.innerHTML = item;

            createRenderEffect(_$p => classList(_el$29, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$28;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = disableInput(),
        _v$5 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };

      _v$3 !== _p$._v$3 && (_el$14.innerHTML = _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && (_el$20.disabled = _p$._v$4 = _v$4);
      _p$._v$5 = classList(_el$26, _v$5, _p$._v$5);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

/*!
 * Signature Pad v4.0.5 | https://github.com/szimek/signature_pad
 * (c) 2022 Szymon Nowak | Released under the MIT license
 */

class Point {
  constructor(x, y, pressure, time) {
    if (isNaN(x) || isNaN(y)) {
      throw new Error(`Point is invalid: (${x}, ${y})`);
    }
    this.x = +x;
    this.y = +y;
    this.pressure = pressure || 0;
    this.time = time || Date.now();
  }
  distanceTo(start) {
    return Math.sqrt(Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2));
  }
  equals(other) {
    return (this.x === other.x &&
      this.y === other.y &&
      this.pressure === other.pressure &&
      this.time === other.time);
  }
  velocityFrom(start) {
    return this.time !== start.time
      ? this.distanceTo(start) / (this.time - start.time)
      : 0;
  }
}

class Bezier {
  constructor(startPoint, control2, control1, endPoint, startWidth, endWidth) {
    this.startPoint = startPoint;
    this.control2 = control2;
    this.control1 = control1;
    this.endPoint = endPoint;
    this.startWidth = startWidth;
    this.endWidth = endWidth;
  }
  static fromPoints(points, widths) {
    const c2 = this.calculateControlPoints(points[0], points[1], points[2]).c2;
    const c3 = this.calculateControlPoints(points[1], points[2], points[3]).c1;
    return new Bezier(points[1], c2, c3, points[2], widths.start, widths.end);
  }
  static calculateControlPoints(s1, s2, s3) {
    const dx1 = s1.x - s2.x;
    const dy1 = s1.y - s2.y;
    const dx2 = s2.x - s3.x;
    const dy2 = s2.y - s3.y;
    const m1 = { x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0 };
    const m2 = { x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0 };
    const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    const dxm = m1.x - m2.x;
    const dym = m1.y - m2.y;
    const k = l2 / (l1 + l2);
    const cm = { x: m2.x + dxm * k, y: m2.y + dym * k };
    const tx = s2.x - cm.x;
    const ty = s2.y - cm.y;
    return {
      c1: new Point(m1.x + tx, m1.y + ty),
      c2: new Point(m2.x + tx, m2.y + ty),
    };
  }
  length() {
    const steps = 10;
    let length = 0;
    let px;
    let py;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const cx = this.point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
      const cy = this.point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);
      if (i > 0) {
        const xdiff = cx - px;
        const ydiff = cy - py;
        length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
      }
      px = cx;
      py = cy;
    }
    return length;
  }
  point(t, start, c1, c2, end) {
    return (start * (1.0 - t) * (1.0 - t) * (1.0 - t))
      + (3.0 * c1 * (1.0 - t) * (1.0 - t) * t)
      + (3.0 * c2 * (1.0 - t) * t * t)
      + (end * t * t * t);
  }
}

class SignatureEventTarget {
  constructor() {
    try {
      this._et = new EventTarget();
    }
    catch (error) {
      this._et = document;
    }
  }
  addEventListener(type, listener, options) {
    this._et.addEventListener(type, listener, options);
  }
  dispatchEvent(event) {
    return this._et.dispatchEvent(event);
  }
  removeEventListener(type, callback, options) {
    this._et.removeEventListener(type, callback, options);
  }
}

function throttle(fn, wait = 250) {
  let previous = 0;
  let timeout = null;
  let result;
  let storedContext;
  let storedArgs;
  const later = () => {
    previous = Date.now();
    timeout = null;
    result = fn.apply(storedContext, storedArgs);
    if (!timeout) {
      storedContext = null;
      storedArgs = [];
    }
  };
  return function wrapper(...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);
    storedContext = this;
    storedArgs = args;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = fn.apply(storedContext, storedArgs);
      if (!timeout) {
        storedContext = null;
        storedArgs = [];
      }
    }
    else if (!timeout) {
      timeout = window.setTimeout(later, remaining);
    }
    return result;
  };
}

class SignaturePad extends SignatureEventTarget {
  constructor(canvas, options = {}) {
    super();
    this.canvas = canvas;
    this._handleMouseDown = (event) => {
      if (event.buttons === 1) {
        this._drawningStroke = true;
        this._strokeBegin(event);
      }
    };
    this._handleMouseMove = (event) => {
      if (this._drawningStroke) {
        this._strokeMoveUpdate(event);
      }
    };
    this._handleMouseUp = (event) => {
      if (event.buttons === 1 && this._drawningStroke) {
        this._drawningStroke = false;
        this._strokeEnd(event);
      }
    };
    this._handleTouchStart = (event) => {
      event.preventDefault();
      if (event.targetTouches.length === 1) {
        const touch = event.changedTouches[0];
        this._strokeBegin(touch);
      }
    };
    this._handleTouchMove = (event) => {
      event.preventDefault();
      const touch = event.targetTouches[0];
      this._strokeMoveUpdate(touch);
    };
    this._handleTouchEnd = (event) => {
      const wasCanvasTouched = event.target === this.canvas;
      if (wasCanvasTouched) {
        event.preventDefault();
        const touch = event.changedTouches[0];
        this._strokeEnd(touch);
      }
    };
    this._handlePointerStart = (event) => {
      this._drawningStroke = true;
      event.preventDefault();
      this._strokeBegin(event);
    };
    this._handlePointerMove = (event) => {
      if (this._drawningStroke) {
        event.preventDefault();
        this._strokeMoveUpdate(event);
      }
    };
    this._handlePointerEnd = (event) => {
      if (this._drawningStroke) {
        event.preventDefault();
        this._drawningStroke = false;
        this._strokeEnd(event);
      }
    };
    this.velocityFilterWeight = options.velocityFilterWeight || 0.7;
    this.minWidth = options.minWidth || 0.5;
    this.maxWidth = options.maxWidth || 2.5;
    this.throttle = ('throttle' in options ? options.throttle : 16);
    this.minDistance = ('minDistance' in options ? options.minDistance : 5);
    this.dotSize = options.dotSize || 0;
    this.penColor = options.penColor || 'black';
    this.backgroundColor = options.backgroundColor || 'rgba(0,0,0,0)';
    this._strokeMoveUpdate = this.throttle
      ? throttle(SignaturePad.prototype._strokeUpdate, this.throttle)
      : SignaturePad.prototype._strokeUpdate;
    this._ctx = canvas.getContext('2d');
    this.clear();
    this.on();
  }
  clear() {
    const { _ctx: ctx, canvas } = this;
    ctx.fillStyle = this.backgroundColor;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this._data = [];
    this._reset();
    this._isEmpty = true;
  }
  fromDataURL(dataUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const ratio = options.ratio || window.devicePixelRatio || 1;
      const width = options.width || this.canvas.width / ratio;
      const height = options.height || this.canvas.height / ratio;
      const xOffset = options.xOffset || 0;
      const yOffset = options.yOffset || 0;
      this._reset();
      image.onload = () => {
        this._ctx.drawImage(image, xOffset, yOffset, width, height);
        resolve();
      };
      image.onerror = (error) => {
        reject(error);
      };
      image.crossOrigin = 'anonymous';
      image.src = dataUrl;
      this._isEmpty = false;
    });
  }
  toDataURL(type = 'image/png', encoderOptions) {
    switch (type) {
      case 'image/svg+xml':
        return this._toSVG();
      default:
        return this.canvas.toDataURL(type, encoderOptions);
    }
  }
  on() {
    this.canvas.style.touchAction = 'none';
    this.canvas.style.msTouchAction = 'none';
    this.canvas.style.userSelect = 'none';
    const isIOS = /Macintosh/.test(navigator.userAgent) && 'ontouchstart' in document;
    if (window.PointerEvent && !isIOS) {
      this._handlePointerEvents();
    }
    else {
      this._handleMouseEvents();
      if ('ontouchstart' in window) {
        this._handleTouchEvents();
      }
    }
  }
  off() {
    this.canvas.style.touchAction = 'auto';
    this.canvas.style.msTouchAction = 'auto';
    this.canvas.style.userSelect = 'auto';
    this.canvas.removeEventListener('pointerdown', this._handlePointerStart);
    this.canvas.removeEventListener('pointermove', this._handlePointerMove);
    document.removeEventListener('pointerup', this._handlePointerEnd);
    this.canvas.removeEventListener('mousedown', this._handleMouseDown);
    this.canvas.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);
    this.canvas.removeEventListener('touchstart', this._handleTouchStart);
    this.canvas.removeEventListener('touchmove', this._handleTouchMove);
    this.canvas.removeEventListener('touchend', this._handleTouchEnd);
  }
  isEmpty() {
    return this._isEmpty;
  }
  fromData(pointGroups, { clear = true } = {}) {
    if (clear) {
      this.clear();
    }
    this._fromData(pointGroups, this._drawCurve.bind(this), this._drawDot.bind(this));
    this._data = this._data.concat(pointGroups);
  }
  toData() {
    return this._data;
  }
  _strokeBegin(event) {
    this.dispatchEvent(new CustomEvent('beginStroke', { detail: event }));
    const newPointGroup = {
      dotSize: this.dotSize,
      minWidth: this.minWidth,
      maxWidth: this.maxWidth,
      penColor: this.penColor,
      points: [],
    };
    this._data.push(newPointGroup);
    this._reset();
    this._strokeUpdate(event);
  }
  _strokeUpdate(event) {
    if (this._data.length === 0) {
      this._strokeBegin(event);
      return;
    }
    this.dispatchEvent(new CustomEvent('beforeUpdateStroke', { detail: event }));
    const x = event.clientX;
    const y = event.clientY;
    const pressure = event.pressure !== undefined
      ? event.pressure
      : event.force !== undefined
        ? event.force
        : 0;
    const point = this._createPoint(x, y, pressure);
    const lastPointGroup = this._data[this._data.length - 1];
    const lastPoints = lastPointGroup.points;
    const lastPoint = lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
    const isLastPointTooClose = lastPoint
      ? point.distanceTo(lastPoint) <= this.minDistance
      : false;
    const { penColor, dotSize, minWidth, maxWidth } = lastPointGroup;
    if (!lastPoint || !(lastPoint && isLastPointTooClose)) {
      const curve = this._addPoint(point);
      if (!lastPoint) {
        this._drawDot(point, {
          penColor,
          dotSize,
          minWidth,
          maxWidth,
        });
      }
      else if (curve) {
        this._drawCurve(curve, {
          penColor,
          dotSize,
          minWidth,
          maxWidth,
        });
      }
      lastPoints.push({
        time: point.time,
        x: point.x,
        y: point.y,
        pressure: point.pressure,
      });
    }
    this.dispatchEvent(new CustomEvent('afterUpdateStroke', { detail: event }));
  }
  _strokeEnd(event) {
    this._strokeUpdate(event);
    this.dispatchEvent(new CustomEvent('endStroke', { detail: event }));
  }
  _handlePointerEvents() {
    this._drawningStroke = false;
    this.canvas.addEventListener('pointerdown', this._handlePointerStart);
    this.canvas.addEventListener('pointermove', this._handlePointerMove);
    document.addEventListener('pointerup', this._handlePointerEnd);
  }
  _handleMouseEvents() {
    this._drawningStroke = false;
    this.canvas.addEventListener('mousedown', this._handleMouseDown);
    this.canvas.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }
  _handleTouchEvents() {
    this.canvas.addEventListener('touchstart', this._handleTouchStart);
    this.canvas.addEventListener('touchmove', this._handleTouchMove);
    this.canvas.addEventListener('touchend', this._handleTouchEnd);
  }
  _reset() {
    this._lastPoints = [];
    this._lastVelocity = 0;
    this._lastWidth = (this.minWidth + this.maxWidth) / 2;
    this._ctx.fillStyle = this.penColor;
  }
  _createPoint(x, y, pressure) {
    const rect = this.canvas.getBoundingClientRect();
    return new Point(x - rect.left, y - rect.top, pressure, new Date().getTime());
  }
  _addPoint(point) {
    const { _lastPoints } = this;
    _lastPoints.push(point);
    if (_lastPoints.length > 2) {
      if (_lastPoints.length === 3) {
        _lastPoints.unshift(_lastPoints[0]);
      }
      const widths = this._calculateCurveWidths(_lastPoints[1], _lastPoints[2]);
      const curve = Bezier.fromPoints(_lastPoints, widths);
      _lastPoints.shift();
      return curve;
    }
    return null;
  }
  _calculateCurveWidths(startPoint, endPoint) {
    const velocity = this.velocityFilterWeight * endPoint.velocityFrom(startPoint) +
      (1 - this.velocityFilterWeight) * this._lastVelocity;
    const newWidth = this._strokeWidth(velocity);
    const widths = {
      end: newWidth,
      start: this._lastWidth,
    };
    this._lastVelocity = velocity;
    this._lastWidth = newWidth;
    return widths;
  }
  _strokeWidth(velocity) {
    return Math.max(this.maxWidth / (velocity + 1), this.minWidth);
  }
  _drawCurveSegment(x, y, width) {
    const ctx = this._ctx;
    ctx.moveTo(x, y);
    ctx.arc(x, y, width, 0, 2 * Math.PI, false);
    this._isEmpty = false;
  }
  _drawCurve(curve, options) {
    const ctx = this._ctx;
    const widthDelta = curve.endWidth - curve.startWidth;
    const drawSteps = Math.ceil(curve.length()) * 2;
    ctx.beginPath();
    ctx.fillStyle = options.penColor;
    for (let i = 0; i < drawSteps; i += 1) {
      const t = i / drawSteps;
      const tt = t * t;
      const ttt = tt * t;
      const u = 1 - t;
      const uu = u * u;
      const uuu = uu * u;
      let x = uuu * curve.startPoint.x;
      x += 3 * uu * t * curve.control1.x;
      x += 3 * u * tt * curve.control2.x;
      x += ttt * curve.endPoint.x;
      let y = uuu * curve.startPoint.y;
      y += 3 * uu * t * curve.control1.y;
      y += 3 * u * tt * curve.control2.y;
      y += ttt * curve.endPoint.y;
      const width = Math.min(curve.startWidth + ttt * widthDelta, options.maxWidth);
      this._drawCurveSegment(x, y, width);
    }
    ctx.closePath();
    ctx.fill();
  }
  _drawDot(point, options) {
    const ctx = this._ctx;
    const width = options.dotSize > 0
      ? options.dotSize
      : (options.minWidth + options.maxWidth) / 2;
    ctx.beginPath();
    this._drawCurveSegment(point.x, point.y, width);
    ctx.closePath();
    ctx.fillStyle = options.penColor;
    ctx.fill();
  }
  _fromData(pointGroups, drawCurve, drawDot) {
    for (const group of pointGroups) {
      const { penColor, dotSize, minWidth, maxWidth, points } = group;
      if (points.length > 1) {
        for (let j = 0; j < points.length; j += 1) {
          const basicPoint = points[j];
          const point = new Point(basicPoint.x, basicPoint.y, basicPoint.pressure, basicPoint.time);
          this.penColor = penColor;
          if (j === 0) {
            this._reset();
          }
          const curve = this._addPoint(point);
          if (curve) {
            drawCurve(curve, {
              penColor,
              dotSize,
              minWidth,
              maxWidth,
            });
          }
        }
      }
      else {
        this._reset();
        drawDot(points[0], {
          penColor,
          dotSize,
          minWidth,
          maxWidth,
        });
      }
    }
  }
  _toSVG() {
    const pointGroups = this._data;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const minX = 0;
    const minY = 0;
    const maxX = this.canvas.width / ratio;
    const maxY = this.canvas.height / ratio;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', this.canvas.width.toString());
    svg.setAttribute('height', this.canvas.height.toString());
    this._fromData(pointGroups, (curve, { penColor }) => {
      const path = document.createElement('path');
      if (!isNaN(curve.control1.x) &&
        !isNaN(curve.control1.y) &&
        !isNaN(curve.control2.x) &&
        !isNaN(curve.control2.y)) {
        const attr = `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(3)} ` +
          `C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ` +
          `${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ` +
          `${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;
        path.setAttribute('d', attr);
        path.setAttribute('stroke-width', (curve.endWidth * 2.25).toFixed(3));
        path.setAttribute('stroke', penColor);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      }
    }, (point, { penColor, dotSize, minWidth, maxWidth }) => {
      const circle = document.createElement('circle');
      const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;
      circle.setAttribute('r', size.toString());
      circle.setAttribute('cx', point.x.toString());
      circle.setAttribute('cy', point.y.toString());
      circle.setAttribute('fill', penColor);
      svg.appendChild(circle);
    });
    const prefix = 'data:image/svg+xml;base64,';
    const header = '<svg' +
      ' xmlns="http://www.w3.org/2000/svg"' +
      ' xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ` viewBox="${minX} ${minY} ${this.canvas.width} ${this.canvas.height}"` +
      ` width="${maxX}"` +
      ` height="${maxY}"` +
      '>';
    let body = svg.innerHTML;
    if (body === undefined) {
      const dummy = document.createElement('dummy');
      const nodes = svg.childNodes;
      dummy.innerHTML = '';
      for (let i = 0; i < nodes.length; i += 1) {
        dummy.appendChild(nodes[i].cloneNode(true));
      }
      body = dummy.innerHTML;
    }
    const footer = '</svg>';
    const data = header + body + footer;
    return prefix + btoa(data);
  }
}

const _tmpl$$n = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$c = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$a = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$7 = /*#__PURE__*/template$1(`<button class="bg-white text-gray-500 p-2 rounded-full focus:outline-none h-10 w-10 hover:bg-teal-200 hover:text-teal-400 hover:border-teal-200 border-2 border-gray-300 "><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>`),
  _tmpl$5$5 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-teal-100 hover:text-teal-400 hover:border-teal-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></button>`),
  _tmpl$6$5 = /*#__PURE__*/template$1(`<button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                    text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button>`),
  _tmpl$7$5 = /*#__PURE__*/template$1(`<div><div class="grid grid-cols-12 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2 col-span-11"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 space-y-4 flex justify-end items-end -mt-2"><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-amber-100 hover:text-amber-400 hover:border-amber-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button></div><div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4 -mt-2"><div class="preview-class"><div class="container mx-auto space-y-3 "><canvas id="signature-pad" class="relative rounded-lg w-full bg-white border-b-8 border-gray-100  border"></canvas></div></div></div><div class="col-span-12"></div><div class="col-span-12 pb-4"></div></div></div>`),
  _tmpl$8$3 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$3 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$3 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const SignatureInput = props => {
  const [fileSource, setFileSource] = createSignal('');
  const [signatureData, setSignatureData] = createSignal([]);
  const [signaturePng, setSignaturePng] = createSignal('');
  const [saveBtn, setSaveBtn] = createSignal(true);
  const config = props.config;
  createSignal(config.formMode > 1 ? true : props.component.disableInput);

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  createEffect(() => {
    const canvas = document.querySelector("canvas");
    const signaturePad = new SignaturePad(canvas);
    signaturePad.clear();
    setSignatureData(signaturePad.toData());
    setSignaturePng(signaturePad.toDataURL('image/png'));

    if (props.value[0]) {
      setSaveBtn(false);
      props.value[0].value;
      let signatureSrc = props.value[0].signature;
      const signaturePad = new SignaturePad(canvas);
      signaturePad.clear();
      signaturePad.fromData(signatureSrc); // signaturePad.fromDataURL(imgSrc);
      // setFileSource(imgSrc)
    }
  });

  const resizeCanvas = () => {
    createEffect(() => {
      const canvas = document.querySelector("canvas");
      let ratio = Math.max(window.devicePixelRatio || 1, 1);

      if (canvas) {
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.width * (window.innerWidth < 720 ? 0.28 : 0.18);
        canvas.getContext("2d").scale(ratio, ratio);

        if (props.value[0]) {
          setSaveBtn(false);
          let imgSrc = props.value[0].value;
          let signatureSrc = props.value[0].signature;
          const signaturePad = new SignaturePad(canvas);
          signaturePad.clear();
          signaturePad.fromData(signatureSrc); // signaturePad.fromDataURL(imgSrc);

          setFileSource(imgSrc);
        }
      }
    });
  };

  window.onresize = resizeCanvas;
  resizeCanvas();

  const clearPad = event => {
    const canvas = document.querySelector("canvas");
    const signaturePad = new SignaturePad(canvas);
    signaturePad.clear();
    setSaveBtn(true);
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));
    updatedAnswer = [];
    props.onValueChange(updatedAnswer);
  };

  const saveSignature = event => {
    const canvas = document.querySelector('canvas');
    const dataURL = canvas.toDataURL();

    if (signatureData().length > 0) {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: dataURL,
        type: 'image/png',
        signature: signatureData()
      });
      props.onValueChange(updatedAnswer);
      toastInfo('Signature acquired!', '');
    } else {
      toastInfo('Please provide the appropriate signature!', 'bg-pink-600/70');
    }
  };

  const downloadSignature = e => {
    e.preventDefault(); // console.log(props)

    if (props.value[0]) {
      const a = document.createElement('a');
      a.download = props.component.dataKey + '.png';
      a.href = props.value[0].value;
      const clickEvt = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      a.dispatchEvent(clickEvt);
      a.remove();
    }
  };

  return (() => {
    const _el$ = _tmpl$7$5.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$5 = _el$4.firstChild,
      _el$8 = _el$4.nextSibling,
      _el$10 = _el$3.nextSibling,
      _el$13 = _el$10.firstChild,
      _el$17 = _el$10.nextSibling,
      _el$18 = _el$17.nextSibling,
      _el$19 = _el$18.nextSibling;

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$n.cloneNode(true);
      }

    }), null);

    insert(_el$4, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$7 = _tmpl$2$c.cloneNode(true);

        _el$7.$$click = showInstruction;
        return _el$7;
      }

    }), null);

    insert(_el$8, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$9 = _tmpl$3$a.cloneNode(true);

        createRenderEffect(() => _el$9.innerHTML = props.component.hint);

        return _el$9;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.value[0];
      },

      get children() {
        const _el$11 = _tmpl$4$7.cloneNode(true);

        _el$11.$$click = e => downloadSignature(e);

        return _el$11;
      }

    }), _el$13);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return saveBtn();
      },

      get children() {
        const _el$12 = _tmpl$5$5.cloneNode(true);

        _el$12.$$click = e => saveSignature();

        return _el$12;
      }

    }), _el$13);

    _el$13.$$click = e => clearPad();

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$14 = _tmpl$6$5.cloneNode(true),
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$ = disableClickRemark(),
            _v$2 = props.comments === 0;

          _v$ !== _p$._v$ && (_el$14.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && _el$16.classList.toggle("hidden", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$14;
      }

    }), null);

    insert(_el$19, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$20 = _tmpl$10$3.cloneNode(true),
              _el$21 = _el$20.firstChild,
              _el$24 = _el$21.firstChild;

            insert(_el$21, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$3.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$3.cloneNode(true);
                  }

                })];
              }

            }), _el$24);

            _el$24.innerHTML = item;

            createRenderEffect(_$p => classList(_el$21, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$20;
          })()
        });
      }

    }));

    createRenderEffect(_p$ => {
      const _v$3 = props.component.label,
        _v$4 = {
          ' border-b border-orange-500 pb-3 ': props.classValidation === 1,
          ' border-b border-pink-600 pb-3 ': props.classValidation === 2
        };
      _v$3 !== _p$._v$3 && (_el$5.innerHTML = _p$._v$3 = _v$3);
      _p$._v$4 = classList(_el$18, _v$4, _p$._v$4);
      return _p$;
    }, {
      _v$3: undefined,
      _v$4: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$m = /*#__PURE__*/template$1(`<svg fill="currentColor" stroke-width="0" xmlns="http://www.w3.org/2000/svg"></svg>`),
  _tmpl$2$b = /*#__PURE__*/template$1(`<title></title>`);

function IconTemplate(iconSrc, props) {
  return (() => {
    const _el$ = _tmpl$$m.cloneNode(true);

    spread(_el$, () => iconSrc.a, true, true);

    spread(_el$, props, true, true);

    insert(_el$, (() => {
      const _c$ = memo(() => !!props.title, true);

      return () => _c$() && (() => {
        const _el$2 = _tmpl$2$b.cloneNode(true);

        insert(_el$2, () => props.title);

        return _el$2;
      })();
    })());

    createRenderEffect(_p$ => {
      const _v$ = iconSrc.a.stroke,
        _v$2 = {
          ...props.style,
          overflow: "visible",
          color: props.color
        },
        _v$3 = props.size || "1em",
        _v$4 = props.size || "1em",
        _v$5 = iconSrc.c;

      _v$ !== _p$._v$ && setAttribute(_el$, "stroke", _p$._v$ = _v$);
      _p$._v$2 = style$1(_el$, _v$2, _p$._v$2);
      _v$3 !== _p$._v$3 && setAttribute(_el$, "height", _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && setAttribute(_el$, "width", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && (_el$.innerHTML = _p$._v$5 = _v$5);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
}

function FiChevronDown(props) {
  return IconTemplate({
    a: { "fill": "none", "stroke": "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-width": "2", "viewBox": "0 0 24 24" },
    c: '<path d="M6 9l6 6 6-6"/>'
  }, props)
}

const _tmpl$$l = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$a = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$9 = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$6 = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400block pr-20" placeholder="">`),
  _tmpl$5$4 = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400block pr-20" placeholder="" oninput="javascript: if (this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);">`),
  _tmpl$6$4 = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$7$4 = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3  p-2 border-b border-gray-300/[.40] dark:border-gray-200/[.10]"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class="relative"><div class="absolute inset-y-0 right-0 flex items-center"></div></div></div></div>`),
  _tmpl$8$2 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$2 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$2 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const UnitInput$1 = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [label, setLabel] = createSignal('');
  const [isLoading, setLoading] = createSignal(false);
  const [options, setOptions] = createSignal([]);
  const [selectedOption, setSelectedOption] = createSignal('');
  const isPublic = false;
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);

  const toastInfo = text => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: "bg-pink-700/80",
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  let handleOnChange = (value, unit, isChange) => {
    if (isChange == 2 && unit.value != '' && unit.value != undefined) {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        unit: unit
      });
      props.onValueChange(updatedAnswer);
    } else {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        unit: unit
      });
      props.onValueChange(updatedAnswer);
    }
  };

  switch (props.component.typeOption) {
    case 1:
      {
        try {
          let options = props.component.options.map((item, value) => {
            return {
              value: item.value,
              label: item.label
            };
          });
          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : 'Select Unit';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 2:
      {
        try {
          if (config.lookupMode === 1) {
            let url;
            let params;
            let urlHead;
            let urlParams;

            if (!isPublic) {
              params = props.component.sourceSelect; // url = `${config.baseUrl}/${params[0].id}`

              url = `${config.baseUrl}/${params[0].id}/filter?version=${params[0].version}`;

              if (params[0].parentCondition.length > 0) {
                urlHead = url;
                urlParams = params[0].parentCondition.map((item, index) => {
                  let newParams = item.value.split('@');
                  let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                  if (tobeLookup.answer) {
                    if (tobeLookup.answer.length > 0) {
                      let parentValue = encodeURI(tobeLookup.answer[tobeLookup.answer.length - 1].value);
                      url = `${config.lookupKey}=${item.key}&${config.lookupValue}=${parentValue}`;
                    }
                  } else {
                    url = `${config.lookupKey}=${item.key}&${config.lookupValue}=''`;
                  }

                  return url;
                }).join('&'); // url = `${urlHead}?${urlParams}`

                url = `${urlHead}&${urlParams}`;
              }
            } // console.log('Lookup URL ', url)


            const [fetched] = createResource(url, props.MobileOnlineSearch);
            let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
            createEffect(() => {
              setLabel(props.component.label);

              if (fetched()) {
                if (!fetched().success) {
                  toastInfo(locale.details.language[0].fetchFailed);
                } else {
                  let arr;

                  if (!isPublic) {
                    arr = []; // let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
                    // let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)

                    let cekValue = params[0].value;
                    let cekLabel = params[0].desc; // fetched().data.data.map((item, value) => {
                    //     arr.push(
                    //         {
                    //             value: item[cekValue],
                    //             label: item[cekLabel],
                    //         }
                    //     )
                    // })

                    fetched().data.map((item, value) => {
                      arr.push({
                        value: item[cekValue],
                        label: item[cekLabel]
                      });
                    });
                  }

                  let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : 'Select Unit';
                  setOptions(arr);
                  setSelectedOption(ans);
                  setLoading(true);
                }
              }
            });
          } else if (config.lookupMode === 2) {
            let params;
            let tempArr = [];
            params = props.component.sourceSelect;
            let id = params[0].id;
            let version = params[0].version;

            if (params[0].parentCondition.length > 0) {
              params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = tobeLookup.answer[tobeLookup.answer.length - 1].value.toString();
                    tempArr.push({
                      "key": item.key,
                      "value": parentValue
                    });
                  }
                }
              });
            } // console.log('id : ', id)
            // console.log('version : ', version)
            // console.log('kondisi : ', tempArr)


            let getResult = result => {
              let arr = [];

              if (result.data.length > 0) {
                let cekValue = params[0].value;
                let cekLabel = params[0].desc;
                let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
                result.data.map((item, value) => {
                  arr.push({
                    value: item[cekValue],
                    label: item[cekLabel]
                  });
                });
                let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : 'Select Unit';
                setLabel(props.component.label);
                setOptions(arr);
                setSelectedOption(ans);
                setLoading(true);
              }
            };

            const fetched = props.MobileOfflineSearch(id, version, tempArr, getResult);
          }
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 3:
      {
        try {
          let optionsSource;
          let finalOptions;
          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';

          if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
            const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === props.component.sourceOption);

            if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
              optionsSource = reference.details[componentAnswerIndex].answer;

              if (optionsSource != undefined) {
                finalOptions = optionsSource.filter((item, value) => item.value != 0).map((item, value) => {
                  return {
                    value: item.value,
                    label: item.label
                  };
                });
              } else {
                finalOptions = [];
              }
            }
          }

          let ans = finalOptions.find(obj => obj.value == checker) && checker != '' ? finalOptions.find(obj => obj.value == checker).label : 'Select Unit';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(finalOptions);
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    default:
      {
        try {
          let options;

          if (props.component.options) {
            options = props.component.options.map((item, value) => {
              return {
                value: item.value,
                label: item.label
              };
            });
          } else {
            options = [];
          }

          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : 'Select Unit';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }
  }

  return (() => {
    const _el$ = _tmpl$7$4.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild,
      _el$13 = _el$10.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$l.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$a.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$9.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput === undefined;
      },

      get children() {
        const _el$11 = _tmpl$4$6.cloneNode(true);

        _el$11.addEventListener("change", e => {
          handleOnChange(e ? e.currentTarget.value : '', props.value != undefined && props.value != '' ? props.value[0].unit ? props.value[0].unit : {
            value: '',
            label: ''
          } : {
            value: '',
            label: ''
          }, 1);
        });

        createRenderEffect(_p$ => {
          const _v$ = props.value != undefined ? props.value != '' ? props.value[0].value : '' : '',
            _v$2 = props.component.dataKey,
            _v$3 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$4 = disableInput();

          _v$ !== _p$._v$ && (_el$11.value = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$11, "name", _p$._v$2 = _v$2);
          _p$._v$3 = classList(_el$11, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$11.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$11;
      }

    }), _el$13);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
      },

      get children() {
        const _el$12 = _tmpl$5$4.cloneNode(true);

        _el$12.addEventListener("change", e => {
          handleOnChange(e ? e.currentTarget.value : '', props.value != undefined && props.value != '' ? props.value[0].unit ? props.value[0].unit : {
            value: '',
            label: ''
          } : {
            value: '',
            label: ''
          }, 1);
        });

        createRenderEffect(_p$ => {
          const _v$5 = props.value != undefined ? props.value != '' ? props.value[0].value : '' : '',
            _v$6 = props.component.dataKey,
            _v$7 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$8 = disableInput(),
            _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
            _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '',
            _v$11 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
            _v$12 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

          _v$5 !== _p$._v$5 && (_el$12.value = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && setAttribute(_el$12, "name", _p$._v$6 = _v$6);
          _p$._v$7 = classList(_el$12, _v$7, _p$._v$7);
          _v$8 !== _p$._v$8 && (_el$12.disabled = _p$._v$8 = _v$8);
          _v$9 !== _p$._v$9 && setAttribute(_el$12, "maxlength", _p$._v$9 = _v$9);
          _v$10 !== _p$._v$10 && setAttribute(_el$12, "minlength", _p$._v$10 = _v$10);
          _v$11 !== _p$._v$11 && setAttribute(_el$12, "max", _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && setAttribute(_el$12, "min", _p$._v$12 = _v$12);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined,
          _v$7: undefined,
          _v$8: undefined,
          _v$9: undefined,
          _v$10: undefined,
          _v$11: undefined,
          _v$12: undefined
        });

        return _el$12;
      }

    }), _el$13);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$18 = _tmpl$10$2.cloneNode(true),
              _el$19 = _el$18.firstChild,
              _el$22 = _el$19.firstChild;

            insert(_el$19, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$2.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$2.cloneNode(true);
                  }

                })];
              }

            }), _el$22);

            _el$22.innerHTML = item;

            createRenderEffect(_$p => classList(_el$19, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$18;
          })()
        });
      }

    }), _el$13);

    insert(_el$13, createComponent$1(Select, mergeProps({
      "class": "formgear-select-unit  w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    }, () => createOptions(options() || [], {
      key: "label",
      filterable: true
    }), {
      get disabled() {
        return disableInput();
      },

      placeholder: "Unit",
      onChange: e => handleOnChange(props.value != undefined ? props.value != '' ? props.value[0].value : '' : '', {
        value: e ? e.value : '',
        label: e ? e.label : ''
      }, 2),

      get initialValue() {
        return {
          value: props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '',
          label: selectedOption
        };
      }

    })), null);

    insert(_el$13, createComponent$1(FiChevronDown, {
      size: 20,
      "class": "text-gray-400  mr-3"
    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$14 = _tmpl$6$4.cloneNode(true),
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.firstChild,
          _el$17 = _el$16.nextSibling;

        _el$15.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$17, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$13 = disableClickRemark(),
            _v$14 = props.comments === 0;

          _v$13 !== _p$._v$13 && (_el$15.disabled = _p$._v$13 = _v$13);
          _v$14 !== _p$._v$14 && _el$17.classList.toggle("hidden", _p$._v$14 = _v$14);
          return _p$;
        }, {
          _v$13: undefined,
          _v$14: undefined
        });

        return _el$14;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$15 = props.component.label,
        _v$16 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        };
      _v$15 !== _p$._v$15 && (_el$4.innerHTML = _p$._v$15 = _v$15);
      _p$._v$16 = classList(_el$10, _v$16, _p$._v$16);
      return _p$;
    }, {
      _v$15: undefined,
      _v$16: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$k = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$9 = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$8 = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$5 = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder="">`),
  _tmpl$5$3 = /*#__PURE__*/template$1(`<input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" placeholder="" oninput="javascript: if (this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);">`),
  _tmpl$6$3 = /*#__PURE__*/template$1(`<div class=" flex justify-end "><button class="relative inline-block bg-white p-2 h-10 w-10 text-gray-500 rounded-full  hover:bg-yellow-100 hover:text-yellow-400 hover:border-yellow-100 border-2 border-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg><span class="absolute top-0 right-0 inline-flex items-center justify-center h-6 w-6
                            text-xs font-semibold text-white transform translate-x-1/2 -translate-y-1/4 bg-pink-600/80 rounded-full"></span></button></div>`),
  _tmpl$7$3 = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-3  p-2 border-b border-gray-300/[.40] dark:border-gray-200/[.10]"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-2 grid grid-cols-12"><div class=""></div></div></div>`),
  _tmpl$8$1 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$9$1 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$10$1 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const DecimalInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  let handleOnKeyup = src_default(value => {
    let decimalLength = props.component.decimalLength ? props.component.decimalLength : 2;
    props.onValueChange(parseFloat(value).toFixed(decimalLength));
  }, 1000);
  const [enableRemark] = createSignal(props.component.enableRemark !== undefined ? props.component.enableRemark : true);
  const [disableClickRemark] = createSignal(config.formMode > 2 && props.comments == 0 ? true : false);
  return (() => {
    const _el$ = _tmpl$7$3.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$k.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$9.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$8.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }));

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput === undefined;
      },

      get children() {
        const _el$11 = _tmpl$4$5.cloneNode(true);

        _el$11.$$keyup = e => handleOnKeyup(e.currentTarget.value);

        createRenderEffect(_p$ => {
          const _v$ = props.value,
            _v$2 = props.component.dataKey,
            _v$3 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$4 = disableInput();

          _v$ !== _p$._v$ && (_el$11.value = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$11, "name", _p$._v$2 = _v$2);
          _p$._v$3 = classList(_el$11, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$11.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined,
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$11;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
      },

      get children() {
        const _el$12 = _tmpl$5$3.cloneNode(true);

        _el$12.$$keyup = e => handleOnKeyup(e.currentTarget.value);

        createRenderEffect(_p$ => {
          const _v$5 = props.value,
            _v$6 = props.component.dataKey,
            _v$7 = {
              ' border border-solid border-gray-300 ': props.classValidation === 0,
              ' border-orange-500 dark:bg-orange-100 ': props.classValidation === 1,
              ' border-pink-600 dark:bg-pink-100 ': props.classValidation === 2
            },
            _v$8 = disableInput(),
            _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
            _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '',
            _v$11 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
            _v$12 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

          _v$5 !== _p$._v$5 && (_el$12.value = _p$._v$5 = _v$5);
          _v$6 !== _p$._v$6 && setAttribute(_el$12, "name", _p$._v$6 = _v$6);
          _p$._v$7 = classList(_el$12, _v$7, _p$._v$7);
          _v$8 !== _p$._v$8 && (_el$12.disabled = _p$._v$8 = _v$8);
          _v$9 !== _p$._v$9 && setAttribute(_el$12, "maxlength", _p$._v$9 = _v$9);
          _v$10 !== _p$._v$10 && setAttribute(_el$12, "minlength", _p$._v$10 = _v$10);
          _v$11 !== _p$._v$11 && setAttribute(_el$12, "max", _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && setAttribute(_el$12, "min", _p$._v$12 = _v$12);
          return _p$;
        }, {
          _v$5: undefined,
          _v$6: undefined,
          _v$7: undefined,
          _v$8: undefined,
          _v$9: undefined,
          _v$10: undefined,
          _v$11: undefined,
          _v$12: undefined
        });

        return _el$12;
      }

    }), null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$17 = _tmpl$10$1.cloneNode(true),
              _el$18 = _el$17.firstChild,
              _el$21 = _el$18.firstChild;

            insert(_el$18, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$8$1.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$9$1.cloneNode(true);
                  }

                })];
              }

            }), _el$21);

            _el$21.innerHTML = item;

            createRenderEffect(_$p => classList(_el$18, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$17;
          })()
        });
      }

    }), null);

    insert(_el$9, createComponent$1(Show, {
      get when() {
        return enableRemark();
      },

      get children() {
        const _el$13 = _tmpl$6$3.cloneNode(true),
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.firstChild,
          _el$16 = _el$15.nextSibling;

        _el$14.$$click = e => props.openRemark(props.component.dataKey);

        insert(_el$16, () => props.comments);

        createRenderEffect(_p$ => {
          const _v$13 = disableClickRemark(),
            _v$14 = props.comments === 0;

          _v$13 !== _p$._v$13 && (_el$14.disabled = _p$._v$13 = _v$13);
          _v$14 !== _p$._v$14 && _el$16.classList.toggle("hidden", _p$._v$14 = _v$14);
          return _p$;
        }, {
          _v$13: undefined,
          _v$14: undefined
        });

        return _el$13;
      }

    }), null);

    createRenderEffect(_p$ => {
      const _v$15 = props.component.label,
        _v$16 = {
          'col-span-11 lg:-mr-4': enableRemark(),
          'col-span-12': !enableRemark()
        };
      _v$15 !== _p$._v$15 && (_el$4.innerHTML = _p$._v$15 = _v$15);
      _p$._v$16 = classList(_el$10, _v$16, _p$._v$16);
      return _p$;
    }, {
      _v$15: undefined,
      _v$16: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click", "keyup"]);

const _tmpl$$j = /*#__PURE__*/template$1(`<span class="text-pink-600">*</span>`),
  _tmpl$2$8 = /*#__PURE__*/template$1(`<button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-4 w-4 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$3$7 = /*#__PURE__*/template$1(`<div class="italic text-xs font-extralight text-zinc-400 "></div>`),
  _tmpl$4$4 = /*#__PURE__*/template$1(`<div class="grid md:grid-cols-2 border-b border-gray-300/[.40] dark:border-gray-200/[.10] p-2"><div class="font-light text-sm space-y-2 py-2.5 px-2"><div class="inline-flex space-x-2"><div></div></div><div class="flex mt-2"></div></div><div class="font-light text-sm space-x-2 py-2.5 px-2 md:col-span-1 grid grid-cols-12"><div class="col-span-12"></div></div></div>`),
  _tmpl$5$2 = /*#__PURE__*/template$1(`<div class="mr-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$6$2 = /*#__PURE__*/template$1(`<div class="mr-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$7$2 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="flex"><div></div></div></div>`);

const InputContainer = props => {
  const [instruction, setInstruction] = createSignal(false);

  const showInstruction = () => {
    instruction() ? setInstruction(false) : setInstruction(true);
  };

  return (() => {
    const _el$ = _tmpl$4$4.cloneNode(true),
      _el$2 = _el$.firstChild,
      _el$3 = _el$2.firstChild,
      _el$4 = _el$3.firstChild,
      _el$7 = _el$3.nextSibling,
      _el$9 = _el$2.nextSibling,
      _el$10 = _el$9.firstChild;

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.required;
      },

      get children() {
        return _tmpl$$j.cloneNode(true);
      }

    }), null);

    insert(_el$3, createComponent$1(Show, {
      get when() {
        return props.component.hint;
      },

      get children() {
        const _el$6 = _tmpl$2$8.cloneNode(true);

        _el$6.$$click = showInstruction;
        return _el$6;
      }

    }), null);

    insert(_el$7, createComponent$1(Show, {
      get when() {
        return instruction();
      },

      get children() {
        const _el$8 = _tmpl$3$7.cloneNode(true);

        createRenderEffect(() => _el$8.innerHTML = props.component.hint);

        return _el$8;
      }

    }), null);

    insert(_el$7, () => props.optionSection, null);

    insert(_el$10, () => props.children, null);

    insert(_el$10, createComponent$1(Show, {
      get when() {
        return props.validationMessage?.length > 0;
      },

      get children() {
        return createComponent$1(For, {
          get each() {
            return props.validationMessage;
          },

          children: item => (() => {
            const _el$11 = _tmpl$7$2.cloneNode(true),
              _el$12 = _el$11.firstChild,
              _el$15 = _el$12.firstChild;

            insert(_el$12, createComponent$1(Switch, {
              get children() {
                return [createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 1;
                  },

                  get children() {
                    return _tmpl$5$2.cloneNode(true);
                  }

                }), createComponent$1(Match, {
                  get when() {
                    return props.classValidation === 2;
                  },

                  get children() {
                    return _tmpl$6$2.cloneNode(true);
                  }

                })];
              }

            }), _el$15);

            _el$15.innerHTML = item;

            createRenderEffect(_$p => classList(_el$12, {
              ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
              ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
            }, _$p));

            return _el$11;
          })()
        });
      }

    }), null);

    createRenderEffect(() => _el$4.innerHTML = props.component.label);

    return _el$;
  })();
};

delegateEvents(["click"]);

const handleInputFocus$1 = (e, props) => {
  if (props.config.clientMode == ClientMode.PAPI) {
    const elem = props.isNestedInput ? e.target.offsetParent : e.target;
    const scrollContainer = props.isNestedInput ? document.querySelector(".nested-container") : null;
    setInput("currentDataKey", props.component.dataKey);
    scrollCenterInput(elem, scrollContainer);
  }
};

const handleInputKeyDown$1 = (e, props) => {
  handleEnterPress(e);
};
const handleEnterPress = (e, props) => {
  if (e.keyCode == 13) {
    if (e.shiftKey) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    const inputs = Array.prototype.slice.call(document.querySelectorAll("input:not(:disabled),textarea:not(.hidden-input):not(:disabled)"));
    const index = (inputs.indexOf(document.activeElement) + 1) % inputs.length;
    const input = inputs[index];
    input.focus();
    input.select();
  }
};

const _tmpl$$i = /*#__PURE__*/template$1(`<div class="grid font-light text-sm content-start"></div>`),
  _tmpl$2$7 = /*#__PURE__*/template$1(`<div class="col-span-11"><input type="text" class="w-full font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding
                                    border border-solid border-gray-300 rounded transition ease-in-out m-0
                                    focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
                                    disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"></div>`),
  _tmpl$3$6 = /*#__PURE__*/template$1(`<div class="col-span-11"></div>`),
  _tmpl$4$3 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1 text-center"><label class="cursor-pointer text-sm"><input type="radio" class="checked:disabled:bg-gray-500 checked:dark:disabled:bg-gray-300 disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" disabled></label></div></div>`);

const OptionSection = props => {
  return (() => {
    const _el$ = _tmpl$$i.cloneNode(true);

    insert(_el$, createComponent$1(For, {
      get each() {
        return props.options;
      },

      children: (item, index) => (() => {
        const _el$2 = _tmpl$4$3.cloneNode(true),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.firstChild;

        insert(_el$2, createComponent$1(Switch, {
          get children() {
            return [createComponent$1(Match, {
              get when() {
                return item.open && props.settedValue === item.value;
              },

              get children() {
                const _el$6 = _tmpl$2$7.cloneNode(true),
                  _el$7 = _el$6.firstChild;

                _el$7.addEventListener("change", e => props.onValueChange(item.value, e.currentTarget.value, item.open));

                _el$7.addEventListener("focus", e => handleInputFocus$1(e, props));

                _el$7.$$keydown = e => handleInputKeyDown$1(e);

                createRenderEffect(_p$ => {
                  const _v$6 = props.value ? props.value.length > 0 ? props.value[0].label : item.label : item.label,
                    _v$7 = props.component.dataKey,
                    _v$8 = props.component.dataKey,
                    _v$9 = props.disableInput;

                  _v$6 !== _p$._v$6 && (_el$7.value = _p$._v$6 = _v$6);
                  _v$7 !== _p$._v$7 && setAttribute(_el$7, "name", _p$._v$7 = _v$7);
                  _v$8 !== _p$._v$8 && setAttribute(_el$7, "id", _p$._v$8 = _v$8);
                  _v$9 !== _p$._v$9 && (_el$7.disabled = _p$._v$9 = _v$9);
                  return _p$;
                }, {
                  _v$6: undefined,
                  _v$7: undefined,
                  _v$8: undefined,
                  _v$9: undefined
                });

                return _el$6;
              }

            }), createComponent$1(Match, {
              get when() {
                return !item.open || props.settedValue !== item.value;
              },

              get children() {
                const _el$8 = _tmpl$3$6.cloneNode(true);

                createRenderEffect(() => _el$8.innerHTML = item.label);

                return _el$8;
              }

            })];
          }

        }), null);

        createRenderEffect(_p$ => {
          const _v$10 = props.component.dataKey + index(),
            _v$11 = props.settedValue === item.value,
            _v$12 = item.value,
            _v$13 = props.component.dataKey,
            _v$14 = "radio-" + props.component.dataKey + "-" + index();

          _v$10 !== _p$._v$10 && setAttribute(_el$4, "for", _p$._v$10 = _v$10);
          _v$11 !== _p$._v$11 && (_el$5.checked = _p$._v$11 = _v$11);
          _v$12 !== _p$._v$12 && (_el$5.value = _p$._v$12 = _v$12);
          _v$13 !== _p$._v$13 && setAttribute(_el$5, "name", _p$._v$13 = _v$13);
          _v$14 !== _p$._v$14 && setAttribute(_el$5, "id", _p$._v$14 = _v$14);
          return _p$;
        }, {
          _v$10: undefined,
          _v$11: undefined,
          _v$12: undefined,
          _v$13: undefined,
          _v$14: undefined
        });

        return _el$2;
      })()
    }));

    createRenderEffect(_p$ => {
      const _v$ = props.component.cols === 1 || props.component.cols === undefined,
        _v$2 = props.component.cols === 2,
        _v$3 = props.component.cols === 3,
        _v$4 = props.component.cols === 4,
        _v$5 = props.component.cols === 5;

      _v$ !== _p$._v$ && _el$.classList.toggle("grid-cols-1", _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && _el$.classList.toggle("grid-cols-2", _p$._v$2 = _v$2);
      _v$3 !== _p$._v$3 && _el$.classList.toggle("grid-cols-3", _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && _el$.classList.toggle("grid-cols-4", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && _el$.classList.toggle("grid-cols-5", _p$._v$5 = _v$5);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
};

delegateEvents(["keydown"]);

const _tmpl$$h = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi" placeholder="">`);

const CurrencyInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);

  let checkFormat = e => {
    let tobeChecked = String.fromCharCode(!e.charCode ? e.which : e.charCode);
    let templ = props.component.separatorFormat === 'id-ID' ? /^\d{1,99}(?:\,\d{0,10})?$/ : /^\d{1,99}(?:\.\d{0,10})?$/;
    let value = document.getElementById('currencyInput' + props.index).value;
    let currentVal = modifier(value);

    if (!templ.test(currentVal + tobeChecked)) {
      e.preventDefault ? e.preventDefault() : e.returnValue = false;
    }
  };

  let handleOnKeyup = src_default(value => {
    let modified = modifier(value);
    let result = props.component.separatorFormat === 'id-ID' ? modified.replace(',', '.') : modified;
    props.onValueChange(result);
  }, 1000);

  let modifier = value => {
    let firstRemoved;
    let allowedChars;

    if (props.component.separatorFormat === 'id-ID') {
      firstRemoved = props.component.isDecimal ? value.indexOf(',00') != -1 ? value.substring(0, value.indexOf(',00')) : value : value.indexOf(',') != -1 ? value.substring(0, value.indexOf(',')) : value;
      allowedChars = "0123456789,";
    } else if (props.component.separatorFormat === 'en-US') {
      firstRemoved = props.component.isDecimal ? value.indexOf('.00') != -1 ? value.substring(0, value.indexOf('.00')) : value : value.indexOf('.') != -1 ? value.substring(0, value.indexOf('.')) : value;
      allowedChars = "0123456789.";
    }

    return Array.from(firstRemoved).filter(f => allowedChars.includes(f)).join('');
  };

  let current = Number(props.value).toLocaleString(props.component.separatorFormat, {
    style: 'currency',
    currency: props.component.currency,
    minimumFractionDigits: 0
  });
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$$h.cloneNode(true);

      _el$.$$keyup = e => handleOnKeyup(e.currentTarget.value);

      _el$.addEventListener("keypress", e => checkFormat(e));

      createRenderEffect(_p$ => {
        const _v$ = props.component.separatorFormat === 'id-ID' ? current.replace(",00", "") : current.replace("IDR", "Rp"),
          _v$2 = props.component.dataKey,
          _v$3 = {
            ['formgear-input-papi-validation-' + props.classValidation]: true
          },
          _v$4 = disableInput(),
          _v$5 = "currencyInput" + props.index,
          _v$6 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
          _v$7 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

        _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
        _v$2 !== _p$._v$2 && setAttribute(_el$, "name", _p$._v$2 = _v$2);
        _p$._v$3 = classList(_el$, _v$3, _p$._v$3);
        _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
        _v$5 !== _p$._v$5 && setAttribute(_el$, "id", _p$._v$5 = _v$5);
        _v$6 !== _p$._v$6 && setAttribute(_el$, "max", _p$._v$6 = _v$6);
        _v$7 !== _p$._v$7 && setAttribute(_el$, "min", _p$._v$7 = _v$7);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined,
        _v$5: undefined,
        _v$6: undefined,
        _v$7: undefined
      });

      return _el$;
    }

  });
};

delegateEvents(["keyup"]);

var customParseFormat = { exports: {} };

(function (module, exports) {
  !function (e, t) { module.exports = t(); }(commonjsGlobal, (function () { var e = { LTS: "h:mm:ss A", LT: "h:mm A", L: "MM/DD/YYYY", LL: "MMMM D, YYYY", LLL: "MMMM D, YYYY h:mm A", LLLL: "dddd, MMMM D, YYYY h:mm A" }, t = /(\[[^[]*\])|([-:/.()\s]+)|(A|a|YYYY|YY?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g, n = /\d\d/, r = /\d\d?/, i = /\d*[^\s\d-_:/()]+/, o = {}, s = function (e) { return (e = +e) + (e > 68 ? 1900 : 2e3) }; var a = function (e) { return function (t) { this[e] = +t; } }, f = [/[+-]\d\d:?(\d\d)?|Z/, function (e) { (this.zone || (this.zone = {})).offset = function (e) { if (!e) return 0; if ("Z" === e) return 0; var t = e.match(/([+-]|\d\d)/g), n = 60 * t[1] + (+t[2] || 0); return 0 === n ? 0 : "+" === t[0] ? -n : n }(e); }], h = function (e) { var t = o[e]; return t && (t.indexOf ? t : t.s.concat(t.f)) }, u = function (e, t) { var n, r = o.meridiem; if (r) { for (var i = 1; i <= 24; i += 1)if (e.indexOf(r(i, 0, t)) > -1) { n = i > 12; break } } else n = e === (t ? "pm" : "PM"); return n }, d = { A: [i, function (e) { this.afternoon = u(e, !1); }], a: [i, function (e) { this.afternoon = u(e, !0); }], S: [/\d/, function (e) { this.milliseconds = 100 * +e; }], SS: [n, function (e) { this.milliseconds = 10 * +e; }], SSS: [/\d{3}/, function (e) { this.milliseconds = +e; }], s: [r, a("seconds")], ss: [r, a("seconds")], m: [r, a("minutes")], mm: [r, a("minutes")], H: [r, a("hours")], h: [r, a("hours")], HH: [r, a("hours")], hh: [r, a("hours")], D: [r, a("day")], DD: [n, a("day")], Do: [i, function (e) { var t = o.ordinal, n = e.match(/\d+/); if (this.day = n[0], t) for (var r = 1; r <= 31; r += 1)t(r).replace(/\[|\]/g, "") === e && (this.day = r); }], M: [r, a("month")], MM: [n, a("month")], MMM: [i, function (e) { var t = h("months"), n = (h("monthsShort") || t.map((function (e) { return e.slice(0, 3) }))).indexOf(e) + 1; if (n < 1) throw new Error; this.month = n % 12 || n; }], MMMM: [i, function (e) { var t = h("months").indexOf(e) + 1; if (t < 1) throw new Error; this.month = t % 12 || t; }], Y: [/[+-]?\d+/, a("year")], YY: [n, function (e) { this.year = s(e); }], YYYY: [/\d{4}/, a("year")], Z: f, ZZ: f }; function c(n) { var r, i; r = n, i = o && o.formats; for (var s = (n = r.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g, (function (t, n, r) { var o = r && r.toUpperCase(); return n || i[r] || e[r] || i[o].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g, (function (e, t, n) { return t || n.slice(1) })) }))).match(t), a = s.length, f = 0; f < a; f += 1) { var h = s[f], u = d[h], c = u && u[0], l = u && u[1]; s[f] = l ? { regex: c, parser: l } : h.replace(/^\[|\]$/g, ""); } return function (e) { for (var t = {}, n = 0, r = 0; n < a; n += 1) { var i = s[n]; if ("string" == typeof i) r += i.length; else { var o = i.regex, f = i.parser, h = e.slice(r), u = o.exec(h)[0]; f.call(t, u), e = e.replace(u, ""); } } return function (e) { var t = e.afternoon; if (void 0 !== t) { var n = e.hours; t ? n < 12 && (e.hours += 12) : 12 === n && (e.hours = 0), delete e.afternoon; } }(t), t } } return function (e, t, n) { n.p.customParseFormat = !0, e && e.parseTwoDigitYear && (s = e.parseTwoDigitYear); var r = t.prototype, i = r.parse; r.parse = function (e) { var t = e.date, r = e.utc, s = e.args; this.$u = r; var a = s[1]; if ("string" == typeof a) { var f = !0 === s[2], h = !0 === s[3], u = f || h, d = s[2]; h && (d = s[2]), o = this.$locale(), !f && d && (o = n.Ls[d]), this.$d = function (e, t, n) { try { if (["x", "X"].indexOf(t) > -1) return new Date(("X" === t ? 1e3 : 1) * e); var r = c(t)(e), i = r.year, o = r.month, s = r.day, a = r.hours, f = r.minutes, h = r.seconds, u = r.milliseconds, d = r.zone, l = new Date, m = s || (i || o ? 1 : l.getDate()), M = i || l.getFullYear(), Y = 0; i && !o || (Y = o > 0 ? o - 1 : l.getMonth()); var p = a || 0, v = f || 0, D = h || 0, g = u || 0; return d ? new Date(Date.UTC(M, Y, m, p, v, D, g + 60 * d.offset * 1e3)) : n ? new Date(Date.UTC(M, Y, m, p, v, D, g)) : new Date(M, Y, m, p, v, D, g) } catch (e) { return new Date("") } }(t, a, r), this.init(), d && !0 !== d && (this.$L = this.locale(d).$L), u && t != this.format(a) && (this.$d = new Date("")), o = {}; } else if (a instanceof Array) for (var l = a.length, m = 1; m <= l; m += 1) { s[1] = a[m - 1]; var M = n.apply(this, s); if (M.isValid()) { this.$d = M.$d, this.$L = M.$L, this.init(); break } m === l && (this.$d = new Date("")); } else i.call(this, e); }; } }));
}(customParseFormat));

var CustomParseFormat = customParseFormat.exports;

const _tmpl$$g = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi">`);
dayjs.extend(CustomParseFormat);

const DateInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const format = "DD/MM/YYYY";
  const maskingFormat = "99/99/9999";
  const formatMask = createInputMask(maskingFormat);
  let ref;
  const inputMask = {
    ref,

    get value() {
      return inputMask.ref?.value;
    }

  };

  let handleOnChange = value => {
    value = dayjs(value, format, true).format("YYYY-MM-DD");
    props.onValueChange(value);
  };

  let settedValue = props.value ? dayjs(props.value).format(format) : "";
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$$g.cloneNode(true);

      addEventListener(_el$, "paste", formatMask);

      addEventListener(_el$, "input", formatMask, true);

      addEventListener(_el$, "click", formatMask, true);

      _el$.addEventListener("change", e => handleOnChange(e.currentTarget.value));

      _el$.addEventListener("focus", e => handleInputFocus$1(e, props));

      _el$.$$keydown = e => handleInputKeyDown$1(e);

      const _ref$ = inputMask.ref;
      typeof _ref$ === "function" ? _ref$(_el$) : inputMask.ref = _el$;
      _el$.value = settedValue;

      createRenderEffect(_p$ => {
        const _v$ = "inputMask" + props.component.dataKey,
          _v$2 = {
            ['formgear-input-papi-validation-' + props.classValidation]: true
          },
          _v$3 = maskingFormat.replace(/[a]/g, '__').replace(/[9]/g, '#'),
          _v$4 = disableInput();

        _v$ !== _p$._v$ && setAttribute(_el$, "id", _p$._v$ = _v$);
        _p$._v$2 = classList(_el$, _v$2, _p$._v$2);
        _v$3 !== _p$._v$3 && setAttribute(_el$, "placeholder", _p$._v$3 = _v$3);
        _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined
      });

      return _el$;
    }

  });
};

delegateEvents(["keydown", "click", "input"]);

const _tmpl$$f = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi">`);
dayjs.extend(CustomParseFormat);

const DateTimeLocalInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const format = "DD/MM/YYYY HH:mm:ss";
  const maskingFormat = "99/99/9999 99:99:99";
  const formatMask = createInputMask(maskingFormat);
  let ref;
  const inputMask = {
    ref,

    get value() {
      return inputMask.ref?.value;
    }

  };

  let handleOnChange = value => {
    value = dayjs(value, format, true).format("YYYY-MM-DD HH:mm:ss");
    props.onValueChange(value);
  };

  let settedValue = props.value ? dayjs(props.value).format(format) : "";
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$$f.cloneNode(true);

      addEventListener(_el$, "paste", formatMask);

      addEventListener(_el$, "input", formatMask, true);

      addEventListener(_el$, "click", formatMask, true);

      _el$.addEventListener("change", e => handleOnChange(e.currentTarget.value));

      _el$.addEventListener("focus", e => handleInputFocus(e, props));

      _el$.$$keydown = e => handleInputKeyDown(e, props);

      const _ref$ = inputMask.ref;
      typeof _ref$ === "function" ? _ref$(_el$) : inputMask.ref = _el$;
      _el$.value = settedValue;

      createRenderEffect(_p$ => {
        const _v$ = "inputMask" + props.component.dataKey,
          _v$2 = {
            ['formgear-input-papi-validation-' + props.classValidation]: true
          },
          _v$3 = maskingFormat.replace(/[a]/g, '__').replace(/[9]/g, '#'),
          _v$4 = disableInput();

        _v$ !== _p$._v$ && setAttribute(_el$, "id", _p$._v$ = _v$);
        _p$._v$2 = classList(_el$, _v$2, _p$._v$2);
        _v$3 !== _p$._v$3 && setAttribute(_el$, "placeholder", _p$._v$3 = _v$3);
        _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined
      });

      return _el$;
    }

  });
};

delegateEvents(["keydown", "click", "input"]);

const _tmpl$$e = /*#__PURE__*/template$1(`<input type="text" class="w-full border-gray-300 rounded font-light px-4 py-2.5 text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400">`);

const MaskingInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const formatMask = createInputMask(props.component.maskingFormat);
  let ref;
  const inputMask = {
    ref,

    get value() {
      return inputMask.ref?.value;
    }

  };

  let handleOnChange = value => {
    props.onValueChange(value);
  };

  createEffect(() => {
    document.getElementById("inputMask" + props.component.dataKey).click();
  });
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$$e.cloneNode(true);

      addEventListener(_el$, "paste", formatMask);

      addEventListener(_el$, "input", formatMask, true);

      addEventListener(_el$, "click", formatMask, true);

      _el$.addEventListener("change", e => handleOnChange(e.currentTarget.value));

      const _ref$ = inputMask.ref;
      typeof _ref$ === "function" ? _ref$(_el$) : inputMask.ref = _el$;

      createRenderEffect(_p$ => {
        const _v$ = props.value,
          _v$2 = "inputMask" + props.component.dataKey,
          _v$3 = props.component.maskingFormat.replace(/[a]/g, '__').replace(/[9]/g, '#'),
          _v$4 = disableInput();

        _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
        _v$2 !== _p$._v$2 && setAttribute(_el$, "id", _p$._v$2 = _v$2);
        _v$3 !== _p$._v$3 && setAttribute(_el$, "placeholder", _p$._v$3 = _v$3);
        _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined
      });

      return _el$;
    }

  });
}; // transition ease-in-out m-0

delegateEvents(["click", "input"]);

const _tmpl$$d = /*#__PURE__*/template$1(`<div class="grid font-light text-sm content-start"></div>`),
  _tmpl$2$6 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1"><label class="cursor-pointer text-sm"><input class="form-check-input appearance-none h-4 w-4 border 
                                                            border-gray-300 rounded-sm bg-white 
                                                            checked:bg-blue-600 checked:border-blue-600 
                                                            focus:outline-none transition duration-200 align-top 
                                                            bg-no-repeat bg-center bg-contain float-left mr-2 cursor-pointer
                                                            checked:disabled:bg-gray-500 checked:dark:disabled:bg-gray-300 
                                                            disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" type="checkbox" disabled></label></div><div class="col-span-11"><input type="text" class="w-full
                                                            font-light
                                                            px-4
                                                            py-2.5
                                                            text-sm
                                                            text-gray-700
                                                            bg-white bg-clip-padding
                                                            border border-solid border-gray-300
                                                            rounded
                                                            transition
                                                            ease-in-out
                                                            m-0
                                                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"></div></div>`),
  _tmpl$3$5 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-4 grid grid-cols-12"><div class="col-span-1"><label class="cursor-pointer text-sm"><input class="form-check-input appearance-none h-4 w-4 border 
                                                                border-gray-300 rounded-sm bg-white 
                                                                checked:bg-blue-600 checked:border-blue-600 
                                                                focus:outline-none transition duration-200 mt-1 align-top 
                                                                bg-no-repeat bg-center bg-contain float-left mr-2 cursor-pointer
                                                                checked:disabled:bg-gray-500 checked:dark:disabled:bg-gray-300 
                                                                disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400" type="checkbox" disabled></label></div><div class="col-span-11"></div></div>`);

const MultipleOptionSection = props => {
  const tick = value => {
    return props.value ? props.value.some(d => String(d.value) === String(value)) ? true : false : false;
  };

  const optionLabel = value => {
    let optionIndex = props.value.findIndex(d => String(d.value) === String(value));
    return props.value[optionIndex].label;
  };

  return (() => {
    const _el$ = _tmpl$$d.cloneNode(true);

    insert(_el$, createComponent$1(For, {
      get each() {
        return props.options;
      },

      children: (item, index) => createComponent$1(Switch, {
        get children() {
          return [createComponent$1(Match, {
            get when() {
              return memo(() => !!item.open, true)() && tick(item.value);
            },

            get children() {
              const _el$2 = _tmpl$2$6.cloneNode(true),
                _el$3 = _el$2.firstChild,
                _el$4 = _el$3.firstChild,
                _el$5 = _el$4.firstChild,
                _el$6 = _el$3.nextSibling,
                _el$7 = _el$6.firstChild;

              _el$7.addEventListener("change", e => props.onValueChange(item.value, e.currentTarget.value, item.open));

              createRenderEffect(_p$ => {
                const _v$6 = "chexbox" + index(),
                  _v$7 = item.value,
                  _v$8 = item.value ? tick(item.value) : false,
                  _v$9 = "checkbox-" + props.component.dataKey + "-" + index(),
                  _v$10 = optionLabel(item.value);

                _v$6 !== _p$._v$6 && setAttribute(_el$4, "for", _p$._v$6 = _v$6);
                _v$7 !== _p$._v$7 && (_el$5.value = _p$._v$7 = _v$7);
                _v$8 !== _p$._v$8 && (_el$5.checked = _p$._v$8 = _v$8);
                _v$9 !== _p$._v$9 && setAttribute(_el$5, "id", _p$._v$9 = _v$9);
                _v$10 !== _p$._v$10 && (_el$7.value = _p$._v$10 = _v$10);
                return _p$;
              }, {
                _v$6: undefined,
                _v$7: undefined,
                _v$8: undefined,
                _v$9: undefined,
                _v$10: undefined
              });

              return _el$2;
            }

          }), createComponent$1(Match, {
            get when() {
              return !item.open || !tick(item.value);
            },

            get children() {
              const _el$8 = _tmpl$3$5.cloneNode(true),
                _el$9 = _el$8.firstChild,
                _el$10 = _el$9.firstChild,
                _el$11 = _el$10.firstChild,
                _el$12 = _el$9.nextSibling;

              createRenderEffect(_p$ => {
                const _v$11 = item.value,
                  _v$12 = item.value ? tick(item.value) : false,
                  _v$13 = "checkbox-" + props.component.dataKey + "-" + index(),
                  _v$14 = item.label;

                _v$11 !== _p$._v$11 && (_el$11.value = _p$._v$11 = _v$11);
                _v$12 !== _p$._v$12 && (_el$11.checked = _p$._v$12 = _v$12);
                _v$13 !== _p$._v$13 && setAttribute(_el$11, "id", _p$._v$13 = _v$13);
                _v$14 !== _p$._v$14 && (_el$12.innerHTML = _p$._v$14 = _v$14);
                return _p$;
              }, {
                _v$11: undefined,
                _v$12: undefined,
                _v$13: undefined,
                _v$14: undefined
              });

              return _el$8;
            }

          })];
        }

      })
    }));

    createRenderEffect(_p$ => {
      const _v$ = props.component.cols === 1 || props.component.cols === undefined,
        _v$2 = props.component.cols === 2,
        _v$3 = props.component.cols === 3,
        _v$4 = props.component.cols === 4,
        _v$5 = props.component.cols === 5;

      _v$ !== _p$._v$ && _el$.classList.toggle("grid-cols-1", _p$._v$ = _v$);
      _v$2 !== _p$._v$2 && _el$.classList.toggle("grid-cols-2", _p$._v$2 = _v$2);
      _v$3 !== _p$._v$3 && _el$.classList.toggle("grid-cols-3", _p$._v$3 = _v$3);
      _v$4 !== _p$._v$4 && _el$.classList.toggle("grid-cols-4", _p$._v$4 = _v$4);
      _v$5 !== _p$._v$5 && _el$.classList.toggle("grid-cols-5", _p$._v$5 = _v$5);
      return _p$;
    }, {
      _v$: undefined,
      _v$2: undefined,
      _v$3: undefined,
      _v$4: undefined,
      _v$5: undefined
    });

    return _el$;
  })();
};

const _tmpl$$c = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi" placeholder="">`);

const MultipleSelectInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let getOptions = createMemo(() => {
    if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
      let newSourceOption = props.component.sourceOption.split('@');
      const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === newSourceOption[0]);

      if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
        return reference.details[componentAnswerIndex].answer;
      }
    }

    return [];
  });
  const [options] = createSignal(props.component.sourceOption !== undefined ? getOptions() : props.component.options);

  let handleOnChange = (value, label, open) => {
    let updatedAnswer;

    if (open == undefined) {
      const checkboxOptions = transformCheckboxOptions(options());
      const optionValue = checkboxOptions.map(item => Number(item.checkboxValue));
      const sumCombination = findSumCombination(Number(value), optionValue);

      if (sumCombination.length > 0) {
        updatedAnswer = checkboxOptions.filter(option => sumCombination.includes(Number(option.checkboxValue))).map(it => {
          delete it.checkboxValue;
          return it;
        });
      }
    } else {
      updatedAnswer = JSON.parse(JSON.stringify(transformedValue()));

      if (updatedAnswer) {
        if (props.value.some(d => String(d.value) === String(value))) {
          if (open) {
            let valueIndex = options().findIndex(item => item.value == value);
            updatedAnswer = updatedAnswer.filter(item => item.value != value);
            if (options()[valueIndex].label !== label) updatedAnswer.push({
              value: value,
              label: label
            });
          } else {
            updatedAnswer = updatedAnswer.filter(item => item.value != value);
          }
        } else {
          updatedAnswer.splice(updatedAnswer.length, 0, {
            value: value,
            label: label
          });
        }
      } else {
        updatedAnswer = [];
        updatedAnswer.push({
          value: value,
          label: label
        });
      }
    }

    props.onValueChange(updatedAnswer);
  };

  const transformedValue = createMemo(() => {
    if (props.value?.length > 0) {
      return transformCheckboxOptions(options()).filter(option => props.value.find(value => option.value === value.value));
    }

    return [];
  });
  const settedValue = createMemo(() => {
    if (props.value?.length > 0) {
      return sum(transformedValue().map(it => it.checkboxValue));
    }

    return props.value;
  });

  const optionSection = () => {
    return createComponent$1(MultipleOptionSection, {
      get component() {
        return props.component;
      },

      get options() {
        return options();
      },

      get settedValue() {
        return settedValue();
      },

      onValueChange: handleOnChange,

      get disableInput() {
        return disableInput();
      },

      get value() {
        return props.value;
      }

    });
  };

  return createComponent$1(InputContainer, {
    get validationMessage() {
      return props.validationMessage;
    },

    get component() {
      return props.component;
    },

    optionSection: optionSection,

    get children() {
      return [createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$ = _tmpl$$c.cloneNode(true);

          _el$.$$keydown = e => handleInputKeyDown$1(e);

          _el$.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$.addEventListener("change", e => {
            handleOnChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$ = settedValue(),
              _v$2 = props.component.dataKey,
              _v$3 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$4 = disableInput();

            _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$, "name", _p$._v$2 = _v$2);
            _p$._v$3 = classList(_el$, _v$3, _p$._v$3);
            _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined,
            _v$4: undefined
          });

          return _el$;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$2 = _tmpl$$c.cloneNode(true);

          _el$2.$$keydown = e => handleInputKeyDown$1(e);

          _el$2.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$2.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$5 = settedValue(),
              _v$6 = props.component.dataKey,
              _v$7 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$8 = disableInput(),
              _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

            _v$5 !== _p$._v$5 && (_el$2.value = _p$._v$5 = _v$5);
            _v$6 !== _p$._v$6 && setAttribute(_el$2, "name", _p$._v$6 = _v$6);
            _p$._v$7 = classList(_el$2, _v$7, _p$._v$7);
            _v$8 !== _p$._v$8 && (_el$2.disabled = _p$._v$8 = _v$8);
            _v$9 !== _p$._v$9 && setAttribute(_el$2, "maxlength", _p$._v$9 = _v$9);
            _v$10 !== _p$._v$10 && setAttribute(_el$2, "minlength", _p$._v$10 = _v$10);
            return _p$;
          }, {
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined,
            _v$9: undefined,
            _v$10: undefined
          });

          return _el$2;
        }

      })];
    }

  });
};

delegateEvents(["keydown"]);

const _tmpl$$b = /*#__PURE__*/template$1(`<input type="number" class="formgear-input-papi" placeholder="">`),
  _tmpl$2$5 = /*#__PURE__*/template$1(`<input type="number" class="formgear-input-papi" placeholder="" oninput="javascript: if (this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);">`);

const NumberInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  return createComponent$1(InputContainer, {
    get validationMessage() {
      return props.validationMessage;
    },

    get classValidation() {
      return props.classValidation;
    },

    get component() {
      return props.component;
    },

    get children() {
      return [createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$ = _tmpl$$b.cloneNode(true);

          _el$.$$keydown = e => handleInputKeyDown$1(e);

          _el$.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$ = props.value,
              _v$2 = props.component.dataKey,
              _v$3 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$4 = disableInput();

            _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$, "name", _p$._v$2 = _v$2);
            _p$._v$3 = classList(_el$, _v$3, _p$._v$3);
            _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined,
            _v$4: undefined
          });

          return _el$;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$2 = _tmpl$2$5.cloneNode(true);

          _el$2.$$keydown = e => handleInputKeyDown$1(e);

          _el$2.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$2.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$5 = props.value,
              _v$6 = props.component.dataKey,
              _v$7 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$8 = disableInput(),
              _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '',
              _v$11 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
              _v$12 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

            _v$5 !== _p$._v$5 && (_el$2.value = _p$._v$5 = _v$5);
            _v$6 !== _p$._v$6 && setAttribute(_el$2, "name", _p$._v$6 = _v$6);
            _p$._v$7 = classList(_el$2, _v$7, _p$._v$7);
            _v$8 !== _p$._v$8 && (_el$2.disabled = _p$._v$8 = _v$8);
            _v$9 !== _p$._v$9 && setAttribute(_el$2, "maxlength", _p$._v$9 = _v$9);
            _v$10 !== _p$._v$10 && setAttribute(_el$2, "minlength", _p$._v$10 = _v$10);
            _v$11 !== _p$._v$11 && setAttribute(_el$2, "max", _p$._v$11 = _v$11);
            _v$12 !== _p$._v$12 && setAttribute(_el$2, "min", _p$._v$12 = _v$12);
            return _p$;
          }, {
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined,
            _v$9: undefined,
            _v$10: undefined,
            _v$11: undefined,
            _v$12: undefined
          });

          return _el$2;
        }

      })];
    }

  });
};

delegateEvents(["keydown"]);

const _tmpl$$a = /*#__PURE__*/template$1(`<input type="file" accept="image/*" style="color: transparent;" class="hidden w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100">`),
  _tmpl$2$4 = /*#__PURE__*/template$1(`<button class="formgear-input-papi flex"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></button>`),
  _tmpl$3$4 = /*#__PURE__*/template$1(`<div class="font-light text-sm space-x-2 py-2.5 px-2 col-span-12 space-y-4"><div class="preview-class"><div class="container mx-auto"><img class="rounded-md" style="width:100%;height:100%"></div></div></div>`);

const PhotoInput = props => {
  const [label, setLabel] = createSignal('');
  const [fileSource, setFileSource] = createSignal('');
  const [disableInput] = createSignal(props.config.formMode > 1 ? true : props.component.disableInput);
  let reader = new FileReader();
  createEffect(() => {
    setLabel(props.component.label);

    if (props.value[0]) {
      let imgSrc = props.value[0].value;
      setFileSource(imgSrc);
    }
  });

  let getFileContent = data => {
    let updatedAnswer = JSON.parse(JSON.stringify(props.value));

    if (data.target.files && data.target.files[0]) {
      var allowedExtension = ['jpeg', 'jpg', 'png', 'gif'];
      let doc = data.target.files[0];
      let ext = doc.name.split('.').pop().toLowerCase();

      if (!allowedExtension.includes(ext)) {
        toastInfo('Please submit the appropriate format!', 'bg-pink-600/70');
      } else {
        reader.readAsDataURL(doc);

        reader.onload = e => {
          var filename = doc.name;
          updatedAnswer = [];
          URL.createObjectURL(doc); // updatedAnswer.push({ value: urlImg, label: filename })

          updatedAnswer.push({
            value: e.target.result,
            label: filename,
            type: data.target.files[0].type
          }); // console.log('hasilny adalah : ', updatedAnswer)

          props.onValueChange(updatedAnswer);
          toastInfo('Image uploaded successfully!', '');
        };
      }
    }
  };

  const toastInfo = (text, color) => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: color == '' ? "bg-blue-600/80" : color,
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      return [(() => {
        const _el$ = _tmpl$$a.cloneNode(true);

        _el$.addEventListener("change", e => {
          getFileContent(e);
        });

        createRenderEffect(_p$ => {
          const _v$ = "inputFile_" + props.component.dataKey,
            _v$2 = props.component.dataKey;

          _v$ !== _p$._v$ && setAttribute(_el$, "id", _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && setAttribute(_el$, "name", _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$;
      })(), (() => {
        const _el$2 = _tmpl$2$4.cloneNode(true);
        _el$2.firstChild;

        _el$2.$$click = e => {
          document.getElementById("inputFile_" + props.component.dataKey).click();
        };

        insert(_el$2, () => locale.details.language[0].uploadImage, null);

        createRenderEffect(_p$ => {
          const _v$3 = {
            ['formgear-input-papi-validation-' + props.classValidation]: true
          },
            _v$4 = disableInput(),
            _v$5 = locale.details.language[0].uploadImage;

          _p$._v$3 = classList(_el$2, _v$3, _p$._v$3);
          _v$4 !== _p$._v$4 && (_el$2.disabled = _p$._v$4 = _v$4);
          _v$5 !== _p$._v$5 && setAttribute(_el$2, "title", _p$._v$5 = _v$5);
          return _p$;
        }, {
          _v$3: undefined,
          _v$4: undefined,
          _v$5: undefined
        });

        return _el$2;
      })(), createComponent$1(Show, {
        get when() {
          return fileSource() != '';
        },

        get children() {
          const _el$4 = _tmpl$3$4.cloneNode(true),
            _el$5 = _el$4.firstChild,
            _el$6 = _el$5.firstChild,
            _el$7 = _el$6.firstChild;

          createRenderEffect(_p$ => {
            const _v$6 = fileSource(),
              _v$7 = "img-preview" + props.component.dataKey;

            _v$6 !== _p$._v$6 && setAttribute(_el$7, "src", _p$._v$6 = _v$6);
            _v$7 !== _p$._v$7 && setAttribute(_el$7, "id", _p$._v$7 = _v$7);
            return _p$;
          }, {
            _v$6: undefined,
            _v$7: undefined
          });

          return _el$4;
        }

      })];
    }

  });
};

delegateEvents(["click"]);

const _tmpl$$9 = /*#__PURE__*/template$1(`<input type="number" class="formgear-input-papi">`);

const RangeSliderInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$$9.cloneNode(true);

      _el$.addEventListener("change", e => props.onValueChange(e.currentTarget.value));

      createRenderEffect(_p$ => {
        const _v$ = props.value || 0,
          _v$2 = {
            ['formgear-input-papi-validation-' + props.classValidation]: true
          },
          _v$3 = props.component.rangeInput[0].min,
          _v$4 = props.component.rangeInput[0].max,
          _v$5 = props.component.rangeInput[0].step,
          _v$6 = disableInput();

        _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
        _p$._v$2 = classList(_el$, _v$2, _p$._v$2);
        _v$3 !== _p$._v$3 && setAttribute(_el$, "min", _p$._v$3 = _v$3);
        _v$4 !== _p$._v$4 && setAttribute(_el$, "max", _p$._v$4 = _v$4);
        _v$5 !== _p$._v$5 && setAttribute(_el$, "step", _p$._v$5 = _v$5);
        _v$6 !== _p$._v$6 && (_el$.disabled = _p$._v$6 = _v$6);
        return _p$;
      }, {
        _v$: undefined,
        _v$2: undefined,
        _v$3: undefined,
        _v$4: undefined,
        _v$5: undefined,
        _v$6: undefined
      });

      return _el$;
    }

  });
};

const _tmpl$$8 = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi" placeholder="">`);

const SelectInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  let settedValue = props.value ? props.value.length > 0 ? props.value[0].value : props.value : props.value;

  let handleOnChange = (value, label) => {
    let updatedAnswer = [];

    if (label == null) {
      label = options().find(it => it.value == value)?.label;
    }

    updatedAnswer = [{
      value,
      label
    }];
    props.onValueChange([...updatedAnswer]);
  };

  let getOptions = createMemo(() => {
    if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
      let newSourceOption = props.component.sourceOption.split('@');
      const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === newSourceOption[0]);

      if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
        return reference.details[componentAnswerIndex].answer;
      }
    }

    return [];
  });
  const [options] = createSignal(props.component.sourceOption !== undefined ? getOptions() : props.component.options);

  const optionSection = () => {
    return createComponent$1(OptionSection, {
      get component() {
        return props.component;
      },

      get options() {
        return options();
      },

      settedValue: settedValue,
      onValueChange: handleOnChange,

      get disableInput() {
        return disableInput();
      },

      get value() {
        return props.value;
      }

    });
  };

  return createComponent$1(InputContainer, {
    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get component() {
      return props.component;
    },

    optionSection: optionSection,

    get children() {
      return [createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$ = _tmpl$$8.cloneNode(true);

          _el$.$$keydown = e => handleInputKeyDown$1(e);

          _el$.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$.addEventListener("change", e => {
            handleOnChange(e.currentTarget.value);
          });

          _el$.value = settedValue;

          createRenderEffect(_p$ => {
            const _v$ = props.component.dataKey,
              _v$2 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$3 = disableInput();

            _v$ !== _p$._v$ && setAttribute(_el$, "name", _p$._v$ = _v$);
            _p$._v$2 = classList(_el$, _v$2, _p$._v$2);
            _v$3 !== _p$._v$3 && (_el$.disabled = _p$._v$3 = _v$3);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined
          });

          return _el$;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$2 = _tmpl$$8.cloneNode(true);

          _el$2.$$keydown = e => handleInputKeyDown$1(e);

          _el$2.addEventListener("focus", e => handleInputFocus$1(e, props));

          _el$2.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          _el$2.value = settedValue;

          createRenderEffect(_p$ => {
            const _v$4 = props.component.dataKey,
              _v$5 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$6 = disableInput(),
              _v$7 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$8 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

            _v$4 !== _p$._v$4 && setAttribute(_el$2, "name", _p$._v$4 = _v$4);
            _p$._v$5 = classList(_el$2, _v$5, _p$._v$5);
            _v$6 !== _p$._v$6 && (_el$2.disabled = _p$._v$6 = _v$6);
            _v$7 !== _p$._v$7 && setAttribute(_el$2, "maxlength", _p$._v$7 = _v$7);
            _v$8 !== _p$._v$8 && setAttribute(_el$2, "minlength", _p$._v$8 = _v$8);
            return _p$;
          }, {
            _v$4: undefined,
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined
          });

          return _el$2;
        }

      })];
    }

  });
};

delegateEvents(["keydown"]);

const _tmpl$$7 = /*#__PURE__*/template$1(`<textarea class="formgear-input-papi"></textarea>`);

const TextAreaInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      return [createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$ = _tmpl$$7.cloneNode(true);

          _el$.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$ = props.value,
              _v$2 = props.component.rows || 2,
              _v$3 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$4 = disableInput();

            _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$, "rows", _p$._v$2 = _v$2);
            _p$._v$3 = classList(_el$, _v$3, _p$._v$3);
            _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined,
            _v$4: undefined
          });

          return _el$;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$2 = _tmpl$$7.cloneNode(true);

          _el$2.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$5 = props.value,
              _v$6 = props.component.rows || 2,
              _v$7 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$8 = disableInput(),
              _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

            _v$5 !== _p$._v$5 && (_el$2.value = _p$._v$5 = _v$5);
            _v$6 !== _p$._v$6 && setAttribute(_el$2, "rows", _p$._v$6 = _v$6);
            _p$._v$7 = classList(_el$2, _v$7, _p$._v$7);
            _v$8 !== _p$._v$8 && (_el$2.disabled = _p$._v$8 = _v$8);
            _v$9 !== _p$._v$9 && setAttribute(_el$2, "maxlength", _p$._v$9 = _v$9);
            _v$10 !== _p$._v$10 && setAttribute(_el$2, "minlength", _p$._v$10 = _v$10);
            return _p$;
          }, {
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined,
            _v$9: undefined,
            _v$10: undefined
          });

          return _el$2;
        }

      })];
    }

  });
};

const _tmpl$$6 = /*#__PURE__*/template$1(`<input type="text" class="formgear-input-papi" placeholder="">`),
  _tmpl$2$3 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`),
  _tmpl$3$3 = /*#__PURE__*/template$1(`<div class="col-span-1 flex justify-center items-start"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`),
  _tmpl$4$2 = /*#__PURE__*/template$1(`<div class="text-xs font-light mt-1"><div class="grid grid-cols-12"><div class="col-span-11 text-justify mr-1"></div></div></div>`);

const TextInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 && config.initialMode == 2 ? true : config.initialMode == 1 && props.component.disableInitial !== undefined ? props.component.disableInitial : props.component.disableInput);
  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get children() {
      return [createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$ = _tmpl$$6.cloneNode(true);

          _el$.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$ = props.value,
              _v$2 = props.component.dataKey,
              _v$3 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$4 = disableInput();

            _v$ !== _p$._v$ && (_el$.value = _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$, "name", _p$._v$2 = _v$2);
            _p$._v$3 = classList(_el$, _v$3, _p$._v$3);
            _v$4 !== _p$._v$4 && (_el$.disabled = _p$._v$4 = _v$4);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined,
            _v$4: undefined
          });

          return _el$;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$2 = _tmpl$$6.cloneNode(true);

          _el$2.addEventListener("change", e => {
            props.onValueChange(e.currentTarget.value);
          });

          createRenderEffect(_p$ => {
            const _v$5 = props.value,
              _v$6 = props.component.dataKey,
              _v$7 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$8 = disableInput(),
              _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '';

            _v$5 !== _p$._v$5 && (_el$2.value = _p$._v$5 = _v$5);
            _v$6 !== _p$._v$6 && setAttribute(_el$2, "name", _p$._v$6 = _v$6);
            _p$._v$7 = classList(_el$2, _v$7, _p$._v$7);
            _v$8 !== _p$._v$8 && (_el$2.disabled = _p$._v$8 = _v$8);
            _v$9 !== _p$._v$9 && setAttribute(_el$2, "maxlength", _p$._v$9 = _v$9);
            _v$10 !== _p$._v$10 && setAttribute(_el$2, "minlength", _p$._v$10 = _v$10);
            return _p$;
          }, {
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined,
            _v$9: undefined,
            _v$10: undefined
          });

          return _el$2;
        }

      }), createComponent$1(Show, {
        get when() {
          return props.validationMessage.length > 0;
        },

        get children() {
          return createComponent$1(For, {
            get each() {
              return props.validationMessage;
            },

            children: item => (() => {
              const _el$3 = _tmpl$4$2.cloneNode(true),
                _el$4 = _el$3.firstChild,
                _el$7 = _el$4.firstChild;

              insert(_el$4, createComponent$1(Switch, {
                get children() {
                  return [createComponent$1(Match, {
                    get when() {
                      return props.classValidation === 1;
                    },

                    get children() {
                      return _tmpl$2$3.cloneNode(true);
                    }

                  }), createComponent$1(Match, {
                    get when() {
                      return props.classValidation === 2;
                    },

                    get children() {
                      return _tmpl$3$3.cloneNode(true);
                    }

                  })];
                }

              }), _el$7);

              _el$7.innerHTML = item;

              createRenderEffect(_$p => classList(_el$4, {
                ' text-orange-500 dark:text-orange-200 ': props.classValidation === 1,
                ' text-pink-600 dark:text-pink-200 ': props.classValidation === 2
              }, _$p));

              return _el$3;
            })()
          });
        }

      })];
    }

  });
};

const _tmpl$$5 = /*#__PURE__*/template$1(`<input type="number" class="formgear-input-papi block pr-20" placeholder="">`),
  _tmpl$2$2 = /*#__PURE__*/template$1(`<input type="number" class="formgear-input-papi block pr-20" placeholder="" oninput="javascript: if (this.value.length > this.maxLength) this.value = this.value.slice(0, this.maxLength);">`),
  _tmpl$3$2 = /*#__PURE__*/template$1(`<div class="relative"><div class="absolute inset-y-0 right-0 flex items-center"></div></div>`);

const UnitInput = props => {
  const config = props.config;
  const [disableInput] = createSignal(config.formMode > 1 ? true : props.component.disableInput);
  const [label, setLabel] = createSignal('');
  const [isLoading, setLoading] = createSignal(false);
  const [options, setOptions] = createSignal([]);
  const [selectedOption, setSelectedOption] = createSignal('');
  const isPublic = false;

  const toastInfo = text => {
    Toastify({
      text: text == '' ? "" : text,
      duration: 3000,
      gravity: "top",
      position: "right",
      stopOnFocus: true,
      className: "bg-pink-700/80",
      style: {
        background: "rgba(8, 145, 178, 0.7)",
        width: "400px"
      }
    }).showToast();
  };

  let handleOnChange = (value, unit, isChange) => {
    if (isChange == 2 && unit.value != '' && unit.value != undefined) {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        unit: unit
      });
      props.onValueChange(updatedAnswer);
    } else {
      let updatedAnswer = JSON.parse(JSON.stringify(props.value));
      updatedAnswer = [];
      updatedAnswer.push({
        value: value,
        unit: unit
      });
      props.onValueChange(updatedAnswer);
    }
  };

  switch (props.component.typeOption) {
    case 1:
      {
        try {
          let options = props.component.options.map((item, value) => {
            return {
              value: item.value,
              label: item.label
            };
          });
          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : 'Select Unit';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 2:
      {
        try {
          if (config.lookupMode === 1) {
            let url;
            let params;
            let urlHead;
            let urlParams;

            if (!isPublic) {
              params = props.component.sourceSelect; // url = `${config.baseUrl}/${params[0].id}`

              url = `${config.baseUrl}/${params[0].id}/filter?version=${params[0].version}`;

              if (params[0].parentCondition.length > 0) {
                urlHead = url;
                urlParams = params[0].parentCondition.map((item, index) => {
                  let newParams = item.value.split('@');
                  let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                  if (tobeLookup.answer) {
                    if (tobeLookup.answer.length > 0) {
                      let parentValue = encodeURI(tobeLookup.answer[tobeLookup.answer.length - 1].value);
                      url = `${config.lookupKey}=${item.key}&${config.lookupValue}=${parentValue}`;
                    }
                  } else {
                    url = `${config.lookupKey}=${item.key}&${config.lookupValue}=''`;
                  }

                  return url;
                }).join('&'); // url = `${urlHead}?${urlParams}`

                url = `${urlHead}&${urlParams}`;
              }
            } // console.log('Lookup URL ', url)


            const [fetched] = createResource(url, props.MobileOnlineSearch);
            let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
            createEffect(() => {
              setLabel(props.component.label);

              if (fetched()) {
                if (!fetched().success) {
                  toastInfo(locale.details.language[0].fetchFailed);
                } else {
                  let arr;

                  if (!isPublic) {
                    arr = []; // let cekValue = fetched().data.metadata.findIndex(item => item.name == params[0].value)
                    // let cekLabel = fetched().data.metadata.findIndex(item => item.name == params[0].desc)

                    let cekValue = params[0].value;
                    let cekLabel = params[0].desc; // fetched().data.data.map((item, value) => {
                    //     arr.push(
                    //         {
                    //             value: item[cekValue],
                    //             label: item[cekLabel],
                    //         }
                    //     )
                    // })

                    fetched().data.map((item, value) => {
                      arr.push({
                        value: item[cekValue],
                        label: item[cekLabel]
                      });
                    });
                  }

                  let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : 'Select Unit';
                  setOptions(arr);
                  setSelectedOption(ans);
                  setLoading(true);
                }
              }
            });
          } else if (config.lookupMode === 2) {
            let params;
            let tempArr = [];
            params = props.component.sourceSelect;
            let id = params[0].id;
            let version = params[0].version;

            if (params[0].parentCondition.length > 0) {
              params[0].parentCondition.map((item, index) => {
                let newParams = item.value.split('@');
                let tobeLookup = reference.details.find(obj => obj.dataKey == newParams[0]);

                if (tobeLookup.answer) {
                  if (tobeLookup.answer.length > 0) {
                    let parentValue = tobeLookup.answer[tobeLookup.answer.length - 1].value.toString();
                    tempArr.push({
                      "key": item.key,
                      "value": parentValue
                    });
                  }
                }
              });
            } // console.log('id : ', id)
            // console.log('version : ', version)
            // console.log('kondisi : ', tempArr)


            let getResult = result => {
              let arr = [];

              if (result.data.length > 0) {
                let cekValue = params[0].value;
                let cekLabel = params[0].desc;
                let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
                result.data.map((item, value) => {
                  arr.push({
                    value: item[cekValue],
                    label: item[cekLabel]
                  });
                });
                let ans = arr.find(obj => obj.value == checker) && checker != '' ? arr.find(obj => obj.value == checker).label : 'Select Unit';
                setLabel(props.component.label);
                setOptions(arr);
                setSelectedOption(ans);
                setLoading(true);
              }
            };

            const fetched = props.MobileOfflineSearch(id, version, tempArr, getResult);
          }
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    case 3:
      {
        try {
          let optionsSource;
          let finalOptions;
          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';

          if (props.component.sourceOption !== undefined && props.component.typeOption === 3) {
            const componentAnswerIndex = reference.details.findIndex(obj => obj.dataKey === props.component.sourceOption);

            if (reference.details[componentAnswerIndex].type === 21 || 22 || 23 || 26 || 27 || 29 || reference.details[componentAnswerIndex].type === 4 && reference.details[componentAnswerIndex].renderType === 2) {
              optionsSource = reference.details[componentAnswerIndex].answer;

              if (optionsSource != undefined) {
                finalOptions = optionsSource.filter((item, value) => item.value != 0).map((item, value) => {
                  return {
                    value: item.value,
                    label: item.label
                  };
                });
              } else {
                finalOptions = [];
              }
            }
          }

          let ans = finalOptions.find(obj => obj.value == checker) && checker != '' ? finalOptions.find(obj => obj.value == checker).label : 'Select Unit';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(finalOptions);
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }

    default:
      {
        try {
          let options;

          if (props.component.options) {
            options = props.component.options.map((item, value) => {
              return {
                value: item.value,
                label: item.label
              };
            });
          } else {
            options = [];
          }

          let checker = props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '';
          createEffect(() => {
            setLabel(props.component.label);
            setOptions(options);
            let ans = options.filter(val => val.value.includes(checker))[0] && checker != '' ? options.filter(val => val.value.includes(checker))[0].label : 'Select Unit';
            setSelectedOption(ans);
            setLoading(true);
          });
        } catch (e) {
          toastInfo(locale.details.language[0].fetchFailed);
        }

        break;
      }
  }

  return createComponent$1(InputContainer, {
    get component() {
      return props.component;
    },

    get classValidation() {
      return props.classValidation;
    },

    get validationMessage() {
      return props.validationMessage;
    },

    get children() {
      const _el$ = _tmpl$3$2.cloneNode(true),
        _el$4 = _el$.firstChild;

      insert(_el$, createComponent$1(Show, {
        get when() {
          return props.component.lengthInput === undefined;
        },

        get children() {
          const _el$2 = _tmpl$$5.cloneNode(true);

          _el$2.addEventListener("change", e => {
            handleOnChange(e ? e.currentTarget.value : '', props.value != undefined && props.value != '' ? props.value[0].unit ? props.value[0].unit : {
              value: '',
              label: ''
            } : {
              value: '',
              label: ''
            }, 1);
          });

          createRenderEffect(_p$ => {
            const _v$ = props.value != undefined ? props.value != '' ? props.value[0].value : '' : '',
              _v$2 = props.component.dataKey,
              _v$3 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$4 = disableInput();

            _v$ !== _p$._v$ && (_el$2.value = _p$._v$ = _v$);
            _v$2 !== _p$._v$2 && setAttribute(_el$2, "name", _p$._v$2 = _v$2);
            _p$._v$3 = classList(_el$2, _v$3, _p$._v$3);
            _v$4 !== _p$._v$4 && (_el$2.disabled = _p$._v$4 = _v$4);
            return _p$;
          }, {
            _v$: undefined,
            _v$2: undefined,
            _v$3: undefined,
            _v$4: undefined
          });

          return _el$2;
        }

      }), _el$4);

      insert(_el$, createComponent$1(Show, {
        get when() {
          return props.component.lengthInput !== undefined && props.component.lengthInput.length > 0;
        },

        get children() {
          const _el$3 = _tmpl$2$2.cloneNode(true);

          _el$3.addEventListener("change", e => {
            handleOnChange(e ? e.currentTarget.value : '', props.value != undefined && props.value != '' ? props.value[0].unit ? props.value[0].unit : {
              value: '',
              label: ''
            } : {
              value: '',
              label: ''
            }, 1);
          });

          createRenderEffect(_p$ => {
            const _v$5 = props.value != undefined ? props.value != '' ? props.value[0].value : '' : '',
              _v$6 = props.component.dataKey,
              _v$7 = {
                ['formgear-input-papi-validation-' + props.classValidation]: true
              },
              _v$8 = disableInput(),
              _v$9 = props.component.lengthInput[0].maxlength !== undefined ? props.component.lengthInput[0].maxlength : '',
              _v$10 = props.component.lengthInput[0].minlength !== undefined ? props.component.lengthInput[0].minlength : '',
              _v$11 = props.component.rangeInput ? props.component.rangeInput[0].max !== undefined ? props.component.rangeInput[0].max : '' : '',
              _v$12 = props.component.rangeInput ? props.component.rangeInput[0].min !== undefined ? props.component.rangeInput[0].min : '' : '';

            _v$5 !== _p$._v$5 && (_el$3.value = _p$._v$5 = _v$5);
            _v$6 !== _p$._v$6 && setAttribute(_el$3, "name", _p$._v$6 = _v$6);
            _p$._v$7 = classList(_el$3, _v$7, _p$._v$7);
            _v$8 !== _p$._v$8 && (_el$3.disabled = _p$._v$8 = _v$8);
            _v$9 !== _p$._v$9 && setAttribute(_el$3, "maxlength", _p$._v$9 = _v$9);
            _v$10 !== _p$._v$10 && setAttribute(_el$3, "minlength", _p$._v$10 = _v$10);
            _v$11 !== _p$._v$11 && setAttribute(_el$3, "max", _p$._v$11 = _v$11);
            _v$12 !== _p$._v$12 && setAttribute(_el$3, "min", _p$._v$12 = _v$12);
            return _p$;
          }, {
            _v$5: undefined,
            _v$6: undefined,
            _v$7: undefined,
            _v$8: undefined,
            _v$9: undefined,
            _v$10: undefined,
            _v$11: undefined,
            _v$12: undefined
          });

          return _el$3;
        }

      }), _el$4);

      insert(_el$4, createComponent$1(Select, mergeProps({
        "class": "formgear-select-unit  w-full rounded font-light text-sm text-gray-700 bg-white bg-clip-padding transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-0 border-transparent focus:outline-none  disabled:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
      }, () => createOptions(options() || [], {
        key: "label",
        filterable: true
      }), {
        get disabled() {
          return disableInput();
        },

        placeholder: "Unit",
        onChange: e => handleOnChange(props.value != undefined ? props.value != '' ? props.value[0].value : '' : '', {
          value: e ? e.value : '',
          label: e ? e.label : ''
        }, 2),

        get initialValue() {
          return {
            value: props.value ? props.value != '' ? props.value[0].unit ? props.value[0].unit.value ? props.value[0].unit.value != '' ? props.value[0].unit.value : '' : '' : '' : '' : '',
            label: selectedOption
          };
        }

      })), null);

      insert(_el$4, createComponent$1(FiChevronDown, {
        size: 20,
        "class": "text-gray-400  mr-3"
      }), null);

      return _el$;
    }

  });
};

let ControlType;

(function (ControlType) {
  ControlType[ControlType["Section"] = 1] = "Section";
  ControlType[ControlType["NestedInput"] = 2] = "NestedInput";
  ControlType[ControlType["InnerHTML"] = 3] = "InnerHTML";
  ControlType[ControlType["VariableInput"] = 4] = "VariableInput";
  ControlType[ControlType["DateInput"] = 11] = "DateInput";
  ControlType[ControlType["DateTimeLocalInput"] = 12] = "DateTimeLocalInput";
  ControlType[ControlType["TimeInput"] = 13] = "TimeInput";
  ControlType[ControlType["MonthInput"] = 14] = "MonthInput";
  ControlType[ControlType["WeekInput"] = 15] = "WeekInput";
  ControlType[ControlType["SingleCheckInput"] = 16] = "SingleCheckInput";
  ControlType[ControlType["ToggleInput"] = 17] = "ToggleInput";
  ControlType[ControlType["RangeSliderInput"] = 18] = "RangeSliderInput";
  ControlType[ControlType["UrlInput"] = 19] = "UrlInput";
  ControlType[ControlType["CurrencyInput"] = 20] = "CurrencyInput";
  ControlType[ControlType["ListTextInputRepeat"] = 21] = "ListTextInputRepeat";
  ControlType[ControlType["ListSelectInputRepeat"] = 22] = "ListSelectInputRepeat";
  ControlType[ControlType["MultipleSelectInput"] = 23] = "MultipleSelectInput";
  ControlType[ControlType["MaskingInput"] = 24] = "MaskingInput";
  ControlType[ControlType["TextInput"] = 25] = "TextInput";
  ControlType[ControlType["RadioInput"] = 26] = "RadioInput";
  ControlType[ControlType["SelectInput"] = 27] = "SelectInput";
  ControlType[ControlType["NumberInput"] = 28] = "NumberInput";
  ControlType[ControlType["CheckboxInput"] = 29] = "CheckboxInput";
  ControlType[ControlType["TextAreaInput"] = 30] = "TextAreaInput";
  ControlType[ControlType["EmailInput"] = 31] = "EmailInput";
  ControlType[ControlType["PhotoInput"] = 32] = "PhotoInput";
  ControlType[ControlType["GpsInput"] = 33] = "GpsInput";
  ControlType[ControlType["CsvInput"] = 34] = "CsvInput";
  ControlType[ControlType["NowInput"] = 35] = "NowInput";
  ControlType[ControlType["SignatureInput"] = 36] = "SignatureInput";
  ControlType[ControlType["UnitInput"] = 37] = "UnitInput";
  ControlType[ControlType["DecimalInput"] = 38] = "DecimalInput";
})(ControlType || (ControlType = {}));

const CONTROL_MAP = new Map([[ControlType.NestedInput, NestedInput], [ControlType.TextInput, TextInput$1], [ControlType.RadioInput, RadioInput], [ControlType.SelectInput, SelectInput$1], [ControlType.NumberInput, NumberInput$1], [ControlType.CheckboxInput, CheckboxInput], [ControlType.TextAreaInput, TextAreaInput$1], [ControlType.EmailInput, EmailInput], [ControlType.UrlInput, UrlInput], [ControlType.DateInput, DateInput$2], [ControlType.DateTimeLocalInput, DateTimeLocalInput$1], [ControlType.TimeInput, TimeInput], [ControlType.MonthInput, MonthInput$1], [ControlType.WeekInput, MonthInput], [ControlType.SingleCheckInput, SingleCheckInput], [ControlType.ToggleInput, ToggleInput], [ControlType.RangeSliderInput, RangeSliderInput$1], [ControlType.InnerHTML, DateInput$1], [ControlType.CurrencyInput, CurrencyInput$1], [ControlType.ListTextInputRepeat, ListTextInputRepeat], [ControlType.ListSelectInputRepeat, ListSelectInputRepeat], [ControlType.MultipleSelectInput, MultipleSelectInput$1], [ControlType.MaskingInput, MaskingInput$1], [ControlType.VariableInput, VariableInput], [ControlType.PhotoInput, PhotoInput$1], [ControlType.GpsInput, GpsInput], [ControlType.CsvInput, CsvInput], [ControlType.NowInput, NowInput], [ControlType.SignatureInput, SignatureInput], [ControlType.UnitInput, UnitInput$1], [ControlType.DecimalInput, DecimalInput]]); // const CONTROL_MAP_PAPI = CONTROL_MAP
// CONTROL_MAP_PAPI.set(ControlType.TextInput, PAPITextInput)
// CONTROL_MAP_PAPI.set(ControlType.NumberInput, PAPINumberInput)
// CONTROL_MAP_PAPI.set(ControlType.RadioInput, PAPIRadioInput)
// CONTROL_MAP_PAPI.set(ControlType.TextAreaInput, PAPITextAreaInput)
// CONTROL_MAP_PAPI.set(ControlType.DateInput, PAPIDateInput)
// export { CONTROL_MAP_PAPI }

const OPTION_INPUT_CONTROL = [ControlType.SelectInput, ControlType.RadioInput];
const CONTROL_MAP_PAPI = new Map([[ControlType.NestedInput, NestedInput], [ControlType.TextInput, TextInput], [ControlType.RadioInput, SelectInput], [ControlType.SelectInput, SelectInput], [ControlType.NumberInput, NumberInput], [ControlType.CheckboxInput, MultipleSelectInput], [ControlType.TextAreaInput, TextAreaInput], [ControlType.EmailInput, EmailInput], [ControlType.UrlInput, UrlInput], [ControlType.DateInput, DateInput], [ControlType.DateTimeLocalInput, DateTimeLocalInput], [ControlType.TimeInput, TimeInput], [ControlType.MonthInput, MonthInput$1], [ControlType.WeekInput, MonthInput], [ControlType.SingleCheckInput, SingleCheckInput], [ControlType.ToggleInput, ToggleInput], [ControlType.RangeSliderInput, RangeSliderInput], [ControlType.InnerHTML, DateInput$1], [ControlType.CurrencyInput, CurrencyInput], [ControlType.ListTextInputRepeat, ListTextInputRepeat], [ControlType.ListSelectInputRepeat, ListSelectInputRepeat], [ControlType.MultipleSelectInput, MultipleSelectInput], [ControlType.MaskingInput, MaskingInput], [ControlType.VariableInput, VariableInput], [ControlType.PhotoInput, PhotoInput], [ControlType.GpsInput, GpsInput], [ControlType.CsvInput, CsvInput], [ControlType.NowInput, NowInput], [ControlType.SignatureInput, SignatureInput], [ControlType.UnitInput, UnitInput], [ControlType.DecimalInput, DecimalInput]]);

const LoaderStateContext = createContext();
const LoaderDispatchContext = createContext();
const initialState = {
  loader: []
};
function FormLoaderProvider(props) {
  const [store, setStore] = createStore(initialState);

  function setLoader() {
    setStore("loader", produce(loader => {
      loader.push({
        id: 1
      });
    }));
  }

  const removeLoader = id => () => {
    setStore("loader", produce(loader => {
      const index = loader.findIndex(s => s.id === id);

      if (index > -1) {
        loader.splice(index, 1);
      }
    }));
  }; // function removeLoader() {
  //     console.log('rem',store)
  //     setStore("loader", []);
  //     console.log('end rem',store)
  // }


  return createComponent$1(LoaderStateContext.Provider, {
    value: store,

    get children() {
      return createComponent$1(LoaderDispatchContext.Provider, {
        value: {
          setLoader,
          removeLoader
        },

        get children() {
          return props.children;
        }

      });
    }

  });
}
const useLoaderState = () => useContext(LoaderStateContext);
const useLoaderDispatch = () => useContext(LoaderDispatchContext);

const [principal, setPrincipal] = createStore({
  status: 1,
  details: {
    principals: []
  }
});

const [media$1, setMedia] = createStore({
  status: 1,
  details: {
    dataKey: '',
    media: []
  }
});

const [summary, setSummary] = createStore({
  answer: 0,
  blank: 0,
  error: 0,
  remark: 0,
  clean: 0
});

const _tmpl$$4 = /*#__PURE__*/template$1(`<div class="modal-loading fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block overflow-hidden  transform transition-all items-center"><svg class="animate-spin h-16 w-16 text-zinc-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div></div></div>`),
  _tmpl$2$1 = /*#__PURE__*/template$1(`<div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="grid grid-cols-8"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full text-yellow-400 bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg></div><div class="mt-1 text-left col-span-7 "><textarea rows="2" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 border 
                                  border-solid border-gray-300 bg-white bg-clip-padding transition ease-in-out m-0 
                                  focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none" placeholder=""></textarea></div></div></div>`),
  _tmpl$3$1 = /*#__PURE__*/template$1(`<div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white 
                        hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">&nbsp;&nbsp;Save&nbsp;&nbsp;</button><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button></div>`),
  _tmpl$4$1 = /*#__PURE__*/template$1(`<div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button></div>`),
  _tmpl$5$1 = /*#__PURE__*/template$1(`<div class="modal-remark fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-gray-50 p-8 space-y-5"></div></div></div></div>`),
  _tmpl$6$1 = /*#__PURE__*/template$1(`<div><div></div></div>`),
  _tmpl$7$1 = /*#__PURE__*/template$1(`<div class="bg-white p-4 grid grid-cols-8 rounded-lg"><div class="text-xs font-normal text-gray-400 col-span-5"></div><div class="text-xs font-light text-indigo-700 col-span-3 text-right italic"></div><div class="text-xs text-gray-700 py-2 -mb-2 col-span-12 text-justify"></div></div>`);
const getEnable = dataKey => {
  const componentIndex = reference.details.findIndex(obj => obj.dataKey === dataKey);
  let enable = true;

  if (componentIndex !== -1) {
    enable = reference.details[componentIndex].enable;
  }

  return enable;
};
const toastInfo = (text, duration, position, bgColor) => {
  Toastify({
    text: text == '' ? locale.details.language[0].componentDeleted : text,
    duration: duration >= 0 ? duration : 500,
    gravity: "top",
    position: position == '' ? "right" : position,
    stopOnFocus: true,
    className: bgColor == '' ? "bg-blue-600/80" : bgColor,
    style: {
      background: "rgba(8, 145, 178, 0.7)",
      width: "400px"
    }
  }).showToast();
};

const FormInput = props => {
  const [form, {
    setActiveComponent
  }] = useForm();
  const {
    setLoader,
    removeLoader
  } = useLoaderDispatch();
  const [flagRemark, setFlagRemark] = createSignal(''); //dataKey Remark

  const [comments, setComments] = createSignal([]); //temp Comments

  const [tmpComment, setTmpComment] = createSignal(''); //temp Comment

  const [docState, setDocState] = createSignal('E');
  const [loading, setLoading] = createSignal(false); //temp Comment

  const setData = () => {
    const dataForm = [];
    const dataMedia = [];
    const dataPrincipal = [];
    reference.details.forEach(element => {
      if (element.type > 3 && element.enable && element.answer !== undefined && element.answer !== '' && element.answer !== null) {
        let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());

        if (enableFalse == -1) {
          (element.type == 32 || element.type == 36) && dataMedia.push({
            dataKey: element.dataKey,
            name: element.name,
            answer: element.answer
          });
          dataForm.push({
            dataKey: element.dataKey,
            name: element.name,
            answer: element.answer
          });

          if (element.principal !== undefined) {
            dataPrincipal.push({
              dataKey: element.dataKey,
              name: element.name,
              answer: element.answer,
              principal: element.principal,
              columnName: element.columnName
            });
          }
        }
      }
    }); //setResponse

    setResponse('details', 'answers', dataForm);
    setResponse('details', 'templateDataKey', template.details.dataKey);
    setResponse('details', 'gearVersion', gearVersion);
    setResponse('details', 'templateVersion', templateVersion);
    setResponse('details', 'validationVersion', validationVersion);
    setResponse('details', 'docState', docState());
    setResponse('details', 'summary', JSON.parse(JSON.stringify(summary)));
    setResponse('details', 'counter', [JSON.parse(JSON.stringify(counter))]);
    let now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    response.details.createdBy === undefined || response.details.createdBy !== undefined && response.details.createdBy === '' ? setResponse('details', 'createdBy', props.config.username) : setResponse('details', 'updatedBy', props.config.username);
    response.details.createdAt === undefined || response.details.createdAt !== undefined && response.details.createdAt === '' ? setResponse('details', 'createdAt', now) : setResponse('details', 'updatedAt', now); //setPrincipal

    setPrincipal('details', 'principals', dataPrincipal);
    setPrincipal('details', 'templateDataKey', template.details.dataKey);
    setPrincipal('details', 'gearVersion', gearVersion);
    setPrincipal('details', 'templateVersion', templateVersion);
    setPrincipal('details', 'validationVersion', validationVersion);
    principal.details.createdBy === undefined || principal.details.createdBy !== undefined && principal.details.createdBy === '' ? setPrincipal('details', 'createdBy', props.config.username) : setPrincipal('details', 'updatedBy', props.config.username);
    principal.details.createdAt === undefined || principal.details.createdAt !== undefined && principal.details.createdAt === '' ? setPrincipal('details', 'createdAt', now) : setPrincipal('details', 'updatedAt', now); //setRemark

    setRemark('details', 'notes', JSON.parse(JSON.stringify(note.details.notes)));
    setRemark('details', 'templateDataKey', template.details.dataKey);
    setRemark('details', 'gearVersion', gearVersion);
    setRemark('details', 'templateVersion', templateVersion);
    setRemark('details', 'validationVersion', validationVersion);
    remark.details.createdBy === undefined || remark.details.createdBy !== undefined && remark.details.createdBy === '' ? setRemark('details', 'createdBy', props.config.username) : setRemark('details', 'updatedBy', props.config.username);
    remark.details.createdAt === undefined || remark.details.createdAt !== undefined && remark.details.createdAt === '' ? setRemark('details', 'createdAt', now) : setRemark('details', 'updatedAt', now); //setReference

    setReference('sidebar', sidebar$1.details);
  };

  const onUserClick = dataKey => {
    setData();
    props.setResponseMobile(response.details, media$1.details, remark.details, principal.details, reference);

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      var component = document.querySelector(".mobile-component-div");
    } else {
      var component = document.querySelector(".component-div");
    }

    const position = sidebar$1.details.findIndex(obj => obj.dataKey === dataKey);
    setActiveComponent({
      dataKey: dataKey,
      label: sidebar$1.details[position].label,
      index: JSON.parse(JSON.stringify(sidebar$1.details[position].index)),
      position: position
    });
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    component.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const onValueChange = value => {
    setLoader({});
    setTimeout(() => {
      try {
        setReferenceHistory([]);
        setSidebarHistory([]);
        saveAnswer(props.component.dataKey, 'answer', value, form.activeComponent.position, {
          'clientMode': props.config.clientMode,
          'baseUrl': props.config.baseUrl
        }, 0);
      } catch (e) {
        console.log(e);
        toastInfo(locale.details.language[0].errorSaving + props.component.dataKey, 3000, "", "bg-pink-600/80");
        reloadDataFromHistory();
      } finally {
        setReferenceHistory([]);
        setSidebarHistory([]);
      }
    }, 50);
  };
  let handleValidation = createMemo(() => {
    const componentIndex = reference.details.findIndex(obj => obj.dataKey === props.component.dataKey);
    return reference.details[componentIndex] ? reference.details[componentIndex].validationState : 0;
  });

  const getValidationMessage = dataKey => {
    const componentIndex = reference.details.findIndex(obj => obj.dataKey === props.component.dataKey);
    return reference.details[componentIndex] ? reference.details[componentIndex].validationMessage : [];
  };

  const saveRemark = () => {
    if (tmpComment().length !== 0) {
      let commentRemark = [];
      commentRemark.push({
        sender: props.config.username,
        datetime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        comment: tmpComment()
      });
      let updatedNote = JSON.parse(JSON.stringify(note.details.notes));

      if (updatedNote.length == 0) {
        updatedNote = [...updatedNote, {
          "dataKey": flagRemark(),
          "comments": commentRemark
        }];
      } else {
        let noteIndex = updatedNote.findIndex(item => item.dataKey == flagRemark());

        if (noteIndex == -1) {
          updatedNote = [...updatedNote, {
            "dataKey": flagRemark(),
            "comments": commentRemark
          }];
        } else {
          updatedNote[noteIndex].comments.push(commentRemark[0]);
        }
      }

      let refPosition = reference.details.findIndex(obj => obj.dataKey === flagRemark());
      setReference('details', refPosition, 'hasRemark', true);
      setReference('details', refPosition, 'validationState', 0);
      setReference('details', refPosition, 'validationMessage', []);
      setNote('details', 'notes', updatedNote);
      setTmpComment('');
      setFlagRemark('');
      toastInfo(locale.details.language[0].remarkAdded, 500, "", "bg-teal-600/80");
      setData();
      props.setResponseMobile(response.details, remark.details, principal.details, reference);
    } else {
      toastInfo(locale.details.language[0].remarkEmpty, 500, "", "bg-red-700/80");
    }
  };

  const openRemark = dataKey => {
    modalRemark(dataKey);
  };

  const modalRemark = dataKey => {
    if (flagRemark() === '') {
      setFlagRemark(dataKey);
      let updatedNote = JSON.parse(JSON.stringify(note.details.notes));
      let noteIndex = updatedNote.findIndex(item => item.dataKey == dataKey);
      setComments(updatedNote[noteIndex] !== undefined ? updatedNote[noteIndex].comments : []);
    } else {
      setFlagRemark(dataKey);
    }
  };

  const getComments = dataKey => {
    let updatedNote = JSON.parse(JSON.stringify(note.details.notes));
    let noteIndex = updatedNote.findIndex(item => item.dataKey == dataKey);
    return updatedNote[noteIndex] !== undefined ? updatedNote[noteIndex].comments.length : 0;
  };

  const controlMap = props.config.clientMode === ClientMode.PAPI ? CONTROL_MAP_PAPI : CONTROL_MAP;
  return (() => {
    const _el$ = _tmpl$6$1.cloneNode(true),
      _el$19 = _el$.firstChild;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return loading();
      },

      get children() {
        return _tmpl$$4.cloneNode(true);
      }

    }), _el$19);

    insert(_el$, createComponent$1(Show, {
      get when() {
        return flagRemark() !== '';
      },

      get children() {
        const _el$3 = _tmpl$5$1.cloneNode(true),
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.firstChild,
          _el$6 = _el$5.nextSibling,
          _el$7 = _el$6.nextSibling,
          _el$8 = _el$7.firstChild;

        insert(_el$8, createComponent$1(For, {
          get each() {
            return comments();
          },

          children: (item, index) => (() => {
            const _el$20 = _tmpl$7$1.cloneNode(true),
              _el$21 = _el$20.firstChild,
              _el$22 = _el$21.nextSibling,
              _el$23 = _el$22.nextSibling;

            insert(_el$21, () => item.sender);

            insert(_el$22, () => item.datetime);

            insert(_el$23, () => item.comment);

            return _el$20;
          })()
        }));

        insert(_el$7, createComponent$1(Show, {
          get when() {
            return props.config.formMode < 3;
          },

          get children() {
            return [(() => {
              const _el$9 = _tmpl$2$1.cloneNode(true),
                _el$10 = _el$9.firstChild,
                _el$11 = _el$10.firstChild,
                _el$12 = _el$11.nextSibling,
                _el$13 = _el$12.firstChild;

              _el$13.addEventListener("change", e => {
                setTmpComment(e.currentTarget.value);
              });

              return _el$9;
            })(), (() => {
              const _el$14 = _tmpl$3$1.cloneNode(true),
                _el$15 = _el$14.firstChild,
                _el$16 = _el$15.nextSibling;

              _el$15.$$click = e => saveRemark();

              _el$16.$$click = e => modalRemark('');

              return _el$14;
            })()];
          }

        }), null);

        insert(_el$7, createComponent$1(Show, {
          get when() {
            return props.config.formMode == 3;
          },

          get children() {
            const _el$17 = _tmpl$4$1.cloneNode(true),
              _el$18 = _el$17.firstChild;

            _el$18.$$click = e => modalRemark('');

            return _el$17;
          }

        }), null);

        createRenderEffect(() => _el$8.classList.toggle("hidden", comments().length == 0));

        return _el$3;
      }

    }), _el$19);

    insert(_el$, createComponent$1(Switch, {
      get children() {
        return createComponent$1(For, {
          get each() {
            return Array.from(controlMap.keys());
          },

          children: type => createComponent$1(Match, {
            get when() {
              return memo(() => props.component.type === type, true)() && getEnable(props.component.dataKey);
            },

            get children() {
              return controlMap.get(type)({
                onMobile: props.onMobile,
                component: props.component,
                index: props.index,
                onValueChange,
                onUserClick,
                value: getValue(props.component.dataKey),
                config: props.config,
                classValidation: handleValidation(),
                comments: getComments(props.component.dataKey),
                MobileUploadHandler: props.MobileUploadHandler,
                validationMessage: getValidationMessage(props.component.dataKey),
                openRemark: openRemark,
                MobileGpsHandler: props.MobileGpsHandler,
                MobileOfflineSearch: props.MobileOfflineSearch,
                MobileOnlineSearch: props.MobileOnlineSearch,
                MobileOpenMap: props.MobileOpenMap
              });
            }

          })
        });
      }

    }), null);

    createRenderEffect(() => setAttribute(_el$19, "id", props.component.dataKey + '___scrollView'));

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$3 = /*#__PURE__*/template$1(`<div class="flex-grow bg-white dark:bg-gray-900 overflow-y-auto mb-20"><div class="space-y-3 sm:p-7 p-3"></div></div>`);

const FormComponent = props => {
  return (() => {
    const _el$ = _tmpl$$3.cloneNode(true),
      _el$2 = _el$.firstChild;

    insert(_el$2, createComponent$1(For, {
      get each() {
        return props.components;
      },

      children: (component, index) => FormInput({
        onMobile: props.onMobile,
        component,
        index: index(),
        config: props.config,
        MobileUploadHandler: props.uploadHandler,
        MobileGpsHandler: props.GpsHandler,
        MobileOfflineSearch: props.offlineSearch,
        MobileOnlineSearch: props.onlineSearch,
        MobileOpenMap: props.openMap,
        setResponseMobile: props.setResponseMobile
      })
    }));

    return _el$;
  })();
};

var timezone$1 = { exports: {} };

(function (module, exports) {
  !function (t, e) { module.exports = e(); }(commonjsGlobal, (function () { var t = { year: 0, month: 1, day: 2, hour: 3, minute: 4, second: 5 }, e = {}; return function (n, i, o) { var r, a = function (t, n, i) { void 0 === i && (i = {}); var o = new Date(t), r = function (t, n) { void 0 === n && (n = {}); var i = n.timeZoneName || "short", o = t + "|" + i, r = e[o]; return r || (r = new Intl.DateTimeFormat("en-US", { hour12: !1, timeZone: t, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: i }), e[o] = r), r }(n, i); return r.formatToParts(o) }, u = function (e, n) { for (var i = a(e, n), r = [], u = 0; u < i.length; u += 1) { var f = i[u], s = f.type, m = f.value, c = t[s]; c >= 0 && (r[c] = parseInt(m, 10)); } var d = r[3], l = 24 === d ? 0 : d, v = r[0] + "-" + r[1] + "-" + r[2] + " " + l + ":" + r[4] + ":" + r[5] + ":000", h = +e; return (o.utc(v).valueOf() - (h -= h % 1e3)) / 6e4 }, f = i.prototype; f.tz = function (t, e) { void 0 === t && (t = r); var n = this.utcOffset(), i = this.toDate(), a = i.toLocaleString("en-US", { timeZone: t }), u = Math.round((i - new Date(a)) / 1e3 / 60), f = o(a).$set("millisecond", this.$ms).utcOffset(15 * -Math.round(i.getTimezoneOffset() / 15) - u, !0); if (e) { var s = f.utcOffset(); f = f.add(n - s, "minute"); } return f.$x.$timezone = t, f }, f.offsetName = function (t) { var e = this.$x.$timezone || o.tz.guess(), n = a(this.valueOf(), e, { timeZoneName: t }).find((function (t) { return "timezonename" === t.type.toLowerCase() })); return n && n.value }; var s = f.startOf; f.startOf = function (t, e) { if (!this.$x || !this.$x.$timezone) return s.call(this, t, e); var n = o(this.format("YYYY-MM-DD HH:mm:ss:SSS")); return s.call(n, t, e).tz(this.$x.$timezone, !0) }, o.tz = function (t, e, n) { var i = n && e, a = n || e || r, f = u(+o(), a); if ("string" != typeof t) return o(t).tz(a); var s = function (t, e, n) { var i = t - 60 * e * 1e3, o = u(i, n); if (e === o) return [i, e]; var r = u(i -= 60 * (o - e) * 1e3, n); return o === r ? [i, o] : [t - 60 * Math.min(o, r) * 1e3, Math.max(o, r)] }(o.utc(t, i).valueOf(), f, a), m = s[0], c = s[1], d = o(m).utcOffset(c); return d.$x.$timezone = a, d }, o.tz.guess = function () { return Intl.DateTimeFormat().resolvedOptions().timeZone }, o.tz.setDefault = function (t) { r = t; }; } }));
}(timezone$1));

var timezone = timezone$1.exports;

var utc$1 = { exports: {} };

(function (module, exports) {
  !function (t, i) { module.exports = i(); }(commonjsGlobal, (function () { var t = "minute", i = /[+-]\d\d(?::?\d\d)?/g, e = /([+-]|\d\d)/g; return function (s, f, n) { var u = f.prototype; n.utc = function (t) { var i = { date: t, utc: !0, args: arguments }; return new f(i) }, u.utc = function (i) { var e = n(this.toDate(), { locale: this.$L, utc: !0 }); return i ? e.add(this.utcOffset(), t) : e }, u.local = function () { return n(this.toDate(), { locale: this.$L, utc: !1 }) }; var o = u.parse; u.parse = function (t) { t.utc && (this.$u = !0), this.$utils().u(t.$offset) || (this.$offset = t.$offset), o.call(this, t); }; var r = u.init; u.init = function () { if (this.$u) { var t = this.$d; this.$y = t.getUTCFullYear(), this.$M = t.getUTCMonth(), this.$D = t.getUTCDate(), this.$W = t.getUTCDay(), this.$H = t.getUTCHours(), this.$m = t.getUTCMinutes(), this.$s = t.getUTCSeconds(), this.$ms = t.getUTCMilliseconds(); } else r.call(this); }; var a = u.utcOffset; u.utcOffset = function (s, f) { var n = this.$utils().u; if (n(s)) return this.$u ? 0 : n(this.$offset) ? a.call(this) : this.$offset; if ("string" == typeof s && (s = function (t) { void 0 === t && (t = ""); var s = t.match(i); if (!s) return null; var f = ("" + s[0]).match(e) || ["-", 0, 0], n = f[0], u = 60 * +f[1] + +f[2]; return 0 === u ? 0 : "+" === n ? u : -u }(s), null === s)) return this; var u = Math.abs(s) <= 16 ? 60 * s : s, o = this; if (f) return o.$offset = u, o.$u = 0 === s, o; if (0 !== s) { var r = this.$u ? this.toDate().getTimezoneOffset() : -1 * this.utcOffset(); (o = this.local().add(u + r, t)).$offset = u, o.$x.$localOffset = r; } else o = this.utc(); return o }; var h = u.format; u.format = function (t) { var i = t || (this.$u ? "YYYY-MM-DDTHH:mm:ss[Z]" : ""); return h.call(this, i) }, u.valueOf = function () { var t = this.$utils().u(this.$offset) ? 0 : this.$offset + (this.$x.$localOffset || this.$d.getTimezoneOffset()); return this.$d.valueOf() - 6e4 * t }, u.isUTC = function () { return !!this.$u }, u.toISOString = function () { return this.toDate().toISOString() }, u.toString = function () { return this.toDate().toUTCString() }; var l = u.toDate; u.toDate = function (t) { return "s" === t && this.$offset ? n(this.format("YYYY-MM-DD HH:mm:ss:SSS")).toDate() : l.call(this) }; var c = u.diff; u.diff = function (t, i, e) { if (t && this.$u === t.$u) return c.call(this, t, i, e); var s = this.local(), f = n(t).local(); return c.call(s, f, i, e) }; } }));
}(utc$1));

var utc = utc$1.exports;

const _tmpl$$2 = /*#__PURE__*/template$1(`<div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4"><div class="sm:flex sm:items-start"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-teal-200 sm:mx-0 sm:h-10 sm:w-10 text-teal-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalDelete">Confirmation submission</h3><div class="mt-2"><p class="text-sm text-gray-500" id="contentModalDelete">Thank you for completing the survey. Please provide this final verification to complete the submission!</p></div><div class="mt-4 flex space-y-2 space-x-2 items-center justify-center md:items-end md:justify-start"><span class="rounded-lg text-3xl italic font-mono cursor-not-allowed text-slate-600 p-2 bg-gradient-to-r from-teal-500 to-teal-50 text-justify 
                                  line-through pointer-events-none select-none "></span><button class="bg-transparent text-gray-300 rounded-full focus:outline-none h-5 w-5 flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button></div><div class="mt-4 flex space-y-2 space-x-2 items-center justify-center"><input type="number" class="w-full rounded font-light px-4 py-2.5 text-sm text-gray-700 border 
                              border-solid border-gray-300 bg-white bg-clip-padding transition ease-in-out m-0 
                              focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none" placeholder=""></div></div></div></div><div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white 
                        hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm">Submit</button><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button></div></div></div></div>`),
  _tmpl$2 = /*#__PURE__*/template$1(`<div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6"><div class="sm:flex sm:items-start mt-6"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full text-yellow-400 bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 " fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalError">List Remark</h3><div class="relative overflow-auto"><div class="shadow-sm overflow-auto my-6"><table class="border-collapse table-fixed w-full text-sm"><thead class="text-sm font-semibold text-gray-600 bg-gray-50"><tr><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12">No</th><th class="p-2 whitespace-nowrap font-semibold text-left w-5/12">Field</th><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12"></th></tr></thead><tbody class="text-sm divide-y divide-gray-100 "></tbody></table></div><div class="flex justify-start items-center text-center font-light px-3 pb-3"><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Prev</button><div class="text-center px-4 text-xs"></div><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Next</button></div></div></div></div></div><div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button></div></div></div></div>`),
  _tmpl$3 = /*#__PURE__*/template$1(`<div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6"><div class="sm:flex sm:items-start mt-6"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gray-200 sm:mx-0 sm:h-10 sm:w-10 text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalError">List Blank</h3><div class="relative overflow-auto"><div class="shadow-sm overflow-auto my-6"><table class="border-collapse table-fixed w-full text-sm"><thead class="text-sm font-semibold text-gray-600 bg-gray-50"><tr><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12">No</th><th class="p-2 whitespace-nowrap font-semibold text-left w-5/12">Field</th><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12"></th></tr></thead><tbody class="text-sm divide-y divide-gray-100 "></tbody></table></div><div class="flex justify-start items-center text-center font-light px-3 pb-3"><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Prev</button><div class="text-center px-4 text-xs"></div><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Next</button></div></div></div></div></div><div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button></div></div></div></div>`),
  _tmpl$4 = /*#__PURE__*/template$1(`<div class="sm:flex sm:items-start mt-6"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-200 sm:mx-0 sm:h-10 sm:w-10 text-yellow-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalError">List Warning</h3><div class="relative overflow-auto"><div class="shadow-sm overflow-auto my-6"><table class="border-collapse table-fixed w-full text-sm"><thead class="text-sm font-semibold text-gray-600 bg-gray-50"><tr><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12">No</th><th class="p-2 whitespace-nowrap font-semibold text-left w-4/12">Field</th><th class="p-2 whitespace-nowrap font-semibold text-left w-5/12">Warning Messages</th><th class="p-2 whitespace-nowrap font-semibold text-left w-2/12"></th></tr></thead><tbody class="text-sm divide-y divide-gray-100 "></tbody></table></div><div class="flex justify-start items-center text-center font-light px-3 pb-3"><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Prev</button><div class="text-center px-4 text-xs"></div><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                    font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Next</button></div></div></div></div>`),
  _tmpl$5 = /*#__PURE__*/template$1(`<div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true"><div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"><div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div><span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span><div class="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"><div class="bg-white px-4 pt-5 pb-4 sm:p-6"><div class="sm:flex sm:items-start"><div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-200 sm:mx-0 sm:h-10 sm:w-10 text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left"><h3 class="text-lg leading-6 font-medium text-gray-900" id="titleModalError">List Error</h3><div class="relative overflow-auto"><div class="shadow-sm overflow-auto my-6"><table class="border-collapse table-fixed w-full text-sm"><thead class="text-sm font-semibold text-gray-600 bg-gray-50"><tr><th class="p-2 whitespace-nowrap font-semibold text-left w-1/12">No</th><th class="p-2 whitespace-nowrap font-semibold text-left w-4/12">Field</th><th class="p-2 whitespace-nowrap font-semibold text-left w-5/12">Error Messages</th><th class="p-2 whitespace-nowrap font-semibold text-left w-2/12"></th></tr></thead><tbody class="text-sm divide-y divide-gray-100 "></tbody></table></div><div class="flex justify-start items-center text-center font-light px-3 pb-3"><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                  font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Prev</button><div class="text-center px-4 text-xs"></div><button type="button" class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                                  font-light text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm">Next</button></div></div></div></div></div><div class="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse"><button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base 
                          font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Close</button></div></div></div></div>`),
  _tmpl$6 = /*#__PURE__*/template$1(`<div class="text-lg block px-4 py-3 text-gray-600 dark:text-white font-bold sm:text-xl"></div>`),
  _tmpl$7 = /*#__PURE__*/template$1(`<button class="bg-teal-300 dark:bg-teal-500 hover:bg-teal-200 dark:hover:bg-teal-400 text-teal-100 p-3 w-full rounded-md shadow font-medium">Submit</button>`),
  _tmpl$8 = /*#__PURE__*/template$1(`<button class="bg-red-500 hover:bg-red-400 text-teal-100 p-3 w-full rounded-md shadow font-medium">List Error</button>`),
  _tmpl$9 = /*#__PURE__*/template$1(`<div class="bg-white dark:bg-gray-900 w-72  flex-shrink-0 border-r border-gray-200 dark:border-gray-800 max-h-screen p-5 
                  sidebar-span absolute inset-y-0 left-0 transform -translate-x-full transition-transform duration-500 ease-in-out md:relative md:translate-x-0 z-10"><div class="sm:min-h-[7rem] py-3 text-gray-400 tracking-wider flex justify-between"><button type="button" class="md:hidden p-2 mobile-menu-button "><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button></div><div class="h-3/6 
                        scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-500 
                        overflow-y-scroll scrollbar-thumb-rounded-full scrollbar-track-rounded-full "><div class=""></div><div class="sticky bottom-0 bg-gradient-to-t from-white dark:from-slate-900 pt-14"></div></div><div class="h-2/6 "><div class="bg-white px-8 p-5 w-full flex flex-col dark:bg-gray-900 space-y-4 absolute bottom-0 left-0 "><div class="grid grid-cols-2 gap-y-4 sm:pb-3"><div class="h-auto text-5xl text-center sm:flex flex-col flex-coltext-white font-medium "><div class="font-light text-xs"></div></div><div class="h-auto text-5xl text-center sm:flex flex-col flex-coltext-white font-medium cursor-pointer"><div class="font-light text-xs"></div></div><div class="h-auto text-5xl text-center sm:flex flex-col flex-coltext-white font-medium cursor-pointer"><div class="font-light text-xs"></div></div><div class="h-auto text-5xl text-center sm:flex flex-col flex-coltext-white font-medium cursor-pointer"><div class="font-light text-xs"></div></div></div><div class=""></div></div></div></div>`),
  _tmpl$10 = /*#__PURE__*/template$1(`<div class="text-xs font-light text-gray-600 "> <!> &#177; <!> ms</div>`),
  _tmpl$11 = /*#__PURE__*/template$1(`<div class="flex relative flex-none min-w-full px-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-500 scrollbar-thumb-rounded-full scrollbar-track-rounded-full"><ul class="flex text-sm leading-6 text-slate-400 pt-4"></ul></div>`),
  _tmpl$12 = /*#__PURE__*/template$1(`<button class="bg-red-200 text-red-500 sm:h-10 sm:w-10 rounded-full focus:outline-none h-5 w-5 flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$13 = /*#__PURE__*/template$1(`<button class="bg-teal-200 text-teal-500 sm:h-10 sm:w-10 rounded-full focus:outline-none h-5 w-5 flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>`),
  _tmpl$14 = /*#__PURE__*/template$1(`<button class="bg-blue-700 text-white p-2 rounded-full focus:outline-none items-center h-10 w-10 hover:bg-blue-600 group inline-flex justify-center text-xs"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button>`),
  _tmpl$15 = /*#__PURE__*/template$1(`<button class="bg-red-200 text-red-500 rounded-full focus:outline-none h-8 w-8 flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$16 = /*#__PURE__*/template$1(`<button class="bg-teal-200 text-teal-500 h-8 w-8 rounded-full focus:outline-none flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>`),
  _tmpl$17 = /*#__PURE__*/template$1(`<button class="bg-blue-700 text-white p-2 rounded-full focus:outline-none items-center h-8 w-8 hover:bg-blue-600 group inline-flex justify-center text-xs"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button>`),
  _tmpl$18 = /*#__PURE__*/template$1(`<button class=" bg-teal-500 text-white p-2 rounded-full focus:outline-none items-center h-10 w-10 hover:bg-teal-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>`),
  _tmpl$19 = /*#__PURE__*/template$1(`<div class="bg-gray-200 dark:bg-[#181f30] h-screen "><div class=" overflow-hidden"><div class="bg-gray-50 dark:bg-gray-900 dark:text-white h-screen shadow-xl text-gray-600 flex overflow-hidden text-sm font-montserrat xl:rounded-xl dark:shadow-gray-800"><div class="flex-grow overflow-hidden h-full flex flex-col bg-white dark:bg-gray-900 z-0"><div class="mobile-component-div relative h-screen md:flex md:overflow-hidden 
                        scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-500 
                        overflow-y-scroll scrollbar-thumb-rounded-full scrollbar-track-rounded-full  "><div class="component-div min-h-screen flex-grow bg-white dark:bg-gray-900 z-10
                        scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-500 
                        overflow-y-scroll scrollbar-thumb-rounded-full scrollbar-track-rounded-full "><div class="sm:px-7 sm:pt-7 px-4 pt-4 flex flex-col w-full border-b border-gray-200 bg-white dark:bg-gray-900 dark:text-white dark:border-gray-800 z-10 xl:sticky"><div class="flex w-full items-center"><div class="ml-3 w-4/6 md:w-auto md:text-2xl md:text-left font-medium text-left text-base text-gray-900 dark:text-white mt-1"><div></div><div class="text-sm font-light md:text-lg text-gray-600 dark:text-gray-400"></div></div><div class="ml-auto w-1/6 md:w-auto sm:flex items-center p-2 "><button type="button" class="button-switch relative inline-flex flex-shrink-0 bg-gray-200 dark:bg-gray-700 h-6 w-11 border-2 border-transparent rounded-full cusrsor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"><span class="outer-span relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 pointer-events-none"><span class="light-switch absolute inset-0 h-full w-full flex items-center justify-center transition-opacity opacity-100 dark:opacity-0 ease-out duration-100"><svg class="bg-white h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path></svg></span><span class="dark-switch absolute inset-0 h-full w-full flex items-center justify-center transition-opacity opacity-0 dark:opacity-100 ease-in duration-200"><svg class="bg-white h-3 w-3 text-indigo-600" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.2256 2.00253C9.59172 1.94346 6.93894 2.9189 4.92893 4.92891C1.02369 8.83415 1.02369 15.1658 4.92893 19.071C8.83418 22.9763 15.1658 22.9763 19.0711 19.071C21.0811 17.061 22.0565 14.4082 21.9975 11.7743C21.9796 10.9772 21.8669 10.1818 21.6595 9.40643C21.0933 9.9488 20.5078 10.4276 19.9163 10.8425C18.5649 11.7906 17.1826 12.4053 15.9301 12.6837C14.0241 13.1072 12.7156 12.7156 12 12C11.2844 11.2844 10.8928 9.97588 11.3163 8.0699C11.5947 6.81738 12.2094 5.43511 13.1575 4.08368C13.5724 3.49221 14.0512 2.90664 14.5935 2.34046C13.8182 2.13305 13.0228 2.02041 12.2256 2.00253ZM17.6569 17.6568C18.9081 16.4056 19.6582 14.8431 19.9072 13.2186C16.3611 15.2643 12.638 15.4664 10.5858 13.4142C8.53361 11.362 8.73568 7.63895 10.7814 4.09281C9.1569 4.34184 7.59434 5.09193 6.34315 6.34313C3.21895 9.46732 3.21895 14.5326 6.34315 17.6568C9.46734 20.781 14.5327 20.781 17.6569 17.6568Z" fill="currentColor"></path></svg></span></span></button></div><div class="ml-auto w-1/6 md:w-auto sm:flex md:hidden items-center"><button type="button" class="p-4 mobile-menu-button focus:outline-none focus:bg-gray-200 dark:focus:bg-gray-800"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button></div></div><div class="flex items-center space-x-3 sm:mt-7 mt-4"></div></div><div class="grid grid-cols-6 w-full justify-end items-end bottom-4 right-0"><div class=" flex justify-center items-center space-x-10 mx-10 col-start-2 col-end-6 py-2 rounded-full bg-gray-200/80 dark:bg-gray-800/90"><button class="bg-blue-700  text-white p-2 rounded-full  focus:outline-none items-center h-10 w-10 hover:bg-blue-600 group inline-flex justify-center text-xs"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><div class="flex justify-center items-center text-center"></div></div><div class="  justify-end items-center pr-8 transition"><button class="scrolltotop-div bg-yellow-400 text-white p-2 rounded-full focus:outline-none items-center h-12 w-12 hover:bg-yellow-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button><button id="exit-btn" class="ml-1 bg-red-600 text-white p-2 rounded-full focus:outline-none items-center h-12 w-12 hover:bg-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="-170 -170 800 800" fill="currentColor">
<path fill-rule="evenodd" d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55
    c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55
    c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505
    c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55
    l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719
    c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" clip-rule="evenodd"/>
</svg></button></div></div></div><div class="grid grid-cols-6 sticky w-full justify-end bottom-4 mt-10"><div class=" flex justify-center items-center space-x-4  col-start-1 col-end-5 ml-4 mr-4 py-2 rounded-full bg-gray-200/80 dark:bg-gray-800/90"><button class="bg-blue-700  text-white p-2 rounded-full focus:outline-none items-center h-8 w-8 hover:bg-blue-600 group inline-flex justify-center text-xs"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></button><div class="flex justify-center items-center text-center text-xs"></div></div><div class=" justify-end items-center pr-2 transition"><button class="scrolltotop-div bg-yellow-400 text-white p-2 rounded-full focus:outline-none items-center h-10 w-10 hover:bg-yellow-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg></button><button id="exit-btn-sm"class="fixed bottom-16 right-5 bg-red-600 text-white p-2 rounded-full focus:outline-none items-center h-10 w-10 hover:bg-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="-170 -170 800 800" fill="currentColor">
<path fill-rule="evenodd" d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55
    c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55
    c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505
    c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55
    l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719
    c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" clip-rule="evenodd"/>
</svg></button></div><div class="flex justify-end items-center col-start-6 pr-5 transition"></div></div></div></div></div></div></div>`),
  _tmpl$20 = /*#__PURE__*/template$1(`<tr class="text-gray-600"><td class="border-b border-slate-100 p-2 align-top"><div class="text-left text-sm font-light">&nbsp;&nbsp;</div></td><td class="border-b border-slate-100 p-2 align-top"><div class="text-left text-sm font-light"></div></td><td class="border-b border-slate-100 align-top p-2"><button class="bg-transparent text-gray-500 rounded-full focus:outline-none h-5 w-5 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" stroke-width="2"><path fill-rule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clip-rule="evenodd"></path></svg></button></td></tr>`),
  _tmpl$21 = /*#__PURE__*/template$1(`<tr class="text-gray-600"><td class="border-b border-slate-100 p-2 align-top"><div class="text-left text-sm font-light">&nbsp;&nbsp;</div></td><td class="border-b border-slate-100 p-2 align-top"><div class="text-left text-sm font-light"></div></td><td class="border-b border-slate-100 align-top pb-2"></td><td class="border-b border-slate-100 align-top p-2"><button class="bg-transparent text-gray-500 rounded-full focus:outline-none h-5 w-5 hover:bg-gray-400 hover:text-white flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" stroke-width="2"><path fill-rule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clip-rule="evenodd"></path></svg></button></td></tr>`),
  _tmpl$22 = /*#__PURE__*/template$1(`<div class="grid grid-cols-12 text-sm font-light mt-1"><div class="col-span-1 flex justify-center items-start">-</div><div class="col-span-11 text-justify mr-1"></div></div>`),
  _tmpl$23 = /*#__PURE__*/template$1(`<ul class="formgear-sidebar "><li><a class="block py-2 px-4 rounded font-medium space-x-2 
                                              hover:bg-blue-700 hover:text-white" href="javascript:void(0);"><div class="font-light text-xs"><div></div></div></a></li></ul>`),
  _tmpl$24 = /*#__PURE__*/template$1(`<ul class="border-l border-gray-300 dark:border-slate-500 ml-4"><li><a class="block py-2 px-4 rounded font-medium space-x-2 
                                                      hover:bg-blue-700 hover:text-white" href="javascript:void(0);"><div class="font-light text-xs"><div></div></div></a></li></ul>`),
  _tmpl$25 = /*#__PURE__*/template$1(`<ul class="border-l border-gray-300 dark:border-slate-500 ml-4  "><li><a class="block py-2 px-4 rounded font-medium space-x-2 
                                                              hover:bg-blue-700 hover:text-white" href="javascript:void(0);"><div class="font-light text-xs"><div></div></div></a></li></ul>`),
  _tmpl$26 = /*#__PURE__*/template$1(`<ul class="border-l border-gray-300 dark:border-slate-500 ml-4"><li><a class="block py-2 px-4 rounded font-medium space-x-2 
                                                                      hover:bg-blue-700 hover:text-white" href="javascript:void(0);"><div class="font-light text-xs"><div></div></div></a></li></ul>`),
  _tmpl$27 = /*#__PURE__*/template$1(`<li class="flex-none"><a class="block py-2 mb-1.5 px-4 rounded font-medium space-x-2 
                                          hover:bg-blue-700 hover:text-white" href="javascript:void(0);"></a></li>`);

const Form = props => {

  const getConfig = () => {
    return props.config;
  };

  globalConfig(props.config);

  const getProp = config => {
    switch (config) {
      case 'clientMode':
        {
          return props.config.clientMode;
        }

      case 'baseUrl':
        {
          return props.config.baseUrl;
        }
    }
  };

  const [renderGear, setRenderGear] = createSignal('FormGear-' + gearVersion + ' 🚀:');
  const {
    setLoader,
    removeLoader
  } = useLoaderDispatch();
  createSignal(getProp(''));
  const [config, setConfig] = createSignal(getConfig());
  const [form, {
    setActiveComponent
  }] = useForm();
  const [showSubmit, setShowSubmit] = createSignal(false);
  const [captcha, setCaptcha] = createSignal('');
  const [tmpCaptcha, setTmpCaptcha] = createSignal('');
  const [docState, setDocState] = createSignal('E');
  const [showError, setShowError] = createSignal(false);
  const [showRemark, setShowRemark] = createSignal(false);
  const [showBlank, setShowBlank] = createSignal(false);
  const [listError, setListError] = createSignal([]);
  const [listErrorPage, setListErrorPage] = createSignal([]);
  const [currentErrorPage, setCurrentErrorPage] = createSignal(1);
  const [maxErrorPage, setMaxErrorPage] = createSignal(1);
  const [listWarning, setListWarning] = createSignal([]);
  const [listWarningPage, setListWarningPage] = createSignal([]);
  const [currentWarningPage, setCurrentWarningPage] = createSignal(1);
  const [maxWarningPage, setMaxWarningPage] = createSignal(1);
  const [listBlank, setListBlank] = createSignal([]);
  const [listBlankPage, setListBlankPage] = createSignal([]);
  const [currentBlankPage, setCurrentBlankPage] = createSignal(1);
  const [maxBlankPage, setMaxBlankPage] = createSignal(1);
  const [listRemark, setListRemark] = createSignal([]);
  const [listRemarkPage, setListRemarkPage] = createSignal([]);
  const [currentRemarkPage, setCurrentRemarkPage] = createSignal(1);
  const [maxRemarkPage, setMaxRemarkPage] = createSignal(1);

  if (props.template.details.language !== undefined && props.template.details.language.length > 0) {
    const keys = Object.keys(locale.details.language[0]);
    const updatedLocale = JSON.parse(JSON.stringify(locale.details.language[0]));
    keys.forEach(k => {
      if (props.template.details.language[0].hasOwnProperty(k)) {
        updatedLocale[k] = props.template.details.language[0][k];
      }
    });
    setLocale('details', 'language', [updatedLocale]);
  }

  const [components, setComponents] = createSignal([]);

  const getComponents = dataKey => {
    const componentIndex = sidebar$1.details.findIndex(obj => obj.dataKey === dataKey);
    const components = sidebar$1.details[componentIndex] !== undefined ? sidebar$1.details[componentIndex].components[0] : '';
    return components;
  };

  setActiveComponent({
    dataKey: sidebar$1.details[0].dataKey,
    label: sidebar$1.details[0].label,
    index: JSON.parse(JSON.stringify(sidebar$1.details[0].index)),
    position: 0
  });
  setComponents(getComponents(sidebar$1.details[0].dataKey));

  if (props.runAll == 0) {
    // console.time('tmpVarComp ')
    props.tmpVarComp.forEach((element, index) => {
      let sidePosition = sidebar$1.details.findIndex((obj, index) => {
        const cekInsideIndex = obj.components[0].findIndex((objChild, index) => {
          objChild.dataKey === element.dataKey;
          return index;
        });
        return cekInsideIndex == -1 ? 0 : index;
      });

      const getRowIndex = positionOffset => {
        let editedDataKey = element.dataKey.split('@');
        let splitDataKey = editedDataKey[0].split('#');
        let splLength = splitDataKey.length;
        let reducer = positionOffset + 1;
        return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
      };

      createSignal(getRowIndex(0));
      let answer = eval(element.expression);
      if (answer !== undefined) saveAnswer(element.dataKey, 'answer', answer, sidePosition, {
        'clientMode': getProp('clientMode'),
        'baseUrl': getProp('baseUrl')
      }, 0);
    }); // console.timeEnd('tmpVarComp ')
    // console.time('response ');

    props.preset.details.predata.forEach((element, index) => {
      let refPosition = referenceIndexLookup(element.dataKey);

      if (refPosition !== -1) {
        if (config().initialMode == 1 && reference.details[refPosition].presetMaster !== undefined && reference.details[refPosition].presetMaster || config().initialMode == 2) {
          let sidePosition = sidebar$1.details.findIndex(obj => {
            const cekInsideIndex = obj.components[0].findIndex(objChild => objChild.dataKey === element.dataKey);
            return cekInsideIndex == -1 ? 0 : index;
          });
          let answer = typeof element.answer === 'object' ? JSON.parse(JSON.stringify(element.answer)) : element.answer;
          saveAnswer(element.dataKey, 'answer', answer, sidePosition, {
            'clientMode': getProp('clientMode'),
            'baseUrl': getProp('baseUrl')
          }, 0);
        }
      }
    });
    props.response.details.answers.forEach((element, index) => {
      if (!element.dataKey.includes("#")) {
        let refPosition = referenceIndexLookup(element.dataKey);

        if (refPosition !== -1) {
          let sidePosition = sidebar$1.details.findIndex(obj => {
            const cekInsideIndex = obj.components[0].findIndex(objChild => objChild.dataKey === element.dataKey);
            return cekInsideIndex == -1 ? 0 : index;
          });
          let answer = typeof element.answer === 'object' ? JSON.parse(JSON.stringify(element.answer)) : element.answer;
          if (answer !== undefined) saveAnswer(element.dataKey, 'answer', answer, sidePosition, {
            'clientMode': getProp('clientMode'),
            'baseUrl': getProp('baseUrl')
          }, 0);
        }
      }
    }); // console.time('tmpEnableComp ')

    props.tmpEnableComp.forEach((element, index) => {
      let sidePosition = sidebar$1.details.findIndex((obj, index) => {
        const cekInsideIndex = obj.components[0].findIndex((objChild, index) => {
          objChild.dataKey === element.dataKey;
          return index;
        });
        return cekInsideIndex == -1 ? 0 : index;
      });

      const getRowIndex = positionOffset => {
        let editedDataKey = element.dataKey.split('@');
        let splitDataKey = editedDataKey[0].split('#');
        let splLength = splitDataKey.length;
        let reducer = positionOffset + 1;
        return splLength - reducer < 1 ? Number(splitDataKey[1]) : Number(splitDataKey[splLength - reducer]);
      };

      createSignal(getRowIndex(0));
      let evEnable = eval(element.enableCondition);
      let enable = evEnable === undefined ? false : evEnable;
      saveAnswer(element.dataKey, 'enable', enable, sidePosition, {
        'clientMode': getProp('clientMode'),
        'baseUrl': getProp('baseUrl')
      }, 0);
    });

    for (let index = 0; index < reference.details.length; index++) {
      let obj = reference.details[index];

      if (obj.index[obj.index.length - 2] === 0 && obj.level > 1) {
        continue;
      }

      if (obj.enable && obj.componentValidation !== undefined) {
        runValidation(obj.dataKey, JSON.parse(JSON.stringify(obj)), null);
      }

      if (obj.enable && obj.sourceOption !== undefined) {
        // console.log(obj.sourceOption)
        let editedSourceOption = obj.sourceOption.split('@');
        let sourceOptionObj = reference.details[referenceIndexLookup(editedSourceOption[0])];

        if (obj.answer) {
          let x = [];
          obj.answer.forEach(val => {
            sourceOptionObj.answer.forEach(op => {
              if (val.value == op.value) {
                x.push(op);
              }
            });
          });
          setReference('details', index, 'answer', x);
        }
      }
    } // console.timeEnd('tmpEnableComp ')

  } else {
    reference.details.forEach(e => {
      let remarkPosition = remark.details.notes.findIndex(obj => obj.dataKey === e.dataKey);

      if (remarkPosition !== -1) {
        let newNote = remark.details.notes[remarkPosition];
        let updatedNote = JSON.parse(JSON.stringify(note.details.notes));
        updatedNote.push(newNote);
        setNote('details', 'notes', updatedNote);
      }
    });
    setRenderGear('FormGear-' + gearVersion + ' ♻️:');
  } // uncomment when media.json implementation is ready for production
  // media.details.media.forEach( (element, index) =>{
  //   let refPosition = reference.details.findIndex(obj => obj.dataKey === element.dataKey);
  //   if (refPosition !== -1) {
  //     let sidePosition = sidebar.details.findIndex(obj => {
  //       const cekInsideIndex = obj.components[0].findIndex(objChild => objChild.dataKey === element.dataKey);
  //       return (cekInsideIndex == -1) ? 0 : index;
  //     });
  //     let answer = (typeof element.answer === 'object') ? JSON.parse(JSON.stringify(element.answer)) : element.answer;
  //     saveAnswer(element.dataKey, 'answer', answer, sidePosition, { 'clientMode': getProp('clientMode'), 'baseUrl': getProp('baseUrl') });
  //   }
  // })
  // console.log(reference.details)
  // console.timeEnd('response ');
  // console.timeEnd('');
  // loadSidebarIndexMap()


  setReferenceHistoryEnable(true);
  const [onMobile, setOnMobile] = createSignal(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

  const checkOnMobile = () => {
    window.innerWidth < 768 ? setOnMobile(true) : setOnMobile(false); // console.log(window.innerWidth)
  };

  createEffect(() => {
    setComponents(getComponents(form.activeComponent.dataKey));
    let _answer = 0;
    let _error = 0;
    let _blank = 0;
    let _clean = 0;
    reference.details.forEach((element, index) => {
      let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());

      if (enableFalse == -1 && element.type > 4 && element.enable) {
        if (element.answer !== undefined && element.answer !== '' && element.answer !== null) {
          _answer += 1;
        }

        if ((element.answer === undefined || element.answer === '' || element.type == 21 && element.answer.length == 1 || element.type == 22 && element.answer.length == 1) && !(JSON.parse(JSON.stringify(element.index[element.index.length - 2])) == 0 && element.level > 1)) {
          _blank += 1;
        }

        if (element.validationState == 2) {
          _error += 1;
        }

        if (element.answer !== undefined && element.answer !== '' && element.answer !== null && element.validationState != 1 && element.validationState != 2) {
          _clean += 1;
        }
      }
    }); //setSummary counter

    setSummary({
      answer: _answer,
      blank: _blank,
      error: _error,
      remark: note.details.notes.length,
      clean: _clean
    }); // setSummary({
    //   answer: reference.details.filter((element) => {
    //     let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());
    //     return enableFalse == -1 
    //       && (element.type > 4)
    //       && (element.enable)
    //       && (element.answer !== undefined)
    //       && (element.answer !== '')
    //       && (element.answer !== null)
    //   }).length,
    //   blank: reference.details.filter((element) => {
    //     let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());
    //     return enableFalse == -1 
    //       && (element.type > 4)
    //       && (element.enable)
    //       && ((element.answer === undefined || element.answer === '')
    //         || ((element.type == 21) && element.answer.length == 1)
    //         || ((element.type == 22) && element.answer.length == 1)
    //       )
    //       && !(JSON.parse(JSON.stringify(element.index[element.index.length - 2])) == 0
    //         && element.level > 1)
    //   }).length,
    //   error: 
    //   reference.details.filter((element) => {
    //     let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());
    //     return enableFalse == -1 && (element.type > 4 && (element.enable) && element.validationState == 2)
    //   }).length,
    //   remark: note.details.notes.length
    // });

    if (getConfig().clientMode != 2) {
      window.addEventListener('resize', checkOnMobile);
    }

    document.getElementById("FormGear-loader").classList.add('hidden');
  });

  const toggleSwitch = event => {
    document.documentElement.classList.toggle('dark');
    var button = document.querySelector(".button-switch");
    var outerSpan = document.querySelector(".outer-span");
    var lightSwitch = document.querySelector(".light-switch");
    var darkSwitch = document.querySelector(".dark-switch");
    outerSpan.classList.toggle("translate-x-5");
    button.classList.toggle("bg-gray-800");
    lightSwitch.classList.toggle("opacity-100");
    darkSwitch.classList.toggle("opacity-100");
  };

  const sidebarCollapse = event => {
    var sidebar = document.querySelector(".sidebar-span");
    sidebar.classList.toggle("-translate-x-full");
  };

  const setData = () => {
    const dataForm = [];
    const dataMedia = [];
    const dataPrincipal = [];
    setLoader({});
    setTimeout(() => setEnableFalse(), 50);
    reference.details.forEach((element, index) => {
      if (element.type > 3 && element.enable && element.answer !== undefined && element.answer !== '' && element.answer !== null) {
        let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());

        if (enableFalse == -1) {
          (element.type == 32 || element.type == 36) && dataMedia.push({
            dataKey: element.dataKey,
            name: element.name,
            answer: element.answer
          });
          dataForm.push({
            dataKey: element.dataKey,
            name: element.name,
            answer: element.answer
          }); // uncomment when media.json implementation is ready for production
          // if(element.type == 32){
          //   dataMedia.push({ dataKey: element.dataKey, answer: element.answer });
          //   dataForm.push({
          //     dataKey: element.dataKey,
          //     answer: [{
          //       value: true,
          //       type: (element.answer[0] != undefined) ? element.answer[0].type : '',
          //       label: (element.answer[0] != undefined) ? element.answer[0].label : ''
          //     }]
          //   });
          // }else if(element.type == 36 ){
          //   dataMedia.push({ dataKey: element.dataKey, answer: element.answer });
          //   dataForm.push({
          //     dataKey: element.dataKey,
          //     answer: [{
          //       value: true,
          //       type: (element.answer[0] != undefined) ? element.answer[0].type : '',
          //       signature: (element.answer[0] != undefined) ? element.answer[0].signature : ''
          //     }]
          //   });
          // }else{
          //   dataForm.push({ dataKey: element.dataKey, answer: element.answer })
          // }

          if (element.principal !== undefined) {
            dataPrincipal.push({
              dataKey: element.dataKey,
              name: element.name,
              answer: element.answer,
              principal: element.principal,
              columnName: element.columnName
            });
          }
        }
      }
    }); //setResponse

    setResponse('details', 'answers', dataForm);
    setResponse('details', 'templateDataKey', template.details.dataKey);
    setResponse('details', 'gearVersion', gearVersion);
    setResponse('details', 'templateVersion', templateVersion);
    setResponse('details', 'validationVersion', validationVersion);
    setResponse('details', 'docState', docState());
    setResponse('details', 'summary', JSON.parse(JSON.stringify(summary)));
    setResponse('details', 'counter', [JSON.parse(JSON.stringify(counter))]);
    let now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    let dt = new Date();
    let s = dt.getTimezoneOffset();
    let timeToGet = Number(s / 60 * -1);
    dayjs.extend(timezone);
    dayjs.extend(utc);
    let tz = dayjs.tz.guess();
    response.details.createdBy === undefined || response.details.createdBy !== undefined && response.details.createdBy === '' ? setResponse('details', 'createdBy', getConfig().username) : setResponse('details', 'updatedBy', getConfig().username);

    if (response.details.createdAt === undefined || response.details.createdAt !== undefined && response.details.createdAt === '') {
      setResponse('details', 'createdAt', now);
      setResponse('details', 'createdAtTimezone', tz.toString());
      setResponse('details', 'createdAtGMT', timeToGet);
    } else {
      if (response.details.createdAtTimezone === undefined || response.details.createdAtTimezone !== undefined && response.details.createdAtTimezone === '') {
        setResponse('details', 'createdAtTimezone', tz.toString());
        setResponse('details', 'createdAtGMT', timeToGet);
      }

      setResponse('details', 'updatedAt', now);
      setResponse('details', 'updatedAtTimezone', tz.toString());
      setResponse('details', 'updatedAtGMT', timeToGet);
    } //setMedia


    setMedia('details', 'media', dataMedia);
    setMedia('details', 'templateDataKey', template.details.dataKey);
    setMedia('details', 'gearVersion', gearVersion);
    setMedia('details', 'templateVersion', templateVersion);
    setMedia('details', 'validationVersion', validationVersion);
    principal.details.createdBy === undefined || principal.details.createdBy !== undefined && principal.details.createdBy === '' ? setMedia('details', 'createdBy', getConfig().username) : setMedia('details', 'updatedBy', getConfig().username);

    if (principal.details.createdAt === undefined || principal.details.createdAt !== undefined && principal.details.createdAt === '') {
      setMedia('details', 'createdAt', now);
      setMedia('details', 'createdAtTimezone', tz.toString());
      setMedia('details', 'createdAtGMT', timeToGet);
    } else {
      if (principal.details.createdAtTimezone === undefined || principal.details.createdAtTimezone !== undefined && principal.details.createdAtTimezone === '') {
        setMedia('details', 'createdAtTimezone', tz.toString());
        setMedia('details', 'createdAtGMT', timeToGet);
      }

      setMedia('details', 'updatedAt', now);
      setMedia('details', 'updatedAtTimezone', tz.toString());
      setMedia('details', 'updatedAtGMT', timeToGet);
    } //setPrincipal


    setPrincipal('details', 'principals', dataPrincipal);
    setPrincipal('details', 'templateDataKey', template.details.dataKey);
    setPrincipal('details', 'gearVersion', gearVersion);
    setPrincipal('details', 'templateVersion', templateVersion);
    setPrincipal('details', 'validationVersion', validationVersion);
    principal.details.createdBy === undefined || principal.details.createdBy !== undefined && principal.details.createdBy === '' ? setPrincipal('details', 'createdBy', getConfig().username) : setPrincipal('details', 'updatedBy', getConfig().username);

    if (principal.details.createdAt === undefined || principal.details.createdAt !== undefined && principal.details.createdAt === '') {
      setPrincipal('details', 'createdAt', now);
      setPrincipal('details', 'createdAtTimezone', tz.toString());
      setPrincipal('details', 'createdAtGMT', timeToGet);
    } else {
      if (principal.details.createdAtTimezone === undefined || principal.details.createdAtTimezone !== undefined && principal.details.createdAtTimezone === '') {
        setPrincipal('details', 'createdAtTimezone', tz.toString());
        setPrincipal('details', 'createdAtGMT', timeToGet);
      }

      setPrincipal('details', 'updatedAt', now);
      setPrincipal('details', 'updatedAtTimezone', tz.toString());
      setPrincipal('details', 'updatedAtGMT', timeToGet);
    } //setRemark


    setRemark('details', 'notes', JSON.parse(JSON.stringify(note.details.notes)));
    setRemark('details', 'templateDataKey', template.details.dataKey);
    setRemark('details', 'gearVersion', gearVersion);
    setRemark('details', 'templateVersion', templateVersion);
    setRemark('details', 'validationVersion', validationVersion);
    remark.details.createdBy === undefined || remark.details.createdBy !== undefined && remark.details.createdBy === '' ? setRemark('details', 'createdBy', getConfig().username) : setRemark('details', 'updatedBy', getConfig().username);

    if (remark.details.createdAt === undefined || remark.details.createdAt !== undefined && remark.details.createdAt === '') {
      setRemark('details', 'createdAt', now);
      setRemark('details', 'createdAtTimezone', tz.toString());
      setRemark('details', 'createdAtGMT', timeToGet);
    } else {
      if (remark.details.createdAtTimezone === undefined || remark.details.createdAtTimezone !== undefined && remark.details.createdAtTimezone === '') {
        setRemark('details', 'createdAtTimezone', tz.toString());
        setRemark('details', 'createdAtGMT', timeToGet);
      }

      setRemark('details', 'updatedAt', now);
      setRemark('details', 'updatedAtTimezone', tz.toString());
      setRemark('details', 'updatedAtGMT', timeToGet);
    } //setReference


    setReference('sidebar', sidebar$1.details);
  };

  const writeResponse = () => {
    setData();
    props.setResponseMobile(response.details, media$1.details, remark.details, principal.details, reference);
  };

  props.mobileExit(writeResponse);

  const writeSubmitResponse = () => {
    setData();
    props.setSubmitMobile(response.details, media$1.details, remark.details, principal.details, reference);
  };

  const previousPage = event => {
    writeResponse();

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || getConfig().clientMode === 2) {
      var component = document.querySelector(".mobile-component-div");
    } else {
      var component = document.querySelector(".component-div");
    }

    const sidebarPrev = sidebar$1.details.filter((obj, i) => obj.enable && i < form.activeComponent.position);
    let sidebarPrevLength = sidebarPrev.length;
    const sidebarPrevIndex = sidebar$1.details.findIndex(obj => obj.dataKey === sidebarPrev[sidebarPrevLength - 1].dataKey);
    setLoader({});
    setTimeout(() => setActiveComponent({
      dataKey: sidebarPrev[sidebarPrevLength - 1].dataKey,
      label: sidebarPrev[sidebarPrevLength - 1].label,
      index: JSON.parse(JSON.stringify(sidebarPrev[sidebarPrevLength - 1].index)),
      position: sidebarPrevIndex
    }), 50);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    component.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const nextPage = event => {
    writeResponse();

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || getConfig().clientMode === 2) {
      var component = document.querySelector(".mobile-component-div");
    } else {
      var component = document.querySelector(".component-div");
    }

    const sidebarNext = sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position);
    const sidebarNextIndex = sidebar$1.details.findIndex(obj => obj.dataKey === sidebarNext[0].dataKey);
    setLoader({});
    setTimeout(() => setActiveComponent({
      dataKey: sidebarNext[0].dataKey,
      label: sidebarNext[0].label,
      index: JSON.parse(JSON.stringify(sidebarNext[0].index)),
      position: sidebarNextIndex
    }), 50);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    component.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const [showScrollWeb, setShowScrollWeb] = createSignal(false);

  const checkScrollTopWeb = () => {
    var component = document.querySelector(".component-div");

    if (component.scrollTop > 100) {
      setShowScrollWeb(true);
    } else if (component.scrollTop <= 100) {
      setShowScrollWeb(false);
    }
  };

  const [showScrollMobile, setShowScrollMobile] = createSignal(false);

  const checkScrollTopMobile = () => {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      var component = document.querySelector(".mobile-component-div");

      if (component.scrollTop > 100) {
        setShowScrollMobile(true);
      } else if (component.scrollTop <= 100) {
        setShowScrollMobile(false);
      }
    }
  };

  const scrollToTop = event => {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      var component = document.querySelector(".mobile-component-div");
    } else {
      var component = document.querySelector(".component-div");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    component.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const showListError = event => {
    let filteredError = [];
    let filteredWarning = [];
    reference.details.forEach((element, i) => {
      let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());

      if (enableFalse == -1) {
        if (element.type > 4 && element.enable && element.validationState == 2) {
          let sidebarIndex = element.level > 1 ? element.index.slice(0, -1) : element.index.slice(0, -2);
          filteredError.push({
            label: element.label,
            message: element.validationMessage,
            sideIndex: sidebarIndex,
            dataKey: element.dataKey
          });
        }

        if (element.type > 4 && element.enable && element.validationState == 1) {
          let sidebarIndex = element.level > 1 ? element.index.slice(0, -1) : element.index.slice(0, -2);
          filteredWarning.push({
            label: element.label,
            message: element.validationMessage,
            sideIndex: sidebarIndex,
            dataKey: element.dataKey
          });
        }
      }
    });
    setListError(JSON.parse(JSON.stringify(filteredError)));
    setListWarning(JSON.parse(JSON.stringify(filteredWarning)));
    showListPage(listError().length, 3, 1, listError(), 2);
    showListPage(listWarning().length, 3, 1, listWarning(), 1);
    setShowError(true);
  };

  const showListRemark = event => {
    let remarkCollection = [];
    note.details.notes.forEach(el => {
      let lookup = reference.details.find(obj => obj.dataKey == el.dataKey);
      let sidebarIndex = lookup.level > 1 ? lookup.index.slice(0, -1) : lookup.index.slice(0, -2);
      remarkCollection.push({
        label: lookup.label,
        sideIndex: sidebarIndex,
        dataKey: lookup.dataKey
      });
    });
    setListRemark(JSON.parse(JSON.stringify(remarkCollection)));
    showListPage(listRemark().length, 3, 1, listRemark(), 4);
    setShowRemark(true);
  };

  const showListBlank = event => {
    let blankCollection = [];
    reference.details.forEach((element, i) => {
      let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === element.index.slice(0, -2).toString());

      if (enableFalse == -1) {
        if (element.type > 4 && element.enable && (element.answer === undefined || element.answer === '' || element.type == 21 && element.answer.length == 1 || element.type == 22 && element.answer.length == 1) && !(JSON.parse(JSON.stringify(element.index[element.index.length - 2])) == 0 && element.level > 1)) {
          let sidebarIndex = element.level > 1 ? element.index.slice(0, -1) : element.index.slice(0, -2);
          blankCollection.push({
            label: element.label,
            sideIndex: sidebarIndex,
            dataKey: element.dataKey
          });
        }
      }
    });
    setListBlank(JSON.parse(JSON.stringify(blankCollection)));
    showListPage(listBlank().length, 3, 1, listBlank(), 3);
    setShowBlank(true);
  };

  const showListPage = (total, shown, current, list, listType) => {
    let maxPages = Math.ceil(total / shown);
    let minSlicePages = shown * current - shown;
    let maxSlicePages = shown * current;
    let listPage = list.slice(minSlicePages, maxSlicePages);

    if (listType == 2) {
      setCurrentErrorPage(current);
      setMaxErrorPage(maxPages);
      setListErrorPage(JSON.parse(JSON.stringify(listPage)));
    } else if (listType == 1) {
      setCurrentWarningPage(current);
      setMaxWarningPage(maxPages);
      setListWarningPage(JSON.parse(JSON.stringify(listPage)));
    } else if (listType == 3) {
      setCurrentBlankPage(current);
      setMaxBlankPage(maxPages);
      setListBlankPage(JSON.parse(JSON.stringify(listPage)));
    } else if (listType == 4) {
      setCurrentRemarkPage(current);
      setMaxRemarkPage(maxPages);
      setListRemarkPage(JSON.parse(JSON.stringify(listPage)));
    }
  };

  const lookInto = (e, sidebarIndex, dataKey) => {
    const sidebarIntoIndex = sidebar$1.details.findIndex(obj => obj.index.toString() === sidebarIndex.toString());
    let sidebarInto = sidebar$1.details[sidebarIntoIndex];
    setShowError(false);
    setShowRemark(false);
    setShowBlank(false);
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse();
    setLoader({});
    setTimeout(() => setActiveComponent({
      dataKey: sidebarInto.dataKey,
      label: sidebarInto.label,
      index: JSON.parse(JSON.stringify(sidebarInto.index)),
      position: sidebarIntoIndex
    }), 50);
    var component = document.getElementById(dataKey + "___scrollView");
    component.scrollIntoView({
      behavior: "smooth"
    });
  };

  function checkDocState() {
    summary.error > 0 ? setDocState('E') : reference.details.filter(element => Number(element.validationState) === 1).length > 0 ? setDocState('W') : setDocState('C');
  }

  function createCaptcha() {
    let captchaStr = []; // const activeCaptcha = document.getElementById("captcha");

    for (let q = 0; q < 6; q++) {
      if (q % 2 == 0) {
        // captchaStr[q] = String.fromCharCode(Math.floor(Math.random() * 26 + 65));
        captchaStr[q] = Math.floor(Math.random() * 10 + 0);
      } else {
        captchaStr[q] = Math.floor(Math.random() * 10 + 0);
      }
    }

    setCaptcha(captchaStr.join("")); // activeCaptcha.innerHTML = `${theCaptcha}`;
  }

  const revalidateError = event => {
    setLoader({});
    setTimeout(() => setEnableFalse(), 50); // revalidateQ();

    if (summary.error > 0) {
      showListError();
    }
  };

  const revalidateQ = () => {
    reference.details.forEach((object, ind) => {
      let updatedRef = JSON.parse(JSON.stringify(object));
      let enableFalse = referenceEnableFalse().findIndex(obj => obj.parentIndex.toString() === updatedRef.index.slice(0, -2).toString());

      if (enableFalse == -1) {
        if (updatedRef.enable && updatedRef.required !== undefined && updatedRef.required) {
          let editedDataKey = updatedRef.dataKey.split('@');
          let newEdited = editedDataKey[0].split('#');

          if (updatedRef.level < 2 || updatedRef.level > 1 && newEdited[1] !== undefined) {
            let typeAnswer = typeof updatedRef.answer;

            if (updatedRef.answer === undefined || updatedRef.answer !== undefined && typeAnswer === 'string' && updatedRef.answer === '' || updatedRef.answer !== undefined && typeAnswer === 'number' && updatedRef.answer == 0 || updatedRef.answer !== undefined && typeAnswer === 'object' && Number(updatedRef.type) == 21 && updatedRef.answer.length < 2 || updatedRef.answer !== undefined && typeAnswer === 'object' && Number(updatedRef.type) == 22 && updatedRef.answer.length < 2 || updatedRef.answer !== undefined && typeAnswer === 'object' && updatedRef.type > 22 && updatedRef.answer.length == 0 || typeAnswer === 'object' && !isNaN(updatedRef.answer) || typeAnswer === 'number' && isNaN(updatedRef.answer) || JSON.stringify(updatedRef.answer) === '[]') {
              updatedRef.validationMessage.push(locale.details.language[0].validationRequired);
              updatedRef.validationState = 2;
            }

            setReference('details', ind, updatedRef);
          }
        } // }else{
        //   setReference('details', ind, 'enable', false);

      }
    });
  };

  const confirmSubmit = event => {
    createCaptcha();
    checkDocState();

    if (docState() === 'E') {
      toastInfo(locale.details.language[0].submitInvalid, 3000, "", "bg-pink-600/80");
    } else {
      setLoader({});
      setTimeout(() => setEnableFalse(), 50);
      revalidateQ();

      if (summary.error === 0) {
        if (docState() === 'W') {
          toastInfo(locale.details.language[0].submitWarning, 3000, "", "bg-orange-600/80");
          setShowSubmit(true);
        } else {
          setShowSubmit(true);
        }
      } else {
        toastInfo(locale.details.language[0].submitEmpty, 3000, "", "bg-pink-600/80");
      }
    }
  };

  const submitData = event => {
    if (tmpCaptcha().length !== 0 && tmpCaptcha() === captcha()) {
      writeSubmitResponse();
      setShowSubmit(false);
      toastInfo(locale.details.language[0].verificationSubmitted, 3000, "", "bg-teal-600/80");
    } else {
      toastInfo(locale.details.language[0].verificationInvalid, 3000, "", "bg-pink-600/80");
    }
  };

  let timeEnd = new Date();
  let timeDiff = timeEnd.getTime() - props.timeStart.getTime();
  return (() => {
    const _el$ = _tmpl$19.cloneNode(true),
      _el$97 = _el$.firstChild,
      _el$98 = _el$97.firstChild,
      _el$99 = _el$98.firstChild,
      _el$100 = _el$99.firstChild,
      _el$121 = _el$100.firstChild,
      _el$122 = _el$121.firstChild,
      _el$123 = _el$122.firstChild,
      _el$124 = _el$123.firstChild,
      _el$125 = _el$124.firstChild,
      _el$126 = _el$125.nextSibling,
      _el$133 = _el$124.nextSibling,
      _el$134 = _el$133.firstChild,
      _el$135 = _el$133.nextSibling,
      _el$136 = _el$135.firstChild;
    _el$123.nextSibling;
    const _el$140 = _el$122.nextSibling,
      _el$141 = _el$140.firstChild,
      _el$142 = _el$141.firstChild,
      _el$143 = _el$142.nextSibling,
      _el$147 = _el$141.nextSibling,
      _el$148 = _el$147.firstChild,
      _el$149 = _el$121.nextSibling,
      _el$150 = _el$149.firstChild,
      _el$151 = _el$150.firstChild,
      _el$152 = _el$151.nextSibling,
      _el$156 = _el$150.nextSibling,
      _el$157 = _el$156.firstChild,
      _el$158 = _el$156.nextSibling;

    insert(_el$, createComponent$1(Show, {
      get when() {
        return showSubmit();
      },

      get children() {
        const _el$2 = _tmpl$$2.cloneNode(true),
          _el$3 = _el$2.firstChild,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$4.nextSibling,
          _el$6 = _el$5.nextSibling,
          _el$7 = _el$6.firstChild,
          _el$8 = _el$7.firstChild,
          _el$9 = _el$8.firstChild,
          _el$10 = _el$9.nextSibling,
          _el$11 = _el$10.firstChild,
          _el$12 = _el$11.nextSibling,
          _el$13 = _el$12.nextSibling,
          _el$14 = _el$13.firstChild,
          _el$15 = _el$14.nextSibling,
          _el$16 = _el$13.nextSibling,
          _el$17 = _el$16.firstChild,
          _el$18 = _el$7.nextSibling,
          _el$19 = _el$18.firstChild,
          _el$20 = _el$19.nextSibling;

        _el$4.$$click = e => setShowSubmit(false);

        insert(_el$14, captcha);

        _el$15.$$click = createCaptcha;

        _el$17.addEventListener("change", e => {
          setTmpCaptcha(e.currentTarget.value);
        });

        _el$19.$$click = e => submitData();

        _el$20.$$click = e => setShowSubmit(false);

        return _el$2;
      }

    }), _el$97);

    insert(_el$, createComponent$1(Show, {
      get when() {
        return showRemark();
      },

      get children() {
        const _el$21 = _tmpl$2.cloneNode(true),
          _el$22 = _el$21.firstChild,
          _el$23 = _el$22.firstChild,
          _el$24 = _el$23.nextSibling,
          _el$25 = _el$24.nextSibling,
          _el$26 = _el$25.firstChild,
          _el$27 = _el$26.firstChild,
          _el$28 = _el$27.firstChild,
          _el$29 = _el$28.nextSibling,
          _el$30 = _el$29.firstChild,
          _el$31 = _el$30.nextSibling,
          _el$32 = _el$31.firstChild,
          _el$33 = _el$32.firstChild,
          _el$34 = _el$33.firstChild,
          _el$35 = _el$34.nextSibling,
          _el$36 = _el$32.nextSibling,
          _el$37 = _el$36.firstChild,
          _el$38 = _el$37.nextSibling,
          _el$39 = _el$38.nextSibling,
          _el$40 = _el$26.nextSibling,
          _el$41 = _el$40.firstChild;

        _el$23.$$click = e => setShowRemark(false);

        insert(_el$35, createComponent$1(For, {
          get each() {
            return listRemarkPage();
          },

          children: (item, index) => (() => {
            const _el$160 = _tmpl$20.cloneNode(true),
              _el$161 = _el$160.firstChild,
              _el$162 = _el$161.firstChild;
            _el$162.firstChild;
            const _el$164 = _el$161.nextSibling,
              _el$165 = _el$164.firstChild,
              _el$166 = _el$164.nextSibling,
              _el$167 = _el$166.firstChild;

            insert(_el$162, () => Number(index()) + 1 + (currentRemarkPage() * 3 - 3), null);

            _el$167.$$click = e => {
              lookInto(e, item.sideIndex, item.dataKey);
            };

            createRenderEffect(() => _el$165.innerHTML = item['label']);

            return _el$160;
          })()
        }));

        _el$37.$$click = e => showListPage(listRemark().length, 3, currentRemarkPage() - 1, listRemark(), 4);

        insert(_el$38, currentRemarkPage);

        _el$39.$$click = e => showListPage(listRemark().length, 3, currentRemarkPage() + 1, listRemark(), 4);

        _el$41.$$click = e => setShowRemark(false);

        createRenderEffect(_p$ => {
          const _v$ = currentRemarkPage() == 1 ? true : false,
            _v$2 = currentRemarkPage() == maxRemarkPage() ? true : false;

          _v$ !== _p$._v$ && (_el$37.disabled = _p$._v$ = _v$);
          _v$2 !== _p$._v$2 && (_el$39.disabled = _p$._v$2 = _v$2);
          return _p$;
        }, {
          _v$: undefined,
          _v$2: undefined
        });

        return _el$21;
      }

    }), _el$97);

    insert(_el$, createComponent$1(Show, {
      get when() {
        return showBlank();
      },

      get children() {
        const _el$42 = _tmpl$3.cloneNode(true),
          _el$43 = _el$42.firstChild,
          _el$44 = _el$43.firstChild,
          _el$45 = _el$44.nextSibling,
          _el$46 = _el$45.nextSibling,
          _el$47 = _el$46.firstChild,
          _el$48 = _el$47.firstChild,
          _el$49 = _el$48.firstChild,
          _el$50 = _el$49.nextSibling,
          _el$51 = _el$50.firstChild,
          _el$52 = _el$51.nextSibling,
          _el$53 = _el$52.firstChild,
          _el$54 = _el$53.firstChild,
          _el$55 = _el$54.firstChild,
          _el$56 = _el$55.nextSibling,
          _el$57 = _el$53.nextSibling,
          _el$58 = _el$57.firstChild,
          _el$59 = _el$58.nextSibling,
          _el$60 = _el$59.nextSibling,
          _el$61 = _el$47.nextSibling,
          _el$62 = _el$61.firstChild;

        _el$44.$$click = e => setShowBlank(false);

        insert(_el$56, createComponent$1(For, {
          get each() {
            return listBlankPage();
          },

          children: (item, index) => (() => {
            const _el$168 = _tmpl$20.cloneNode(true),
              _el$169 = _el$168.firstChild,
              _el$170 = _el$169.firstChild;
            _el$170.firstChild;
            const _el$172 = _el$169.nextSibling,
              _el$173 = _el$172.firstChild,
              _el$174 = _el$172.nextSibling,
              _el$175 = _el$174.firstChild;

            insert(_el$170, () => Number(index()) + 1 + (currentBlankPage() * 3 - 3), null);

            _el$175.$$click = e => {
              lookInto(e, item.sideIndex, item.dataKey);
            };

            createRenderEffect(() => _el$173.innerHTML = item['label']);

            return _el$168;
          })()
        }));

        _el$58.$$click = e => showListPage(listBlank().length, 3, currentBlankPage() - 1, listBlank(), 3);

        insert(_el$59, currentBlankPage);

        _el$60.$$click = e => showListPage(listBlank().length, 3, currentBlankPage() + 1, listBlank(), 3);

        _el$62.$$click = e => setShowBlank(false);

        createRenderEffect(_p$ => {
          const _v$3 = currentBlankPage() == 1 ? true : false,
            _v$4 = currentBlankPage() == maxBlankPage() ? true : false;

          _v$3 !== _p$._v$3 && (_el$58.disabled = _p$._v$3 = _v$3);
          _v$4 !== _p$._v$4 && (_el$60.disabled = _p$._v$4 = _v$4);
          return _p$;
        }, {
          _v$3: undefined,
          _v$4: undefined
        });

        return _el$42;
      }

    }), _el$97);

    insert(_el$, createComponent$1(Show, {
      get when() {
        return showError();
      },

      get children() {
        const _el$63 = _tmpl$5.cloneNode(true),
          _el$64 = _el$63.firstChild,
          _el$65 = _el$64.firstChild,
          _el$66 = _el$65.nextSibling,
          _el$67 = _el$66.nextSibling,
          _el$68 = _el$67.firstChild,
          _el$69 = _el$68.firstChild,
          _el$70 = _el$69.firstChild,
          _el$71 = _el$70.nextSibling,
          _el$72 = _el$71.firstChild,
          _el$73 = _el$72.nextSibling,
          _el$74 = _el$73.firstChild,
          _el$75 = _el$74.firstChild,
          _el$76 = _el$75.firstChild,
          _el$77 = _el$76.nextSibling,
          _el$78 = _el$74.nextSibling,
          _el$79 = _el$78.firstChild,
          _el$80 = _el$79.nextSibling,
          _el$81 = _el$80.nextSibling,
          _el$95 = _el$68.nextSibling,
          _el$96 = _el$95.firstChild;

        _el$65.$$click = e => setShowError(false);

        insert(_el$77, createComponent$1(For, {
          get each() {
            return listErrorPage();
          },

          children: (item, index) => (() => {
            const _el$176 = _tmpl$21.cloneNode(true),
              _el$177 = _el$176.firstChild,
              _el$178 = _el$177.firstChild;
            _el$178.firstChild;
            const _el$180 = _el$177.nextSibling,
              _el$181 = _el$180.firstChild,
              _el$182 = _el$180.nextSibling,
              _el$183 = _el$182.nextSibling,
              _el$184 = _el$183.firstChild;

            insert(_el$178, () => Number(index()) + 1 + (currentErrorPage() * 3 - 3), null);

            insert(_el$182, createComponent$1(For, {
              get each() {
                return item['message'];
              },

              children: (item_msg, index_msg) => (() => {
                const _el$185 = _tmpl$22.cloneNode(true),
                  _el$186 = _el$185.firstChild,
                  _el$187 = _el$186.nextSibling;

                insert(_el$187, item_msg);

                return _el$185;
              })()
            }));

            _el$184.$$click = e => {
              lookInto(e, item.sideIndex, item.dataKey);
            };

            createRenderEffect(() => _el$181.innerHTML = item['label']);

            return _el$176;
          })()
        }));

        _el$79.$$click = e => showListPage(listError().length, 3, currentErrorPage() - 1, listError(), 2);

        insert(_el$80, currentErrorPage);

        _el$81.$$click = e => showListPage(listError().length, 3, currentErrorPage() + 1, listError(), 2);

        insert(_el$68, createComponent$1(Show, {
          get when() {
            return listWarning().length > 0;
          },

          get children() {
            const _el$82 = _tmpl$4.cloneNode(true),
              _el$83 = _el$82.firstChild,
              _el$84 = _el$83.nextSibling,
              _el$85 = _el$84.firstChild,
              _el$86 = _el$85.nextSibling,
              _el$87 = _el$86.firstChild,
              _el$88 = _el$87.firstChild,
              _el$89 = _el$88.firstChild,
              _el$90 = _el$89.nextSibling,
              _el$91 = _el$87.nextSibling,
              _el$92 = _el$91.firstChild,
              _el$93 = _el$92.nextSibling,
              _el$94 = _el$93.nextSibling;

            insert(_el$90, createComponent$1(For, {
              get each() {
                return listWarningPage();
              },

              children: (item, index) => (() => {
                const _el$188 = _tmpl$21.cloneNode(true),
                  _el$189 = _el$188.firstChild,
                  _el$190 = _el$189.firstChild;
                _el$190.firstChild;
                const _el$192 = _el$189.nextSibling,
                  _el$193 = _el$192.firstChild,
                  _el$194 = _el$192.nextSibling,
                  _el$195 = _el$194.nextSibling,
                  _el$196 = _el$195.firstChild;

                insert(_el$190, () => Number(index()) + 1 + (currentWarningPage() * 3 - 3), null);

                insert(_el$194, createComponent$1(For, {
                  get each() {
                    return item['message'];
                  },

                  children: (item_msg, index_msg) => (() => {
                    const _el$197 = _tmpl$22.cloneNode(true),
                      _el$198 = _el$197.firstChild,
                      _el$199 = _el$198.nextSibling;

                    insert(_el$199, item_msg);

                    return _el$197;
                  })()
                }));

                _el$196.$$click = e => {
                  lookInto(e, item.sideIndex, item.dataKey);
                };

                createRenderEffect(() => _el$193.innerHTML = item['label']);

                return _el$188;
              })()
            }));

            _el$92.$$click = e => showListPage(listWarning().length, 3, currentWarningPage() - 1, listWarning(), 1);

            insert(_el$93, currentWarningPage);

            _el$94.$$click = e => showListPage(listWarning().length, 3, currentWarningPage() + 1, listWarning(), 1);

            createRenderEffect(_p$ => {
              const _v$5 = currentWarningPage() == 1 ? true : false,
                _v$6 = currentWarningPage() == maxWarningPage() ? true : false;

              _v$5 !== _p$._v$5 && (_el$92.disabled = _p$._v$5 = _v$5);
              _v$6 !== _p$._v$6 && (_el$94.disabled = _p$._v$6 = _v$6);
              return _p$;
            }, {
              _v$5: undefined,
              _v$6: undefined
            });

            return _el$82;
          }

        }), null);

        _el$96.$$click = e => setShowError(false);

        createRenderEffect(_p$ => {
          const _v$7 = currentErrorPage() == 1 ? true : false,
            _v$8 = currentErrorPage() == maxErrorPage() ? true : false;

          _v$7 !== _p$._v$7 && (_el$79.disabled = _p$._v$7 = _v$7);
          _v$8 !== _p$._v$8 && (_el$81.disabled = _p$._v$8 = _v$8);
          return _p$;
        }, {
          _v$7: undefined,
          _v$8: undefined
        });

        return _el$63;
      }

    }), _el$97);

    _el$100.addEventListener("scroll", checkScrollTopMobile);

    insert(_el$100, createComponent$1(Show, {
      get when() {
        return getProp('clientMode') != ClientMode.PAPI;
      },

      get children() {
        const _el$101 = _tmpl$9.cloneNode(true),
          _el$102 = _el$101.firstChild,
          _el$104 = _el$102.firstChild,
          _el$105 = _el$102.nextSibling,
          _el$106 = _el$105.firstChild,
          _el$107 = _el$105.nextSibling,
          _el$108 = _el$107.firstChild,
          _el$109 = _el$108.firstChild,
          _el$110 = _el$109.firstChild,
          _el$111 = _el$110.firstChild,
          _el$112 = _el$110.nextSibling,
          _el$113 = _el$112.firstChild,
          _el$114 = _el$112.nextSibling,
          _el$115 = _el$114.firstChild,
          _el$116 = _el$114.nextSibling,
          _el$117 = _el$116.firstChild,
          _el$118 = _el$109.nextSibling;

        insert(_el$102, createComponent$1(Switch, {
          get fallback() {
            return (() => {
              const _el$200 = _tmpl$6.cloneNode(true);

              createRenderEffect(() => _el$200.innerHTML = props.template.details.acronym + '<div class="text-xs font-light text-gray-600 ">🚀' + gearVersion + ' 📋' + templateVersion + ' ✔️' + validationVersion + ' </div>  ');

              return _el$200;
            })();
          },

          get children() {
            return createComponent$1(Match, {
              get when() {
                return getConfig().clientMode == 1;
              },

              get children() {
                const _el$103 = _tmpl$6.cloneNode(true);

                createRenderEffect(() => _el$103.innerHTML = props.template.details.acronym);

                return _el$103;
              }

            });
          }

        }), _el$104);

        _el$104.$$click = sidebarCollapse;

        insert(_el$106, createComponent$1(For, {
          get each() {
            return sidebar$1.details;
          },

          children: (item_0, index) => createComponent$1(Show, {
            get when() {
              return item_0.level == 0 && item_0.enable;
            },

            get children() {
              const _el$201 = _tmpl$23.cloneNode(true),
                _el$202 = _el$201.firstChild,
                _el$203 = _el$202.firstChild,
                _el$204 = _el$203.firstChild,
                _el$205 = _el$204.firstChild;

              _el$203.$$click = e => {
                var component = document.querySelector(".component-div");
                window.scrollTo({
                  top: 0,
                  behavior: "smooth"
                });
                component.scrollTo({
                  top: 0,
                  behavior: "smooth"
                });
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse();
                writeResponse();
                setLoader({});
                setTimeout(() => setActiveComponent({
                  dataKey: item_0.dataKey,
                  label: item_0.label,
                  index: JSON.parse(JSON.stringify(item_0.index)),
                  position: index()
                }), 50);
              };

              insert(_el$203, () => item_0.label, _el$204);

              insert(_el$202, createComponent$1(For, {
                get each() {
                  return sidebar$1.details;
                },

                children: (item_1, index) => createComponent$1(Show, {
                  get when() {
                    return item_1.level == 1 && item_0.index[1] == item_1.index[1] && item_1.enable;
                  },

                  get children() {
                    const _el$206 = _tmpl$24.cloneNode(true),
                      _el$207 = _el$206.firstChild,
                      _el$208 = _el$207.firstChild,
                      _el$209 = _el$208.firstChild,
                      _el$210 = _el$209.firstChild;

                    _el$208.$$click = e => {
                      var component = document.querySelector(".component-div");
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                      });
                      component.scrollTo({
                        top: 0,
                        behavior: "smooth"
                      });
                      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse();
                      writeResponse();
                      setLoader({});
                      setTimeout(() => setActiveComponent({
                        dataKey: item_1.dataKey,
                        label: item_1.label,
                        index: JSON.parse(JSON.stringify(item_1.index)),
                        position: index()
                      }), 50);
                    };

                    insert(_el$208, () => item_1.label, _el$209);

                    insert(_el$207, createComponent$1(For, {
                      get each() {
                        return sidebar$1.details;
                      },

                      children: (item_2, index) => createComponent$1(Show, {
                        get when() {
                          return item_2.level == 2 && item_0.index[1] == item_1.index[1] && item_1.index[1] == item_2.index[1] && item_1.index[3] == item_2.index[3] && item_1.index[4] == item_2.index[4] && item_2.enable;
                        },

                        get children() {
                          const _el$211 = _tmpl$25.cloneNode(true),
                            _el$212 = _el$211.firstChild,
                            _el$213 = _el$212.firstChild,
                            _el$214 = _el$213.firstChild,
                            _el$215 = _el$214.firstChild;

                          _el$213.$$click = e => {
                            var component = document.querySelector(".component-div");
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth"
                            });
                            component.scrollTo({
                              top: 0,
                              behavior: "smooth"
                            });
                            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse();
                            writeResponse();
                            setLoader({});
                            setTimeout(() => setActiveComponent({
                              dataKey: item_2.dataKey,
                              label: item_2.label,
                              index: JSON.parse(JSON.stringify(item_2.index)),
                              position: index()
                            }), 50);
                          };

                          insert(_el$213, () => item_2.label, _el$214);

                          insert(_el$212, createComponent$1(For, {
                            get each() {
                              return sidebar$1.details;
                            },

                            children: (item_3, index) => createComponent$1(Show, {
                              get when() {
                                return item_3.level == 3 && item_0.index[1] == item_1.index[1] && item_1.index[1] == item_2.index[1] && item_1.index[3] == item_2.index[3] && item_2.index[5] == item_3.index[5] && item_2.index[6] == item_3.index[6] && item_3.enable;
                              },

                              get children() {
                                const _el$216 = _tmpl$26.cloneNode(true),
                                  _el$217 = _el$216.firstChild,
                                  _el$218 = _el$217.firstChild,
                                  _el$219 = _el$218.firstChild,
                                  _el$220 = _el$219.firstChild;

                                _el$218.$$click = e => {
                                  var component = document.querySelector(".component-div");
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth"
                                  });
                                  component.scrollTo({
                                    top: 0,
                                    behavior: "smooth"
                                  });
                                  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse();
                                  writeResponse();
                                  setLoader({});
                                  setTimeout(() => setActiveComponent({
                                    dataKey: item_3.dataKey,
                                    label: item_3.label,
                                    index: JSON.parse(JSON.stringify(item_3.index)),
                                    position: index()
                                  }), 50);
                                };

                                insert(_el$218, () => item_3.label, _el$219);

                                createRenderEffect(_p$ => {
                                  const _v$37 = item_0.index[1] === form.activeComponent.index[1],
                                    _v$38 = {
                                      'bg-blue-800 text-white': item_3.dataKey === form.activeComponent.dataKey
                                    },
                                    _v$39 = item_3.description;

                                  _v$37 !== _p$._v$37 && _el$216.classList.toggle("show", _p$._v$37 = _v$37);
                                  _p$._v$38 = classList(_el$218, _v$38, _p$._v$38);
                                  _v$39 !== _p$._v$39 && (_el$220.innerHTML = _p$._v$39 = _v$39);
                                  return _p$;
                                }, {
                                  _v$37: undefined,
                                  _v$38: undefined,
                                  _v$39: undefined
                                });

                                return _el$216;
                              }

                            })
                          }), null);

                          createRenderEffect(_p$ => {
                            const _v$34 = item_0.index[1] === form.activeComponent.index[1],
                              _v$35 = {
                                'bg-blue-800 text-white': item_2.dataKey === form.activeComponent.dataKey
                              },
                              _v$36 = item_2.description;

                            _v$34 !== _p$._v$34 && _el$211.classList.toggle("show", _p$._v$34 = _v$34);
                            _p$._v$35 = classList(_el$213, _v$35, _p$._v$35);
                            _v$36 !== _p$._v$36 && (_el$215.innerHTML = _p$._v$36 = _v$36);
                            return _p$;
                          }, {
                            _v$34: undefined,
                            _v$35: undefined,
                            _v$36: undefined
                          });

                          return _el$211;
                        }

                      })
                    }), null);

                    createRenderEffect(_p$ => {
                      const _v$31 = item_0.index[1] === form.activeComponent.index[1],
                        _v$32 = {
                          'bg-blue-800 text-white': item_1.dataKey === form.activeComponent.dataKey
                        },
                        _v$33 = item_1.description;

                      _v$31 !== _p$._v$31 && _el$206.classList.toggle("show", _p$._v$31 = _v$31);
                      _p$._v$32 = classList(_el$208, _v$32, _p$._v$32);
                      _v$33 !== _p$._v$33 && (_el$210.innerHTML = _p$._v$33 = _v$33);
                      return _p$;
                    }, {
                      _v$31: undefined,
                      _v$32: undefined,
                      _v$33: undefined
                    });

                    return _el$206;
                  }

                })
              }), null);

              createRenderEffect(_p$ => {
                const _v$29 = {
                  'bg-blue-800 text-white': item_0.dataKey === form.activeComponent.dataKey
                },
                  _v$30 = item_0.description;
                _p$._v$29 = classList(_el$203, _v$29, _p$._v$29);
                _v$30 !== _p$._v$30 && (_el$205.innerHTML = _p$._v$30 = _v$30);
                return _p$;
              }, {
                _v$29: undefined,
                _v$30: undefined
              });

              return _el$201;
            }

          })
        }));

        insert(_el$110, () => summary.answer, _el$111);

        insert(_el$111, () => locale.details.language[0].summaryAnswer);

        _el$112.$$click = showListBlank;

        insert(_el$112, () => summary.blank, _el$113);

        insert(_el$113, () => locale.details.language[0].summaryBlank);

        _el$114.$$click = revalidateError;

        insert(_el$114, () => summary.error, _el$115);

        insert(_el$115, () => locale.details.language[0].summaryError);

        _el$116.$$click = showListRemark;

        insert(_el$116, () => summary.remark, _el$117);

        insert(_el$117, () => locale.details.language[0].summaryRemark);

        insert(_el$118, createComponent$1(Switch, {
          get children() {
            return [createComponent$1(Match, {
              get when() {
                return memo(() => summary.error == 0, true)() && config().formMode == 1;
              },

              get children() {
                const _el$119 = _tmpl$7.cloneNode(true);

                _el$119.$$click = confirmSubmit;
                return _el$119;
              }

            }), createComponent$1(Match, {
              get when() {
                return memo(() => summary.error > 0, true)() && config().formMode < 3;
              },

              get children() {
                const _el$120 = _tmpl$8.cloneNode(true);

                _el$120.$$click = revalidateError;
                return _el$120;
              }

            })];
          }

        }));

        return _el$101;
      }

    }), _el$121);

    _el$121.addEventListener("scroll", checkScrollTopWeb);

    insert(_el$124, createComponent$1(Switch, {
      get children() {
        return createComponent$1(Match, {
          get when() {
            return getConfig().clientMode == 2;
          },

          get children() {
            const _el$127 = _tmpl$10.cloneNode(true),
              _el$128 = _el$127.firstChild,
              _el$131 = _el$128.nextSibling,
              _el$129 = _el$131.nextSibling,
              _el$132 = _el$129.nextSibling;
            _el$132.nextSibling;

            insert(_el$127, renderGear, _el$131);

            insert(_el$127, timeDiff, _el$132);

            return _el$127;
          }

        });
      }

    }), null);

    _el$134.$$click = toggleSwitch;
    _el$136.$$click = sidebarCollapse;

    insert(_el$122, createComponent$1(Show, {
      get when() {
        return getProp('clientMode') == ClientMode.PAPI;
      },

      get children() {
        const _el$138 = _tmpl$11.cloneNode(true),
          _el$139 = _el$138.firstChild;

        insert(_el$139, createComponent$1(For, {
          get each() {
            return sidebar$1.details;
          },

          children: (item, index) => createComponent$1(Show, {
            when: true,

            get children() {
              const _el$221 = _tmpl$27.cloneNode(true),
                _el$222 = _el$221.firstChild;

              _el$222.$$click = e => {
                var component = document.querySelector(".component-div");
                window.scrollTo({
                  top: 0,
                  behavior: "smooth"
                });
                component.scrollTo({
                  top: 0,
                  behavior: "smooth"
                }); // /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && sidebarCollapse(e);

                getConfig().clientMode === ClientMode.CAPI && writeResponse();
                setLoader({});
                setTimeout(() => setActiveComponent({
                  dataKey: item.dataKey,
                  label: item.label,
                  index: JSON.parse(JSON.stringify(item.index)),
                  position: index()
                }), 50);
                refocusLastSelector();
              };

              insert(_el$222, () => item.label);

              createRenderEffect(_p$ => {
                const _v$40 = {
                  ' border-b-4 border-blue-800': item.dataKey === form.activeComponent.dataKey
                },
                  _v$41 = {
                    'bg-blue-800 text-white': item.dataKey === form.activeComponent.dataKey
                  };
                _p$._v$40 = classList(_el$221, _v$40, _p$._v$40);
                _p$._v$41 = classList(_el$222, _v$41, _p$._v$41);
                return _p$;
              }, {
                _v$40: undefined,
                _v$41: undefined
              });

              return _el$221;
            }

          })
        }));

        return _el$138;
      }

    }), null);

    insert(_el$121, createComponent$1(FormComponent, {
      get onMobile() {
        return onMobile();
      },

      get components() {
        return components();
      },

      get dataKey() {
        return form.activeComponent.dataKey;
      },

      index: [0],

      get config() {
        return getConfig();
      },

      get uploadHandler() {
        return props.uploadHandler;
      },

      get GpsHandler() {
        return props.GpsHandler;
      },

      get offlineSearch() {
        return props.offlineSearch;
      },

      get onlineSearch() {
        return props.onlineSearch;
      },

      get openMap() {
        return props.openMap;
      },

      get setResponseMobile() {
        return props.setResponseMobile;
      }

    }), _el$140);

    _el$142.$$click = previousPage;

    insert(_el$143, () => form.activeComponent.label);

    insert(_el$141, createComponent$1(Switch, {
      get children() {
        return [createComponent$1(Match, {
          get when() {
            return sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length === 0 && summary.error > 0;
          },

          get children() {
            const _el$144 = _tmpl$12.cloneNode(true);

            _el$144.$$click = showListError;
            return _el$144;
          }

        }), createComponent$1(Match, {
          get when() {
            return memo(() => !!(sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length === 0 && summary.error == 0), true)() && config().formMode == 1;
          },

          get children() {
            const _el$145 = _tmpl$13.cloneNode(true);

            _el$145.$$click = confirmSubmit;
            return _el$145;
          }

        }), createComponent$1(Match, {
          get when() {
            return sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length > 0;
          },

          get children() {
            const _el$146 = _tmpl$14.cloneNode(true);

            _el$146.$$click = nextPage;

            createRenderEffect(() => _el$146.classList.toggle("visible", sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length > 0));

            return _el$146;
          }

        })];
      }

    }), null);

    _el$148.$$click = scrollToTop;
    _el$151.$$click = previousPage;

    insert(_el$152, () => form.activeComponent.label);

    insert(_el$150, createComponent$1(Switch, {
      get children() {
        return [createComponent$1(Match, {
          get when() {
            return sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length === 0 && summary.error > 0;
          },

          get children() {
            const _el$153 = _tmpl$15.cloneNode(true);

            _el$153.$$click = showListError;
            return _el$153;
          }

        }), createComponent$1(Match, {
          get when() {
            return memo(() => !!(sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length === 0 && summary.error == 0), true)() && config().formMode == 1;
          },

          get children() {
            const _el$154 = _tmpl$16.cloneNode(true);

            _el$154.$$click = confirmSubmit;
            return _el$154;
          }

        }), createComponent$1(Match, {
          get when() {
            return sidebar$1.details.filter((obj, i) => obj.enable && i > form.activeComponent.position).length > 0;
          },

          get children() {
            const _el$155 = _tmpl$17.cloneNode(true);

            _el$155.$$click = nextPage;
            return _el$155;
          }

        })];
      }

    }), null);

    _el$157.$$click = scrollToTop;

    insert(_el$158, createComponent$1(Show, {
      get when() {
        return config().formMode < 3;
      },

      get children() {
        const _el$159 = _tmpl$18.cloneNode(true);

        _el$159.$$click = writeResponse;
        return _el$159;
      }

    }));

    createRenderEffect(_p$ => {
      const _v$9 = getConfig().clientMode !== ClientMode.PAPI,
        _v$10 = getConfig().clientMode === ClientMode.PAPI,
        _v$11 = props.template.details.title,
        _v$12 = props.template.details.description,
        _v$13 = onMobile() === false,
        _v$14 = onMobile() === true,
        _v$15 = onMobile() === false,
        _v$16 = onMobile() === true,
        _v$17 = getConfig().clientMode < ClientMode.PAPI,
        _v$18 = getConfig().clientMode == ClientMode.PAPI,
        _v$19 = sidebar$1.details.filter((obj, i) => obj.enable && i < form.activeComponent.position).length === 0,
        _v$20 = sidebar$1.details.filter((obj, i) => obj.enable && i < form.activeComponent.position).length > 0,
        _v$21 = showScrollWeb() === true,
        _v$22 = showScrollWeb() === false,
        _v$23 = onMobile() === true,
        _v$24 = onMobile() === false,
        _v$25 = sidebar$1.details.filter((obj, i) => obj.enable && i < form.activeComponent.position).length === 0,
        _v$26 = sidebar$1.details.filter((obj, i) => obj.enable && i < form.activeComponent.position).length > 0,
        _v$27 = showScrollMobile() === true,
        _v$28 = showScrollMobile() === false;

      _v$9 !== _p$._v$9 && _el$122.classList.toggle("top-0", _p$._v$9 = _v$9);
      _v$10 !== _p$._v$10 && _el$122.classList.toggle("-top-[121px]", _p$._v$10 = _v$10);
      _v$11 !== _p$._v$11 && (_el$125.innerHTML = _p$._v$11 = _v$11);
      _v$12 !== _p$._v$12 && (_el$126.innerHTML = _p$._v$12 = _v$12);
      _v$13 !== _p$._v$13 && _el$126.classList.toggle("flex", _p$._v$13 = _v$13);
      _v$14 !== _p$._v$14 && _el$126.classList.toggle("hidden", _p$._v$14 = _v$14);
      _v$15 !== _p$._v$15 && _el$140.classList.toggle("flex", _p$._v$15 = _v$15);
      _v$16 !== _p$._v$16 && _el$140.classList.toggle("hidden", _p$._v$16 = _v$16);
      _v$17 !== _p$._v$17 && _el$140.classList.toggle("sticky", _p$._v$17 = _v$17);
      _v$18 !== _p$._v$18 && _el$140.classList.toggle("absolute", _p$._v$18 = _v$18);
      _v$19 !== _p$._v$19 && _el$142.classList.toggle("hidden", _p$._v$19 = _v$19);
      _v$20 !== _p$._v$20 && _el$142.classList.toggle("visible", _p$._v$20 = _v$20);
      _v$21 !== _p$._v$21 && _el$147.classList.toggle("flex", _p$._v$21 = _v$21);
      _v$22 !== _p$._v$22 && _el$147.classList.toggle("hidden", _p$._v$22 = _v$22);
      _v$23 !== _p$._v$23 && _el$149.classList.toggle("flex", _p$._v$23 = _v$23);
      _v$24 !== _p$._v$24 && _el$149.classList.toggle("hidden", _p$._v$24 = _v$24);
      _v$25 !== _p$._v$25 && _el$151.classList.toggle("hidden", _p$._v$25 = _v$25);
      _v$26 !== _p$._v$26 && _el$151.classList.toggle("visible", _p$._v$26 = _v$26);
      _v$27 !== _p$._v$27 && _el$156.classList.toggle("flex", _p$._v$27 = _v$27);
      _v$28 !== _p$._v$28 && _el$156.classList.toggle("hidden", _p$._v$28 = _v$28);
      return _p$;
    }, {
      _v$9: undefined,
      _v$10: undefined,
      _v$11: undefined,
      _v$12: undefined,
      _v$13: undefined,
      _v$14: undefined,
      _v$15: undefined,
      _v$16: undefined,
      _v$17: undefined,
      _v$18: undefined,
      _v$19: undefined,
      _v$20: undefined,
      _v$21: undefined,
      _v$22: undefined,
      _v$23: undefined,
      _v$24: undefined,
      _v$25: undefined,
      _v$26: undefined,
      _v$27: undefined,
      _v$28: undefined
    });

    return _el$;
  })();
};

delegateEvents(["click"]);

const _tmpl$$1 = /*#__PURE__*/template$1(`<div class="backdrop-blur-sm overflow-x-hidden overflow-y-auto fixed inset-0 z-50 outline-none focus:outline-none justify-center items-center flex"><svg class="w-20 h-20 animate-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94.53 98.372"><circle cx="23.536" cy="16.331" r="8.646" style="fill:#0a77e8"></circle><circle cx="8.646" cy="36.698" r="8.646" style="fill:#0f9af0"></circle><circle cx="8.646" cy="61.867" r="8.646" style="fill:#0f9af0"></circle><circle cx="23.536" cy="82.233" r="8.646" style="fill:#13bdf7"></circle><circle cx="47.361" cy="89.726" r="8.646" style="fill:#13bdf7"></circle><circle cx="71.282" cy="82.233" r="8.646" style="fill:#18e0ff"></circle><circle cx="85.884" cy="61.867" r="8.646" style="fill:#65eaff"></circle><circle cx="85.884" cy="36.698" r="8.646" style="fill:#b2f5ff"></circle><circle cx="47.361" cy="8.646" r="8.646" style="fill:#1d4970"></circle></svg></div>`);
// import { useLoaderDispatch } from "./FormLoaderProvider";
function FormLoader(props) {
  // const { removeLoader } = useLoaderDispatch();
  let merged = mergeProps({
    type: "success",
    autoHideDuration: 70
  }, props);
  let timerRef;
  onMount(() => {
    timerRef = setTimeout(() => merged.remove(), merged.autoHideDuration);
  });
  onCleanup(() => {
    clearTimeout(timerRef);
  });
  return _tmpl$$1.cloneNode(true);
}

const _tmpl$ = /*#__PURE__*/template$1(`<div></div>`);
function Loader() {
  const {
    loader
  } = useLoaderState();
  const {
    removeLoader
  } = useLoaderDispatch();
  return (() => {
    const _el$ = _tmpl$.cloneNode(true);

    insert(_el$, () => loader.map(loader => createComponent$1(FormLoader, {
      get remove() {
        return removeLoader(loader.id);
      }

    })));

    return _el$;
  })();
}

const [nested, setNested] = createStore({
  details: []
});

var semverCompare = function cmp(a, b) {
  var pa = a.split('.');
  var pb = b.split('.');
  for (var i = 0; i < 3; i++) {
    var na = Number(pa[i]);
    var nb = Number(pb[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
};

const dataKey$3 = "";
const media = [
];
var mediaJSON = {
  dataKey: dataKey$3,
  media: media
};

const description$1 = "";
const dataKey$2 = "";
const predata = [
];
var presetJSON = {
  description: description$1,
  dataKey: dataKey$2,
  predata: predata
};

const details = [
];
const sidebar = [
];
var referenceJSON = {
  details: details,
  sidebar: sidebar
};

const dataKey$1 = "";
const notes = [
];
var remarkJSON = {
  dataKey: dataKey$1,
  notes: notes
};

const description = "";
const dataKey = "";
const answers = [
];
var responseJSON = {
  description: description,
  dataKey: dataKey,
  answers: answers
};

const gearVersion = '1.1.1';
let templateVersion = '0.0.0';
let validationVersion = '0.0.0';
function FormGear(referenceFetch, templateFetch, presetFetch, responseFetch, validationFetch, mediaFetch, remarkFetch, config, uploadHandler, GpsHandler, offlineSearch, onlineSearch, mobileExit, setResponseMobile, setSubmitMobile, openMap) {
  console.log("   _____               _____            ");
  console.log("  /  __/__  ______ _  / ___/__ ___ _____");
  console.log(" /  _// _ \\/ __/  ' \\/ (_ / -_) _ `/ __/");
  console.log("/__/  \\___/_/ /_/_/_/\\___/\\__/\\_,_/_/   %c@" + gearVersion, ' font-family:system-ui; font-weight: bold; color: #14b8a6;'); // console.log('%cform-gear@'+gearVersion, ' font-family:system-ui; font-weight: bold; color: #14b8a6;');
  // console.time('FormGear renders successfully in ');

  let timeStart = new Date();
  let stuff = {
    "reference": referenceFetch,
    "template": templateFetch,
    "preset": presetFetch,
    "response": responseFetch,
    "validation": validationFetch,
    "media": mediaFetch,
    "remark": remarkFetch
  };

  let checkJson = (json, message) => {
    if (Object.keys(json).length == 0) {
      toastInfo(message, 5000, "", "bg-pink-600/80");
    }
  };

  Object.keys(stuff).map(key => {
    checkJson(stuff[key], `Failed to fetch ${key} file`);
  });

  try {
    setTemplate({
      details: templateFetch
    });
    setValidation({
      details: validationFetch
    });
    Object.keys(presetFetch).length > 0 ? setPreset({
      details: presetFetch
    }) : setPreset({
      details: JSON.parse(JSON.stringify(presetJSON))
    });
    Object.keys(responseFetch).length > 0 ? setResponse({
      details: responseFetch
    }) : setResponse({
      details: JSON.parse(JSON.stringify(responseJSON))
    });
    Object.keys(mediaFetch).length > 0 ? setMedia({
      details: mediaFetch
    }) : setMedia({
      details: JSON.parse(JSON.stringify(mediaJSON))
    });
    Object.keys(remarkFetch).length > 0 ? setRemark({
      details: remarkFetch
    }) : setRemark({
      details: JSON.parse(JSON.stringify(remarkJSON))
    });
    Object.keys(responseFetch).length > 0 && response.details.counter !== undefined && setCounter(JSON.parse(JSON.stringify(response.details.counter[0])));
    const tmpVarComp = [];
    const tmpEnableComp = [];
    const flagArr = [];
    const refList = [];
    const sideList = [];
    const sidebarList = [];
    let referenceList = [];
    const nestedList = [];
    let len = template.details.components[0].length;
    let counterRender = counter.render;
    templateVersion = template.details.version !== undefined ? template.details.version : '0.0.1';
    validationVersion = validation.details.version !== undefined ? validation.details.version : '0.0.1';
    const gearVersionState = template.details.version == undefined ? 1 : semverCompare(gearVersion, response.details.gearVersion !== undefined ? response.details.gearVersion : '0.0.0');
    const templateVersionState = template.details.version == undefined ? 1 : semverCompare(templateVersion, response.details.templateVersion !== undefined ? response.details.templateVersion : '0.0.0');
    const validationVersionState = validation.details.version == undefined ? 1 : semverCompare(validationVersion, response.details.validationVersion !== undefined ? response.details.validationVersion : '0.0.0');
    Object.keys(referenceFetch).length > 0 ? setReference(referenceFetch) : setReference(JSON.parse(JSON.stringify(referenceJSON)));
    const sidebarLen = reference.sidebar.length;
    const referenceLen = reference.details.length; // semverCompare(a,b) 
    // If the semver string a is greater than b, return 1. 
    // If the semver string b is greater than a, return 0. 
    // If a equals b, return 0;

    let runAll = 0;

    if (gearVersionState == 0 && templateVersionState == 0 && validationVersionState == 0 && referenceLen > 0 && sidebarLen > 0) {
      console.log('Reuse reference ♻️');
      setReference(referenceFetch);
      initReferenceMap();
      setSidebar('details', referenceFetch.sidebar);
      runAll = 1;
      setCounter('render', counterRender += 1);
      render(() => createComponent$1(FormProvider, {
        get children() {
          return createComponent$1(FormLoaderProvider, {
            get children() {
              return [createComponent$1(Form, {
                config: config,
                timeStart: timeStart,
                runAll: runAll,
                tmpEnableComp: tmpEnableComp,
                tmpVarComp: tmpVarComp,
                template: template,
                preset: preset,
                response: response,
                validation: validation,
                remark: remark,
                uploadHandler: uploadHandler,
                GpsHandler: GpsHandler,
                offlineSearch: offlineSearch,
                onlineSearch: onlineSearch,
                mobileExit: mobileExit,
                setResponseMobile: setResponseMobile,
                setSubmitMobile: setSubmitMobile,
                openMap: openMap
              }), createComponent$1(Loader, {})];
            }

          });
        }

      }), document.getElementById("FormGear-root"));
    } else {
      console.log('Build reference 🚀');
      let dataKeyCollections = [];
      const nestComp = [];

      const getValue = dataKey => {
        let answer = '';

        if (referenceList.length > 0) {
          const componentIndex = referenceList.findIndex(obj => obj.dataKey === dataKey);
          if (componentIndex !== -1 && referenceList[componentIndex].answer && referenceList[componentIndex].enable) answer = referenceList[componentIndex].answer;
        }

        return answer;
      };

      const loopValidation = (element, index, parent, level) => {
        let el_len = element.length;

        for (let i = 0; i < el_len; i++) {
          let el_type = element[i].type;

          if (el_type == 2) {
            let nestMasterComp = [];
            element[i].components[0].forEach(e => {
              let vals;
              let compVal;
              let valPosition = validation.details.testFunctions.findIndex(obj => obj.dataKey === e.dataKey);

              if (valPosition !== -1) {
                vals = validation.details.testFunctions[valPosition].validations;
                compVal = validation.details.testFunctions[valPosition].componentValidation;
              }

              let nestEachComp = [];
              nestEachComp.push({
                dataKey: e.dataKey,
                label: e.label,
                hint: e.hint,
                description: e.description,
                type: e.type,
                answer: e.answer,
                index: e.index,
                level: e.level,
                options: e.options,
                typeOption: e.typeOption,
                sourceOption: e.sourceOption,
                sourceSelect: e.sourceSelect,
                components: e.components,
                rows: e.rows,
                cols: e.cols,
                sourceQuestion: e.sourceQuestion,
                urlValidation: e.urlValidation,
                currency: e.currency,
                source: e.source,
                urlPath: e.urlPath,
                parent: e.parent,
                separatorFormat: e.separatorFormat,
                isDecimal: e.isDecimal,
                maskingFormat: e.maskingFormat,
                expression: e.expression,
                componentVar: e.componentVar,
                render: e.render,
                renderType: e.renderType,
                enable: e.enable,
                enableCondition: e.enableCondition,
                componentEnable: e.componentEnable,
                enableRemark: e.enableRemark,
                client: e.client,
                titleModalDelete: e.titleModalDelete,
                contentModalDelete: e.contentModalDelete,
                validationState: e.validationState,
                validationMessage: e.validationMessage,
                validations: vals,
                componentValidation: compVal,
                rangeInput: e.rangeInput !== undefined ? e.rangeInput : undefined,
                lengthInput: e.lengthInput !== undefined ? e.lengthInput : undefined,
                principal: e.principal !== undefined ? e.principal : undefined,
                columnName: e.columnName !== undefined ? e.columnName : '',
                titleModalConfirmation: e.titleModalConfirmation,
                contentModalConfirmation: e.contentModalConfirmation,
                required: e.required,
                presetMaster: e.presetMaster !== undefined ? e.presetMaster : undefined,
                disableInput: e.disableInput !== undefined ? e.disableInput : undefined,
                decimalLength: e.decimalLength !== undefined ? e.decimalLength : undefined,
                disableInitial: e.disableInitial !== undefined ? e.disableInitial : undefined
              });
              nestMasterComp ? nestMasterComp.push(nestEachComp[0]) : nestMasterComp.splice(nestMasterComp.length, 0, nestEachComp[0]);
            });
            nestComp.push({
              dataKey: element[i].dataKey,
              description: element[i].description,
              label: element[i].label,
              sourceQuestion: element[i].sourceQuestion,
              type: el_type,
              components: [nestMasterComp]
            });
          }

          element[i].components && element[i].components.forEach((element, index) => loopValidation(element, index, parent.concat(i, 0), level + 1));
        }
      }; // template.details.components.forEach((element, index) => loopValidation(element, index, [0], 0));
      // setNested('details',nestComp)


      const [components, setComponents] = createSignal([]);

      const buildReference = (element, index) => {
        for (let j = 0; j < element.length; j++) {
          refList[j] = [];
          sideList[j] = [];
          flagArr[j] = 0;
          setTimeout(() => {
            try {
              const loopTemplate = (element, index, parent, level, sideEnable) => {
                let el_len = element.length;

                for (let i = 0; i < el_len; i++) {
                  if (element[i].type != 1 && element[i].type != 3) {
                    if (dataKeyCollections.includes(element[i].dataKey)) {
                      throw new Error('Duplicate dataKey on ' + element[i].dataKey);
                    }

                    dataKeyCollections.push(element[i].dataKey);
                  }

                  let answer = element[i].answer;
                  let el_type = element[i].type;

                  if (el_type == 21 || el_type == 22) {
                    answer = JSON.parse(JSON.stringify(answer));
                  } else if (el_type == 4 && level < 2) {
                    answer == undefined && !sideEnable && tmpVarComp.push(JSON.parse(JSON.stringify(element[i])));
                  }

                  let components;

                  if (el_type == 2) {
                    let nestPosition = nested.details.findIndex(obj => obj.dataKey === element[i].dataKey);
                    components = nestPosition !== -1 ? nested.details[nestPosition].components : element[i].components ? element[i].components : undefined;
                  } else {
                    components = element[i].components ? element[i].components : undefined;
                  }

                  if (el_type == 1 || el_type == 2 && components.length > 1) {
                    if (element[i].enableCondition !== undefined) {
                      tmpEnableComp.push(JSON.parse(JSON.stringify(element[i])));
                      sideEnable = false;
                    } else {
                      sideEnable = true;
                    }

                    let sideListLen = sideList[j].length;
                    sideList[j][sideListLen] = {
                      dataKey: element[i].dataKey,
                      name: element[i].name,
                      label: element[i].label,
                      description: element[i].description,
                      level: level,
                      index: parent.concat(i),
                      components: components,
                      sourceQuestion: element[i].sourceQuestion !== undefined ? element[i].sourceQuestion : '',
                      enable: sideEnable,
                      enableCondition: element[i].enableCondition !== undefined ? element[i].enableCondition : '',
                      componentEnable: element[i].componentEnable !== undefined ? element[i].componentEnable : []
                    };
                  }

                  if (el_type == 2) {
                    let nestedLen = nestedList.length;
                    nestedList[nestedLen] = new Array({
                      dataKey: element[i].dataKey,
                      name: element[i].name,
                      label: element[i].label,
                      description: element[i].description,
                      level: level,
                      index: parent.concat(i),
                      components: components,
                      sourceQuestion: element[i].sourceQuestion !== undefined ? element[i].sourceQuestion : '',
                      enable: sideEnable,
                      enableCondition: element[i].enableCondition !== undefined ? element[i].enableCondition : '',
                      componentEnable: element[i].componentEnable !== undefined ? element[i].componentEnable : []
                    });
                  }

                  if (el_type > 2 && element[i].enableCondition !== undefined && !sideEnable) tmpEnableComp.push(JSON.parse(JSON.stringify(element[i])));
                  let vals;
                  let compVal;
                  let valPosition = validation.details.testFunctions.findIndex(obj => obj.dataKey === element[i].dataKey);

                  if (valPosition !== -1) {
                    vals = validation.details.testFunctions[valPosition].validations;
                    compVal = validation.details.testFunctions[valPosition].componentValidation;
                  }

                  let hasRemark = false;

                  if (element[i].enableRemark === undefined || element[i].enableRemark !== undefined && element[i].enableRemark) {
                    let remarkPosition = remark.details.notes.findIndex(obj => obj.dataKey === element[i].dataKey);

                    if (remarkPosition !== -1) {
                      let newNote = remark.details.notes[remarkPosition];
                      let updatedNote = JSON.parse(JSON.stringify(note.details.notes));
                      updatedNote.push(newNote);
                      hasRemark = true;
                      setNote('details', 'notes', updatedNote);
                    }
                  }

                  let refListLen = refList[j].length;
                  refList[j][refListLen] = {
                    dataKey: element[i].dataKey,
                    name: element[i].name,
                    label: element[i].label,
                    hint: element[i].hint ? element[i].hint : '',
                    description: element[i].description !== undefined ? element[i].description : undefined,
                    type: element[i].type,
                    answer: answer,
                    index: parent.concat(i),
                    level: level,
                    options: element[i].options ? element[i].options : undefined,
                    sourceQuestion: element[i].sourceQuestion !== undefined ? element[i].sourceQuestion : undefined,
                    urlValidation: element[i].urlValidation !== undefined ? element[i].urlValidation : undefined,
                    currency: element[i].currency !== undefined ? element[i].currency : undefined,
                    source: element[i].source !== undefined ? element[i].source : undefined,
                    urlPath: element[i].path !== undefined ? element[i].path : undefined,
                    parent: element[i].parent !== undefined ? element[i].parent : undefined,
                    separatorFormat: element[i].separatorFormat !== undefined ? element[i].separatorFormat : undefined,
                    isDecimal: element[i].isDecimal !== undefined ? element[i].isDecimal : undefined,
                    maskingFormat: element[i].maskingFormat !== undefined ? element[i].maskingFormat : undefined,
                    expression: element[i].expression ? element[i].expression : undefined,
                    componentVar: element[i].componentVar ? element[i].componentVar : undefined,
                    render: element[i].render ? element[i].render : undefined,
                    renderType: element[i].renderType ? element[i].renderType : undefined,
                    enable: true,
                    enableCondition: element[i].enableCondition !== undefined ? element[i].enableCondition : '',
                    componentEnable: element[i].componentEnable !== undefined ? element[i].componentEnable : [],
                    enableRemark: element[i].enableRemark !== undefined ? element[i].enableRemark : true,
                    client: element[i].client !== undefined ? element[i].client : undefined,
                    titleModalDelete: element[i].titleModalDelete !== undefined ? element[i].titleModalDelete : undefined,
                    sourceOption: element[i].sourceOption !== undefined ? element[i].sourceOption : undefined,
                    sourceSelect: element[i].sourceSelect !== undefined ? element[i].sourceSelect : undefined,
                    typeOption: element[i].typeOption !== undefined ? element[i].typeOption : undefined,
                    contentModalDelete: element[i].contentModalDelete !== undefined ? element[i].contentModalDelete : undefined,
                    validationState: element[i].validationState !== undefined ? element[i].validationState : 0,
                    validationMessage: element[i].validationMessage !== undefined ? element[i].validationMessage : [],
                    validations: vals,
                    componentValidation: compVal,
                    hasRemark: hasRemark,
                    rows: element[i].rows !== undefined && element[i].rows[0] !== undefined ? element[i].rows : undefined,
                    cols: element[i].cols !== undefined && element[i].cols[0] !== undefined ? element[i].cols : undefined,
                    rangeInput: element[i].rangeInput !== undefined && element[i].rangeInput[0] !== undefined ? element[i].rangeInput : undefined,
                    lengthInput: element[i].lengthInput !== undefined && element[i].lengthInput[0] !== undefined ? element[i].lengthInput : undefined,
                    principal: element[i].principal !== undefined ? element[i].principal : undefined,
                    columnName: element[i].columnName !== undefined ? element[i].columnName : '',
                    titleModalConfirmation: element[i].titleModalConfirmation !== undefined ? element[i].titleModalConfirmation : undefined,
                    contentModalConfirmation: element[i].contentModalConfirmation !== undefined ? element[i].contentModalConfirmation : undefined,
                    required: element[i].required !== undefined ? element[i].required : undefined,
                    presetMaster: element[i].presetMaster !== undefined ? element[i].presetMaster : undefined,
                    disableInput: element[i].disableInput !== undefined ? element[i].disableInput : undefined,
                    decimalLength: element[i].decimalLength !== undefined ? element[i].decimalLength : undefined,
                    disableInitial: element[i].disableInitial !== undefined ? element[i].disableInitial : undefined
                  };
                  element[i].components && element[i].components.forEach(element => loopTemplate(element, refListLen, parent.concat(i, 0), level + 1, sideEnable));
                }
              };

              let hasSideEnable = false;

              if (element[j].enableCondition !== undefined) {
                tmpEnableComp.push(JSON.parse(JSON.stringify(element[j])));
                hasSideEnable = true;
              }

              sideList[j][0] = {
                dataKey: element[j].dataKey,
                name: element[j].name,
                label: element[j].label,
                description: element[j].description,
                level: 0,
                index: [0, j],
                components: element[j].components,
                sourceQuestion: element[j].sourceQuestion !== undefined ? element[j].sourceQuestion : '',
                enable: !hasSideEnable,
                enableCondition: element[j].enableCondition !== undefined ? element[j].enableCondition : '',
                componentEnable: element[j].componentEnable !== undefined ? element[j].componentEnable : []
              }; // insert section

              refList[j][0] = {
                dataKey: element[j].dataKey,
                name: element[j].name,
                label: element[j].label,
                hint: element[j].hint ? element[j].hint : '',
                description: element[j].description !== undefined ? element[j].description : undefined,
                type: element[j].type,
                index: [0, j],
                level: 0,
                options: element[j].options ? element[j].options : undefined,
                sourceQuestion: element[j].sourceQuestion !== undefined ? element[j].sourceQuestion : undefined,
                urlValidation: element[j].urlValidation !== undefined ? element[j].urlValidation : undefined,
                currency: element[j].currency !== undefined ? element[j].currency : undefined,
                source: element[j].source !== undefined ? element[j].source : undefined,
                urlPath: element[j].path !== undefined ? element[j].path : undefined,
                parent: element[j].parent !== undefined ? element[j].parent : undefined,
                separatorFormat: element[j].separatorFormat !== undefined ? element[j].separatorFormat : undefined,
                isDecimal: element[j].isDecimal !== undefined ? element[j].isDecimal : undefined,
                typeOption: element[j].typeOption !== undefined ? element[j].typeOption : undefined,
                sourceOption: element[j].sourceOption !== undefined ? element[j].sourceOption : undefined,
                maskingFormat: element[j].maskingFormat !== undefined ? element[j].maskingFormat : undefined,
                expression: element[j].expression ? element[j].expression : undefined,
                componentVar: element[j].componentVar ? element[j].componentVar : undefined,
                render: element[j].render ? element[j].render : undefined,
                renderType: element[j].renderType ? element[j].renderType : undefined,
                enable: true,
                enableCondition: element[j].enableCondition !== undefined ? element[j].enableCondition : '',
                componentEnable: element[j].componentEnable !== undefined ? element[j].componentEnable : [],
                enableRemark: element[j].enableRemark !== undefined ? element[j].enableRemark : true,
                client: element[j].client !== undefined ? element[j].client : undefined,
                titleModalDelete: element[j].titleModalDelete !== undefined ? element[j].titleModalDelete : undefined,
                contentModalDelete: element[j].contentModalDelete !== undefined ? element[j].contentModalDelete : undefined,
                validationState: element[j].validationState !== undefined ? element[j].validationState : 0,
                validationMessage: element[j].validationMessage !== undefined ? element[j].validationMessage : [],
                rows: element[j].rows !== undefined && element[j].rows[0] !== undefined ? element[j].rows : undefined,
                cols: element[j].cols !== undefined && element[j].cols[0] !== undefined ? element[j].cols : undefined,
                rangeInput: element[j].rangeInput !== undefined && element[j].rangeInput[0] !== undefined ? element[j].rangeInput : undefined,
                lengthInput: element[j].lengthInput !== undefined && element[j].lengthInput[0] !== undefined ? element[j].lengthInput : undefined,
                principal: element[j].principal !== undefined ? element[j].principal : undefined,
                columnName: element[j].columnName !== undefined ? element[j].columnName : '',
                titleModalConfirmation: element[j].titleModalConfirmation !== undefined ? element[j].titleModalConfirmation : undefined,
                contentModalConfirmation: element[j].contentModalConfirmation !== undefined ? element[j].contentModalConfirmation : undefined,
                required: element[j].required !== undefined ? element[j].required : undefined
              };
              loopTemplate(element[j].components[0], 0, [0, j, 0], 1, hasSideEnable);
              flagArr[j] = 1;
            } catch (error) {
              toastInfo(error.message, 5000, "", "bg-pink-600/80");
            }
          }, 500);
        }
      };

      template.details.components.forEach((element, index) => buildReference(element, index));
      runAll = 0;
      let sum = 0;
      const t = setInterval(() => {
        sum = 0;

        for (let a = 0; a < len; a++) {
          if (flagArr[a] == 1) sum++;
        }

        if (sum === len) {
          clearInterval(t);

          for (let x = 0; x < sideList.length; x++) {
            for (let y = 0; y < sideList[x].length; y++) {
              sidebarList.push(sideList[x][y]);
            }
          }

          for (let j = 0; j < refList.length; j++) {
            for (let k = 0; k < refList[j].length; k++) {
              referenceList.push(refList[j][k]);
            }
          }

          let arrIndex = [];
          let newData = new Object(); //mulai di loop

          function loopnested(dataKey, len, level) {
            let nestedPos = referenceList.findIndex(obj => obj.dataKey == dataKey);
            let newSetComp = [];
            let counter = 0;

            for (let x = Number(nestedPos) + 1; x <= referenceList.length; x++) {
              if (level == referenceList[x].level - 1) {
                if (referenceList[x].type > 2 && !arrIndex.includes(Number(x))) {
                  arrIndex.push(Number(x));
                  newData[Number(x)] = referenceList[x].dataKey;
                }

                newSetComp.push(referenceList[x]);
                counter++;
              }

              if (counter == len) break;
            }

            referenceList[nestedPos].components = [JSON.parse(JSON.stringify(newSetComp))];
          }

          for (let z = nestedList.length - 1; z >= 0; z--) {
            loopnested(nestedList[z][0].dataKey, Number(nestedList[z][0].components[0].length), nestedList[z][0].level);
          }

          let newIn = Object.keys(newData);
          let arrIndexLen = Object.keys(newData).length;

          for (let counter = arrIndexLen - 1; counter >= 0; counter--) {
            referenceList.splice(Number(newIn[counter]), 1);
          }

          initReferenceMap(referenceList);
          setReference('details', referenceList);
          setSidebar('details', sidebarList);
          setCounter('render', counterRender += 1);
          render(() => createComponent$1(FormProvider, {
            get children() {
              return createComponent$1(FormLoaderProvider, {
                get children() {
                  return [createComponent$1(Form, {
                    config: config,
                    timeStart: timeStart,
                    runAll: runAll,
                    tmpEnableComp: tmpEnableComp,
                    tmpVarComp: tmpVarComp,
                    template: template,
                    preset: preset,
                    response: response,
                    validation: validation,
                    remark: remark,
                    uploadHandler: uploadHandler,
                    GpsHandler: GpsHandler,
                    offlineSearch: offlineSearch,
                    onlineSearch: onlineSearch,
                    mobileExit: mobileExit,
                    setResponseMobile: setResponseMobile,
                    setSubmitMobile: setSubmitMobile,
                    openMap: openMap
                  }), createComponent$1(Loader, {})];
                }

              });
            }

          }), document.getElementById("FormGear-root"));
        }
      }, 500);
    } // console.timeEnd('FormGear renders successfully in ')

  } catch (e) {
    console.log(e);
    toastInfo("Failed to render the questionnaire", 5000, "", "bg-pink-600/80");
  }
}

export { FormGear };
