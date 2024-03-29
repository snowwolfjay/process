export type teardown =
  | Function
  | DestroyableTearDown
  | StopableTearDown
  | UnsubaleTearDown;

interface DestroyableTearDown {
  destroy(): void;
}
interface StopableTearDown {
  stop(): void;
}
interface UnsubaleTearDown {
  unsubscribe(): void;
}
const voidFun = () => { };
export class Endable {
  protected clears = new Set<teardown>();
  constructor() { }
  public track(fun: (() => (teardown | void))) {
    let t: any;
    if (typeof fun === "function") {
      t = fun()
    } else {
      t = fun
    }
    return this.addEnder(t)
  }
  public addEnder(ender: teardown) {
    if (!ender) return voidFun;
    this.clears.add(ender);
    return () => {
      this.clears.delete(ender);
    };
  }
  public end(reason?:string) {
    this.clears.forEach((el: any) => {
      this.exeEnder(el,reason);
    });
    this.clears.clear();
  }
  protected exeEnder(el: any,reason?:string) {
    console.info(`end a func ${el?.name || el?.constructor?.name} - ${reason?reason:''}`);
    this.clears.delete(el);
    if (typeof el === "function") this.safeExec(el);
    else if (typeof el.stop === "function") this.safeExec(el.stop.bind(el));
    else if (typeof el.destroy === "function")
      this.safeExec(el.destroy.bind(el));
    else if (typeof el.unsubscribe === "function")
      this.safeExec(el.unsubscribe.bind(el));
  }
  public safeExec(c: any) {
    if (typeof c === "function") {
      try {
        return c();
      } catch (error) { }
    }
  }
}
