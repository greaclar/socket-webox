export type EventCenterType = {
    /**
     * 往事件回调列表中添加回调函数，如果还没注册，会注册先该事件再添加
     * @param eventName 要注册的事件名
     * @param callback 该事件对应的回调函数
     */
    on(eventName: string, callback: Function): void;
    /**
     * 给事件添加回调，并且调用一次后自动移除
     * @param eventName 要触发的事件名
     * @param callback 事件回调
     */
    once(eventName: string, callback: Function): void;
    /**
     * 触发已注册事件
     * @param eventName 要触发的已注册事件名
     * @param args 事件所有回调可以接收的参数
     */
    emit(eventName: string, ...args: any[]): void;
    /**
     * 只传递了事件名，则解除所有事件回调
     * @param eventName 要从事件bug中移除的事件名，
     */
    off(eventName: string): void;
    /**
     * 传递了事件名和回调，只解除事件对应的回调
     * @param eventName 要从事件bus中移除某个回调的事件名
     * @param callback 要移除的回调
     */
    off(eventName: string, callback?: Function): void;
    /**
     * 清空所有事件
     */
    clear(): void;
}

export default class EventCenter implements EventCenterType {
    evenMap: Map<string, Set<Function>>;
    constructor() {
        this.evenMap = new Map()
    }
    on(eventName: string, callback: Function) {
        if (!this.evenMap.has(eventName)) {
            this.evenMap.set(eventName, new Set())
        }
        this.evenMap.get(eventName)!.add(callback)
    }
    once(eventName: string, callback: Function): void {
        let onceCallback: Function | null = (...args: any[]) => {
            callback.apply(null, args);
            this.off(eventName, onceCallback!);
            onceCallback = null;
        }
        this.on(eventName, onceCallback);
    }
    emit( eventName: string, ...args: any[]): void {
        if (!this.evenMap.has(eventName)) {
            console.warn('emit fail, can`t find: ' + eventName, this.evenMap);
            return;
        }
        
        this.evenMap.get(eventName)?.forEach(callback => {
            callback.apply(null, args)
        })
    }
    off(eventName: string, callback?: Function): void {
        if (!this.evenMap.has(eventName)) {
            return console.warn('off fail, can`t find: ' + eventName);
        }

        const eventCallbackList = this.evenMap.get(eventName)!;
        if (callback !== undefined) {
            eventCallbackList!.delete(callback);
            if (eventCallbackList!.size === 0) {
                this.evenMap.delete(eventName);
            }
            return;
        }
        this.evenMap.delete(eventName);
    }
    clear(): void {
        this.evenMap.clear();
    }
}