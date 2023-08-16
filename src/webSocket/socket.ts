import EventCenter, { type EventCenterType } from "./eventCenter";
import type { SocketWeboxType, heartBeatOptionsType, initHeartbeatOptionsType, initWSOptionsType } from "./socket.type";
import { WSEventsConst, heartbeatStatusEnum, errorKindEnum } from "./socket.type";

export class SocketWebox<T, K> implements SocketWeboxType<T, K> {
    EvenBus: EventCenterType | null = null;
    WS: WebSocket | null = null;
    abortController: AbortController | null;
    wsOptions: initWSOptionsType
    heartBeatOptions: heartBeatOptionsType<T> = { heartbeatStatus: heartbeatStatusEnum.cancel };
    constructor(option: initWSOptionsType, initHeartbeatOptions?: initHeartbeatOptionsType<T>) {
        this.wsOptions = option;
        this.EvenBus = new EventCenter();
        initHeartbeatOptions && this.initHeartbeat(initHeartbeatOptions.heartbeatMsg, initHeartbeatOptions.receivedEventName, initHeartbeatOptions.heartbeatTime, initHeartbeatOptions.retryMaxCount)
    }
    connect(): void {
        if (this.WS !== null) return console.warn('websocket 实例已经存在。');
        this.pauseHeartbeat();
        if (Reflect.has(window, 'WebSocket')) {
            this.WS = new WebSocket(this.wsOptions.url, this.wsOptions.protocols);
            this.addWSListener();
            return;
        }
        // 派发事件
        this.onError(new Error("WebSocket is not supported by this browser."), errorKindEnum.browser);
        this.onClose(); // 与原生事件一致，原生事件error触发后，接着触发close事件
    }
    addWSListener(): void {
        this.removeWSListener();
        this.abortController = new AbortController();

        if (this.WS) {
            const evenOptions: AddEventListenerOptions = { once: true, signal: this.abortController.signal };
            this.WS.addEventListener('open', this.onOpen.bind(this), evenOptions);
            this.WS.addEventListener('error', this.onError.bind(this), evenOptions);
            this.WS.addEventListener('close', this.onClose.bind(this), evenOptions);
            this.WS.addEventListener('message', this.onMessage.bind(this), { signal: this.abortController.signal });
            return;
        }
        return console.error('初始化WebSocket监听事件异常，无法获取WS实例。');
    }
    removeWSListener(): void {
        this.abortController?.abort();
        this.abortController = null;
    }
    onOpen(event: Event): void {
        console.log("Connection open ...");

        // 发送个测试数据
        this.EvenBus?.emit(WSEventsConst.open, event);
    }
    onError(event: Event | Error, errorKind?: errorKindEnum): void {
        console.log('ws error', this, errorKind, event);
        errorKind ??= errorKindEnum.server;
        this.pauseHeartbeat();
        this.EvenBus?.emit(WSEventsConst.error, errorKind, event);
    }
    onClose(): void {
        // new时（先走error），或后端断开都会走这部，
        // 如果new时，连接不上，ws原生实例是null
        // 如果是后端断开，ws原生实例存在，但readstate为3，但ws实例无法复用，即使后端正常
        console.log('ws close', this);
        this.EvenBus?.emit(WSEventsConst.close);
    }
    onMessage(event: MessageEvent<any>): void {
        const data = JSON.parse(event.data)
        const eventName = data[this.wsOptions.receiveEventKey];
        console.log('receive type:', eventName, data);
        eventName && this.EvenBus?.emit(eventName, data);
    }

