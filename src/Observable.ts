import {
    auditTime,
    debounceTime,
    distinctUntilChanged,
    filter,
    firstValueFrom,
    map,
    Observable,
    Observer,
    OperatorFunction,
    tap,
    throttleTime,
    timeout,
} from "rxjs";
import { getCurrentInstance, onUnmounted, reactive } from "vue";
import {
    looksEqual,
    Endable,
    teardown,
    getLogger,
    clearObjectProps,
} from "./utils";
const logger = getLogger("observe@", -1);
export class ObservableChainable<T = any> extends Endable {
    protected finalOb: Observable<T>;
    constructor(
        private ob: Observable<T>,
        option: any,
        private pipes: any[] = []
    ) {
        super();
        if (option instanceof Set) {
            this.clears = option;
        }
        this.finalOb = ob;
    }
    /**
     * specal key point --- lock current observable
     */
    public subscribe(observer: Partial<Observer<T>> | ((value: T) => void)) {
        return this.addEnder(this.finalOb.subscribe(observer as any));
    }
    public unwrap() {
        return this.finalOb;
    }
    protected addPipe<D = T>(...args: any[]) {
        this.pipes.push(...args);
        this.finalOb = (this.ob as any).pipe(...this.pipes);
        return this as any as ObserableVue<D>;
    }
    public tap(c: (a: T) => any) {
        return this.addPipe(tap(c));
    }
    public map<D = any>(
        d: (d: T) => D,
        filt = (v: T) => v !== null && v !== undefined && !Number.isNaN(v)
    ) {
        const pipes = [map(d)];
        filt && pipes.unshift(filter(filt) as any);
        return this.addPipe<D>(...pipes);
    }
    public clone() {
        return new ObservableChainable<T>(this.finalOb, this.clears);
    }
    public debounce(ms: number) {
        return this.addPipe(debounceTime(ms));
    }
    public audit(s: number) {
        return this.addPipe(auditTime(s));
    }
    public throttle(s: number) {
        return this.addPipe(throttleTime(s));
    }
    public filter<D = T>(c: (d: T) => boolean) {
        return this.addPipe<D>(filter(c));
    }
    public pipe<D = T>(c: OperatorFunction<T, D>) {
        return this.addPipe<D>(c);
    }
    public toPromise(t?: number) {
        return firstValueFrom(t ? this.finalOb.pipe(timeout(t)) : this.finalOb);
    }
    public ifChanged() {
        return this.addPipe(distinctUntilChanged((p, c) => looksEqual(p, c)));
    }
}

/**
 * (￣y▽￣)╭ Ohohoho..... observable -> vue 的魔术对象
 */
export class ObserableVue<T = any> extends ObservableChainable<T> {
    constructor(
        ob: Observable<T>,
        option: Set<teardown> | boolean = true,
        pipes: any[] = []
    ) {
        super(ob, option, pipes);
        if (option === true) {
            if (getCurrentInstance()) {
                onUnmounted(() => {
                    this.end();
                });
            }
        }
    }
    public ref<D = T>(container?: D, key?: keyof D, clearUnexistKey = true) {
        container =
            typeof container === "object" ? container : (reactive({}) as D);
        const cancel = this.subscribe(((v: T) => {
            if (key) {
                assignMemo(container, key, v);
            } else if (v === undefined || v === null) {
                clearObjectProps(container);
                (container as any)!.cancel = cancel;
            } else if (typeof v === "object") {
                const okeys = new Set(Object.keys(container!));
                okeys.delete("cancel");
                for (const key of Object.keys(v)) {
                    okeys.delete(key);
                    assignMemo(container, key, v[key as keyof T]);
                }
                if (clearUnexistKey) {
                    okeys.forEach((key) => delete (container as any)![key]);
                }
            } else {
                (container as any).value = v;
            }
        }) as any);
        (container as any)!.cancel = cancel;
        return container as D & { cancel(): void };
    }
    public refArr<D = T>(container?: D) {
        container = Array.isArray(container)
            ? container
            : (reactive([]) as any);
        const cancel = this.subscribe(((v: D) => {
            (container as any).splice(
                0,
                (container as any).length,
                ...(v as any)
            );
        }) as any);
        (container as any)!.cancel = cancel;
        return container! as any as D & { cancel(): void };
    }
    public clone() {
        return new ObserableVue<T>(this.finalOb, this.clears);
    }
}

function assignMemo(container: any, key: any, nv: any) {
    if (!container || container[key] === nv) return; //console.log(`skip same assign of ${key}`);
    container![key] = nv;
}
