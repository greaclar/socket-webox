import { EventCenterType } from "./eventCenter";

/**
 * 心跳检测状态
 */
export const enum heartbeatStatusEnum {
    /**
     * 未开启或取消心跳检测的状态，心跳相关参数均未定义
     */
    cancel = 0,
    /**
     * 发送一个心跳包给后端，等待响应
     */
    waiting = 1,
    /**
     * 后端响应一个心跳包后，并成功触发heartBeatOptionsType.receivedEventName事件的状态
     */
    Received = 2,
    /**
     * 发送心跳包后，在设定的等待时间内未收到响应包
     */
    overtime = 3,
    /**
     * 已经定义好心跳相关参数，但未启动心跳检测
     */
    stop = 4
}

/**
 * ws实例生命周期内会触发的事件
 */
export const WSEventsConst = {
    open: 'inner:open',
    close: 'inner:close',
    error: 'inner:error',
    // message : 'message', 
    heartbeatOvertime: 'inner:heartbeatOvertime'
} as const;

/**
 * socket-webox初始化的必选参数，配置WebSocket的连接信息
 */
export type initWSOptionsType = {
    /**
     * 初始化ws的地址
     */
    url: string,
    /**
     * ws的端口
     */
    protocols?: string,
    /**
     * 后端每次推送的消息时，标记此次消息的类型的属性名。该属性的值会作为事件名，派发事件，并把此次消息作为参数调用事件回调。
     * @example
     * ```js
     * // 后端返回的消息，要求必须是一个包含msgMode属性的对象，该属性的值用来标记该消息的类型，如下：
     * {msgMode: 'heartbeat', msg: 'hellow'}
     * 
     * // socket-webox接收到后，会读取msgMode的值，然后通过事件中心派发'heartbeat'事件，并把整个对象作为参数，调用其回调。
     * // 例如，如果注册了以下事件，当后端返回上面的消息，回调里的代码就会被执行
     * socketInstance.on('heartbeat', (data)=>{
     *      console.log(data) // {msgMode: 'heartbeat', msg: 'hellow'}
     * })
     * ```
     */
    receiveEventKey: string
}

/**
 * 实例内部保存的心跳配置参数
 */
export type heartBeatOptionsType<T> = {
    /**
     * 心跳检测状态
     */
    heartbeatStatus: heartbeatStatusEnum;
    /**
     * 心跳定时发送间隔，单位ms。
     * 例如定义1500，第一次心跳包在1500ms后发送，再等待1500ms检测响应情况，然后再等待1500ms发送下一次心跳闭包。不断循环。
     */
    heartbeatTime?: number;
    /**
     * 心跳定时器
     */
    heartbeatTimmer?: ReturnType<typeof setTimeout>;
    /**
     * 心跳重试次数
     */
    retryCount?: number;
    /**
     * 心跳重试总次数阈值，超过或等于则停止重试，并派发心跳包延迟事件
     */
    retryMaxCount?: number;
    /**
     * 等待心跳响应的定时器
     */
    waitTimmer?: ReturnType<typeof setTimeout>;
    /**
     * 后端响应心跳包时，派发心跳响应的事件名。用来区分普通推送消息和心跳响应。
     * @example
     * ```js
     * // 心跳包发送后，后端需要响应的消息如下，只要求msgMode为'heartbeat'，msg字段可不定义
     * // 这里msgMode，对应第一个参数里receiveEventKey的属性值
     * { msgMode: 'heartbeat', msg: 'answer' }
     * ```
     */
    receivedEventName?: string;
    /**
     * 发送到后端的心跳包信息
     */
    heartbeatMsg?: T

}

/**
 * 用户初始化时传递的心跳参数，如果不需要心跳检测则不需要传递
 */
export type initHeartbeatOptionsType<T> = Required<Pick<heartBeatOptionsType<T>, 'heartbeatTime' | 'receivedEventName' | 'heartbeatMsg'>> & Pick<heartBeatOptionsType<T>,  'retryMaxCount'>

export type SocketWeboxType<T, K> = {
    /**
     * 连接ws，并监听ws原生事件，通过eventbus触发对应的事件，可监听的事件可导入WSEventsMap查看
     */
    connect():void;
    /**
     * 使用ws发送消息，会先判断当前WebSocket实例是否存在，存在的状态是否为open
     * @param msg 要发送的消息
     */
    sendMsg(msg: T): void;
    /**
     * 不建议单独使用，应该在初始化时定义：初始化心跳参数，并注册receivedEventName参数对应的心跳响应包响应的事件
     * @param heartbeatMsg 要给后端发送的心跳包
     * @param receivedEventName 后端返回的消息类型值，用来触发心跳响应的回调
     * @param heartbeatTime 心跳包发送延迟
     * @param retryCount 心跳包重试次数
     */
    initHeartbeat(heartbeatMsg: T, receivedEventName: string, heartbeatTime: number, retryCount?: number): void;
    /**
     * 获取当前心跳包发送的间隔，没有定义返回undefined
     * @return 当前配置的心跳发送间隔，但实际两次心跳包的发送间隔为该值的两倍。
     */
    getHeartbeatTime(): number | undefined;
    /**
     * 开启心跳检测，仅当ws实例存在且未开启才能成功开启。当发生延迟，会触发WSEventEnum.heartbeatOvertime事件。
     * 
     * 心跳超时不一定是断连，可能是网速差、网络抖动，设置retryCount可忽略个别的心跳包无响应
     * @param heartbeatTime 心跳包发送间隔
     * @param retryCount 心跳包响应延迟重试次数
     */
    startHeartBeat(heartbeatTime?: number, retryCount?: number): void;
    /**
     * 暂停心跳检测，清空未完成的定时心跳包发送，连续掉线次数改为0，将状态设置为stop
     */
    pauseHeartbeat(): void;
    /**
     * 取消心跳检查，清空未完成的定时心跳包发送，连续掉线次数改为0，将状态设置为cancel，清空心跳参数，并清除心跳响应包响应的事件监听
     */
    cancelHeartbeat(): void;
    /**
     * 关闭ws、取消ws上的error、message等事件监听、心跳检测。ws实例、eventbus清除。无法再使用。
     */
    dispose(): void;
    /**
     * 给事件注册回调函数，如果调用connect
     * 一般用来注册监听ws生命周期回调、心跳超时回调、服务器响应回调，open、error、close等生命周期回调一般只调用一次，但多次调用conneet，它们也会响应触发
     * @param eventName 要注册的事件名
     * @param callback 事件触发的回调函数
     */
    on(eventName: string, callback: Function):void;
    /**
     * 同on，给事件添加回调函数，并且调用一次后自动移除
     * 用来注册监听ws生命周期回调、心跳超时回调、服务器响应回调
     * @param eventName 要触发的事件名
     * @param callback 事件回调
     */
    once(eventName: string, callback: Function): void;
    /**
     * 解除外部监听的事件，不能解除（内部注册的）心跳包等待服务器响应回调
     * @param eventName 要解除的事件名
     * @param callback 要解除的事件名下对应的回调函数，如果没传则全部删除
     */
    off(eventName: string, callback?: Function):void;
    /**
     * 停止心跳检测后，清空事件中心记录的事件
     */
    clearEventBus(): void;

}