    sendMsg(msg: T): void {
        // console.log('send', msg);
        // console.log('发送时ws连接状态：', this.WS && this.WS.readyState === this.WS.OPEN);

        if (this.WS) {
            if (this.WS.readyState === this.WS.OPEN) {
                this.WS.send(JSON.stringify(msg));
                return;
            }
            return console.warn('WS状态未打开，无法发送消息，状态码：' + this.WS.readyState)
        }
        return console.error('WS实例不存在，无法发送消息。')
    }
    dispose(): void {
        this.removeWSListener();
        this.pauseHeartbeat();
        this.clearEventBus();
        if (this.WS) {
            this.WS.close();
            this.EvenBus = null;
            this.WS = null;
            return;
        }
        return console.error('销毁WS实例出错，WS实例丢失。');
    }
    initHeartbeat(heartbeatMsg: T, receivedEventName: string, heartbeatTime: number, retryMaxCount?: number): void {

        if (!this.EvenBus) return console.warn('当前事件中心实例不存在，禁止初始化心跳检测。');
        if (arguments.length < 3 || typeof heartbeatMsg !== 'object' || typeof heartbeatTime !== 'number' || heartbeatTime <= 0) {
            console.warn('未传入合法参数，初始化心跳检测失败。');
            return;
        }
        retryMaxCount ??= 0;
        this.heartBeatOptions.retryMaxCount = retryMaxCount > 0 ? Math.ceil(retryMaxCount) : 0;
        this.heartBeatOptions.heartbeatMsg = heartbeatMsg;
        this.heartBeatOptions.receivedEventName = receivedEventName;
        this.heartBeatOptions.heartbeatTime = heartbeatTime;
        this.heartBeatOptions.receivedEventName = receivedEventName;
        this.heartBeatOptions.heartbeatMsg = heartbeatMsg;
        this.heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.stop;
    }
    startHeartBeat(heartbeatTime?: number, retryMaxCount?: number) {
        // 判断当前是否有ws实例
        if (this.WS === null) return console.warn('当前WS实例不存在，无法启动心跳检测。');
        if (this.heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.cancel) return console.warn('未定义心跳数据。');
        if (heartbeatTime && heartbeatTime > 0) this.heartBeatOptions.heartbeatTime = heartbeatTime;
        if (retryMaxCount && retryMaxCount >= 0) this.heartBeatOptions.retryMaxCount = retryMaxCount;
        // 停止之前的心跳，防止多次调用，同时存在多个心跳检测
        this.pauseHeartbeat();
        // 注册监听心跳响应的事件
        this.on(this.heartBeatOptions.receivedEventName!, () => {
            this.heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.Received;
            this.heartBeatOptions.retryCount && (this.heartBeatOptions.retryCount = 0); // 不为零，重置重试次数
        })
        // 延迟发送一个心跳包
        this.sendHeartBeat();
    }
    sendHeartBeat() {
        this.heartBeatOptions.heartbeatTimmer = setTimeout(() => {
            /* // for test
            console.log('发送心跳包',this.heartBeatOptions.heartbeatTimmer);
            (this.heartBeatOptions.heartbeatMsg as any).msg = this.heartBeatOptions.heartbeatTimmer
            // for test */
            this.sendMsg(this.heartBeatOptions.heartbeatMsg!);
            this.heartBeatOptions.waitTimmer = this.waitHeartBeatAnswer()
        }, this.heartBeatOptions.heartbeatTime)
    }
    // TODO：多加一个字段，记录连续超时次数。超时后，在指定次数内从发心跳包。并且响应包接收事件记录。新增offline事件，如果重试次数是一，直接触发offline
    waitHeartBeatAnswer() {
        this.heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.waiting;
        // 在回调里查看心跳接收事件有没有被触发
        return setTimeout(() => {
            // console.log('检测心跳响应正常：', this.heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.Received, this.heartBeatOptions.waitTime);

            if (this.heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.Received) {
                // 从新发起一个心跳包
                this.sendHeartBeat();
                return;
            }
            // 超时
            this.heartBeatOptions.retryCount!++;
            console.warn('心跳超时，延迟次数：', this.heartBeatOptions.retryCount);
            if (this.heartBeatOptions.retryCount! <= this.heartBeatOptions.retryMaxCount!) {
                // 继续等待
                console.log('重发');

                return this.sendHeartBeat();
            }
            // 标记心跳检测结果
            this.heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.overtime;
            // 触发heartbeatOvertime事件
            this.EvenBus?.emit(WSEventsConst.heartbeatOvertime);
        }, this.heartBeatOptions.heartbeatTime)
    }
    pauseHeartbeat(): void {
        // 已经初始化心跳检测数据
        clearTimeout(this.heartBeatOptions.heartbeatTimmer);
        clearTimeout(this.heartBeatOptions.waitTimmer);
        this.heartBeatOptions.receivedEventName && this.EvenBus?.off(this.heartBeatOptions.receivedEventName);

        if (this.heartBeatOptions.heartbeatStatus === heartbeatStatusEnum.cancel) return;
        this.heartBeatOptions.heartbeatStatus = heartbeatStatusEnum.stop;// 如果状态不为未设置心跳，则把状态改为停止
        this.heartBeatOptions.retryCount = 0; // 重置重连次数
    }
    cancelHeartbeat(): void {
        // 停止心跳包发送
        this.pauseHeartbeat();
        // 重置心跳数据
        this.heartBeatOptions = null as any;
        this.heartBeatOptions = {
            heartbeatStatus: heartbeatStatusEnum.cancel
        }
    }
    on(eventName: string, callback: Function) {
        this.EvenBus?.on(eventName, callback);
    }
    once(eventName: string, callback: Function) {
        this.EvenBus?.once(eventName, callback);
    }
    off(eventName: string, callback?: Function) {
        // 限制外部不能取消内部注册的监听后端心跳响应的事件
        if (eventName === this.heartBeatOptions.receivedEventName!) return console.log('外部不能手动取消心跳包接收回调，请直接取消心跳检测。');
        this.EvenBus?.off(eventName, callback);
    }
    clearEventBus() {
        this.pauseHeartbeat(); // 停止心跳包发送，心跳包响应包接收事件需要eventbus来触发
        this.EvenBus?.clear();
    }
}

export default function initSocketWebox<K, T>(option: initWSOptionsType, initHeartbeatOptions: initHeartbeatOptionsType<K>): SocketWeboxType<K, T> {
    const SocketWeboxInstance = new SocketWebox<K, T>(option, initHeartbeatOptions);
    return SocketWeboxInstance;
}
