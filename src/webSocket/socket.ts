import EventCenter, { type EventCenterType } from "./eventCenter";
import type { SocketWeboxType, heartbeatOptionsType, initHeartbeatOptionsType, initWSOptionsType } from "./socket.type";
import { WSEventsConst, heartbeatStatusEnum } from "./socket.type";

/*
 * @Author: greaclar
 * @Date: 2023-08-20
 * @Description:
 * @description: SocketWebox类，用于创建一个管理WebSocket实例的工具库
 * 
 */
export class SocketWebox<T, K> implements SocketWeboxType<T, K> {
    #EvenBus: EventCenterType | null = null;
    #WS: WebSocket | null = null;
    #abortController: AbortController | null;
    #wsOptions: initWSOptionsType
    #heartBeatOptions: heartbeatOptionsType<T> = { heartbeatStatus: heartbeatStatusEnum.cancel };
    constructor(option: initWSOptionsType, initHeartbeatOptions?: initHeartbeatOptionsType<T>) {
        if (!SocketWebox.isSupportWebSocket()) throw new Error("当前环境不存在WebSocket，初始化失败");
        this.#wsOptions = option;
        this.#EvenBus = new EventCenter();
        initHeartbeatOptions && this.initHeartbeat(initHeartbeatOptions.heartbeatMsg, initHeartbeatOptions.receivedEventName, initHeartbeatOptions.heartbeatTime, initHeartbeatOptions.retryMaxCount)
    }
    connect(): void {
        if (this.#EvenBus === null) return console.warn('当前实例已销毁，请不要再引用。');
        this.pauseHeartbeat();
        if (this.#WS !== null) {
            this.#removeWSListener();
            this.#WS.close();
            this.#WS = null;
            console.info('websocket旧实例已释放。');
        };
        this.#WS = new WebSocket(this.#wsOptions.url, this.#wsOptions.protocols);
        this.#addWSListener();
    }
    getWebSocket() {
        return this.#WS;
    }
    /**
     * 给当前的ws实例添加事件监听，添加前会将旧的实例原生事件清除，并创建新的控制器赋值给#abortController
     */
    #addWSListener(): void {
        this.#removeWSListener();
        this.#abortController = new AbortController();

        if (this.#WS) {
            const evenOptions: AddEventListenerOptions = { once: true, signal: this.#abortController.signal };
            this.#WS.addEventListener('open', this.#onOpen.bind(this), evenOptions);
            this.#WS.addEventListener('error', this.#onError.bind(this), evenOptions);
            this.#WS.addEventListener('close', this.#onClose.bind(this), evenOptions);
            this.#WS.addEventListener('message', this.#onMessage.bind(this), { signal: this.#abortController.signal });
            return;
        }
        return console.error('初始化WebSocket监听事件异常，无法获取WS实例。');
    }
    /**
     * 移除当前的ws实例的事件监听，并将#abortController设为null
     */
    #removeWSListener(): void {
        this.#abortController?.abort();
        this.#abortController = null;
    }
    /**
     * ws实例打开时的事件回调，会触发事件中心的open事件
     * @param event ws打开时的原生事件对象
     */
    #onOpen(event: Event): void {
        console.log("Connection open ...");
        this.#EvenBus?.emit(WSEventsConst.open, event);
    }
    /**
     * ws实例发生错误的回调，会触发事件中心的error事件
     * @param event ws发生错误时的事件对象
     */
    #onError(event: Event): void {
        console.log('ws error', this, event);
        this.pauseHeartbeat();
        this.#EvenBus?.emit(WSEventsConst.error, event);
    }
    /**
     * ws实例关闭的回调，会触发事件中心的close事件
     * @param event ws关闭时的事件对象
     */
    #onClose(): void {
        // new时出错（先走error），或后端断开都会走这步，
        // 如果new时，连接不上，ws原生实例是null
        // 如果是后端断开，ws原生实例存在，但readstate为3，但ws实例无法复用，即使后端正常
        console.log('ws close', this);
        this.#EvenBus?.emit(WSEventsConst.close);
    }
    /**
     * ws实例接收消息回调，会触发事件中心的receiveEventKey对应的事件
     * @param event ws实例接收到消息事件时的事件对象
     */
    #onMessage(event: MessageEvent<any>): void {
        const data = JSON.parse(event.data)
        const eventName = data[this.#wsOptions.receiveEventKey];
        console.log('receive type:', eventName, data);
        eventName && this.#EvenBus?.emit(eventName, data);
    }
    send(msg: T): void {
        if (this.#WS) {
            if (this.#WS.readyState === this.#WS.OPEN) {
                this.#WS.send(JSON.stringify(msg));
                return;
            }
            return console.warn('WS状态未打开，无法发送消息，状态码：' + this.#WS.readyState)
        }
        return console.error('WS实例不存在，无法发送消息。')
    }
    dispose(): void {
        this.#removeWSListener();
        this.pauseHeartbeat();
        this.clearEventBus();
        if (this.#WS) {
            this.#WS.close();
            this.#EvenBus = null;
            this.#WS = null;
            return;
        }
        return console.error('销毁WS实例出错，WS实例丢失。');
    }
    close():void {
        this.dispose();
    }
    initHeartbeat(heartbeatMsg: T, receivedEventName: string, heartbeatTime: number, retryMaxCount?: number): void {
        if (!this.#EvenBus) return console.warn('当前事件中心实例不存在，禁止初始化心跳检测。');
        if (arguments.length < 3 || typeof heartbeatMsg !== 'object' || typeof heartbeatTime !== 'number' || heartbeatTime <= 0) {
            console.warn('未传入合法参数，初始化心跳检测失败。');
            return;
        }
        retryMaxCount ??= 0;
        this.#heartBeatOptions.retryMaxCount = retryMaxCount > 0 ? Math.ceil(retryMaxCount) : 0;
        this.#heartBeatOptions.heartbeatMsg = heartbeatMsg;
        this.#heartBeatOptions.receivedEventName = receivedEventName;
        this.#heartBeatOptions.heartbeatTime = heartbeatTime;
        this.#heartBeatOptions.receivedEventName = receivedEventName;
        this.#heartBeatOptions.heartbeatMsg = heartbeatMsg;
        this.#heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.stop;
    }
    getHeartbeatTime() {
        return this.#heartBeatOptions.heartbeatTime;
    }
    startHeartbeat(heartbeatTime?: number, retryMaxCount?: number) {
        // 判断当前是否有ws实例
        if (this.#WS === null) return console.warn('当前WS实例不存在，无法启动心跳检测。');
        if (this.#heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.cancel) return console.warn('未定义心跳数据。');
        if (heartbeatTime && heartbeatTime > 0) this.#heartBeatOptions.heartbeatTime = heartbeatTime;
        if (retryMaxCount && retryMaxCount >= 0) this.#heartBeatOptions.retryMaxCount = retryMaxCount;
        // 停止之前的心跳，防止多次调用，同时存在多个心跳检测
        this.pauseHeartbeat();
        // 注册监听心跳响应的事件
        this.on(this.#heartBeatOptions.receivedEventName!, () => {
            this.#heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.Received;
            this.#heartBeatOptions.retryCount && (this.#heartBeatOptions.retryCount = 0); // 不为零，重置重试次数
        })
        // 延迟发送一个心跳包
        this.#sendHeartBeat();
    }
    /**
     * 如果当前#WS不为null，且状态不为打开状态，则报警告，并停止执行
     * 否则，启动定时器来发送一个心跳包，并调用waitHeartBeatAnswer()
     */
    #sendHeartBeat() {
        if (this.#WS !== null && this.#WS.readyState !== this.#WS.OPEN) {
            return console.warn('心跳检测中断，ws未开启');
        }
        this.#heartBeatOptions.heartbeatTimmer = setTimeout(() => {
            /* // for test
            console.log('发送心跳包',this.heartBeatOptions.heartbeatTimmer);
            (this.heartBeatOptions.heartbeatMsg as any).msg = this.heartBeatOptions.heartbeatTimmer
            // for test */
            this.send(this.#heartBeatOptions.heartbeatMsg!);
            this.#heartBeatOptions.waitTimmer = this.#waitHeartBeatAnswer()
        }, this.#heartBeatOptions.heartbeatTime)
    }
    /**
     * TODO：多加一个字段，记录连续超时次数。超时后，在指定次数内从发心跳包。并且响应包接收事件记录。新增offline事件，如果重试次数是一，直接触发offline
     * 将当前心跳状态改为等待心跳包响应中，同时生成一个定时器，定时任务会判断心跳状态是否被修改为已接收，是则重新调用sendHeartBeat
     * 否则走超时，超时次数加一，如果超时次数未达最大允许次数，则重新调用sendHeartBeat。否则派发超时事件，将状态改为超时，停止调用sendHeartBeat
     * @returns 等待心跳响应的定时器
     */
    #waitHeartBeatAnswer() {
        this.#heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.waiting;
        // 在回调里查看心跳接收事件有没有被触发
        return setTimeout(() => {
            if (this.#heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.Received) {
                // 重新发起一个心跳包
                this.#sendHeartBeat();
                return;
            }
            // 超时
            this.#heartBeatOptions.retryCount!++;
            console.warn('心跳超时，延迟次数：', this.#heartBeatOptions.retryCount);
            if (this.#heartBeatOptions.retryCount! <= this.#heartBeatOptions.retryMaxCount!) {
                console.log('重发');
                return this.#sendHeartBeat();
            }
            // 标记心跳检测结果
            this.#heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.overtime;
            // 触发heartbeatOvertime事件
            this.#EvenBus?.emit(WSEventsConst.heartbeatOvertime);
        }, this.#heartBeatOptions.heartbeatTime)
    }
    pauseHeartbeat(): void {
        // 已经初始化心跳检测数据
        clearTimeout(this.#heartBeatOptions.heartbeatTimmer);
        clearTimeout(this.#heartBeatOptions.waitTimmer);
        this.#heartBeatOptions.receivedEventName && this.#EvenBus?.off(this.#heartBeatOptions.receivedEventName);

        if (this.#heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.cancel) return;
        // 如果状态不为未设置心跳，则把状态改为停止
        this.#heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.stop;
        // 重置重连次数
        this.#heartBeatOptions.retryCount = 0; 
    }
    cancelHeartbeat(): void {
        // 停止心跳包发送
        this.pauseHeartbeat();
        // 重置心跳数据
        this.#heartBeatOptions = null as any;
        this.#heartBeatOptions = {
            heartbeatStatus: heartbeatStatusEnum.cancel
        }
    }
    on(eventName: string, callback: Function) {
        this.#EvenBus?.on(eventName, callback);
    }
    once(eventName: string, callback: Function) {
        this.#EvenBus?.once(eventName, callback);
    }
    off(eventName: string, callback?: Function) {
        // 限制外部不能取消内部注册的监听后端心跳响应的事件
        if (eventName === this.#heartBeatOptions.receivedEventName!) return console.log('外部不能手动取消心跳包接收回调，请直接取消心跳检测。');
        this.#EvenBus?.off(eventName, callback);
    }
    clearEventBus() {
        // 停止心跳包发送，心跳包响应包接收事件需要eventbus来触发
        this.pauseHeartbeat(); 
        this.#EvenBus?.clear();
    }
    static isSupportWebSocket() {
        return Reflect.has(window, 'WebSocket')
    }
}

/**
 * 创建一个SocketWebox实例的工厂函数
 * @param option 初始化连接相关的参数
 * @param initHeartbeatOptions 初始心跳检测相关的参数
 * @returns SocketWebox实例对象，如果浏览器不兼容返回null
 */
export default function initSocketWebox<K = any, T = K>(option: initWSOptionsType, initHeartbeatOptions?: initHeartbeatOptionsType<K>): SocketWeboxType<K, T> | null {
    if (!SocketWebox.isSupportWebSocket()) {
        console.log('当前浏览器不支持WebSocket');
        return null;
    }
    const SocketWeboxInstance = new SocketWebox<K, T>(option, initHeartbeatOptions);
    return SocketWeboxInstance;
}
