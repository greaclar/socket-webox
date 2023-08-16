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
 * ws实例初始化的参数
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
     * 后端返回消息数据时，读取的消息对象的属性，该属性值作为事件名，触发eventbus里的事件
     */
    receiveEventKey: string
}

/**
 * 心跳初始化的参数
 */
export type heartBeatOptionsType<T> = {
    /**
     * 心跳检测状态
     */
    heartbeatStatus: heartbeatStatusEnum;
    /**
     * 心跳定时发送间隔，单位ms
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
     * 心跳重试总次数
     */
    retryMaxCount?: number;
    /**
     * 等待心跳响应的定时器
     */
    waitTimmer?: ReturnType<typeof setTimeout>;
    /**
     * 心跳检测后台响应数据时，事件名
     */
    receivedEventName?: string;
    /**
     * 发送到后端的心跳包信息
     */
    heartbeatMsg?: T

}

/**
 * 用户初始化时传递的心跳参数
 */
export type initHeartbeatOptionsType<T> = Required<Pick<heartBeatOptionsType<T>, 'heartbeatTime' | 'receivedEventName' | 'heartbeatMsg'>> & Pick<heartBeatOptionsType<T>,  'retryMaxCount'>

/**
 * 实例化-》连接ws，可注册事件
 * 
 * 事件中心与ws解耦，ws关闭不会清空外部注册的事件。但会关掉监听心跳返回包时内部注册的事件
 * 
 * ws的生命周期钩子，心跳包响应超时都会触发WSEventEnum内固定的事件，外部触发会被拦截，但可被服务器响应触发
 * 服务器返回消息，并设置消息哪个字段是事件名，内部会根据服务器的响应触发对应的事件
 * ，外部均可监听，前提自己注册了对应事件在事件中心中。
 * 
 *  MyWebSocket实例类型，T为sendMsg的参数类型，K为接收到后端消息的消息类型
 * 外部可停止心跳，重启心跳（传递参数表示更新心跳间隔）
 * 外部可关闭旧的ws，也可以直接重新开启ws，旧的会被销毁（连同心跳检测）
 * 外部可发送msg
 * 外部可监听事件的触发（ws生命周期事件：open、message：所有msg、固定的msg）
 * 外部可取消事件的触发
 * 外部可销毁ws
 */
export type SocketWeboxType<T, K> = {
    /**
     * 每个实例维护唯一一个事件中心
     */
    EvenBus: EventCenterType | null;
    /**
     * 每个实例内维护唯一一个WebSocket实例
     */
    WS: WebSocket | null;
    /**
     * 初始化ws的url、protocols、receiveEventKey
     */
    wsOptions: initWSOptionsType;
    /**
     * 心跳相关配置
     */
    heartBeatOptions: heartBeatOptionsType<T>;
    /**
     * 连接ws，并监听ws原生事件，通过eventbus触发对应的事件，可监听的事件可导入WSEventsConst查看
     */
    connect():void;
    /**
     * 给当前的ws实例添加事件监听
     */
    addWSListener(): void;
    /**
     * 移除当前的ws实例的事件监听
     */
    removeWSListener(): void;
    /**
     * ws实例打开时的事件回调，会触发事件中心的wsopen事件
     * @param event ws打开时的事件对象
     */
    onOpen(event: Event): void;
    /**
     * ws实例发生错误的回调，会触发事件中心的wserror事件
     * @param event ws发生错误时的事件对象
     */
    onError(event: Event): void;
    /**
     * ws实例正常关闭的回调，会触发事件中心的wsclose事件
     * @param event ws关闭时的事件对象
     */
    onClose(event: CloseEvent): void;
    /**
     * ws实例接收消息回调，会触发事件中心的wsmessage事件
     * @param event ws实例接收到消息事件时的事件对象
     */
    onMessage(event: MessageEvent<any>): void;
    /**
     * 使用ws发送消息
     * @param msg 要发送的消息
     */
    sendMsg(msg: T): void;
    /**
     * 初始心跳参数，并注册receivedEventName参数对应的心跳响应包响应的事件
     * @param heartbeatMsg 要给后端发送的心跳包
     * @param receivedEventName 后端返回的消息类型值，用来触发心跳响应的回调
     * @param heartbeatTime 心跳包发送延迟
     * @param retryCount 心跳包重试次数
     */
    initHeartbeat(heartbeatMsg: T, receivedEventName: string, heartbeatTime: number, retryCount?: number): void;
    /**
     * 开启心跳检测，仅当ws实例存在且未开启才能成功开启。当发生延迟，会触发WSEventEnum.heartbeatOvertime事件。
     * 
     * 心跳超时不一定是断链，可能是网速差，可传递新的心跳延迟和等待时间
     * @param heartbeatTime 心跳包发送间隔
     * @param retryCount 心跳包重试次数
     */
    startHeartBeat(heartbeatTime?: number, retryCount?: number): void;
    /**
     * 暂停心跳检测，清空未完成的定时心跳包发送，将状态设置为stop
     */
    pauseHeartbeat(): void;
    /**
     * 取消心跳检查，清空未完成的定时心跳包发送，将状态设置为cancel，清空心跳参数，并清除心跳响应包响应的事件监听
     */
    cancelHeartbeat(): void;
    /**
     * 关闭ws、取消ws上的error、message等事件监听、心跳检测。ws实例、eventbus清除。
     */
    dispose(): void;
    /**
     * 给事件注册回调函数，如果想注册自定义事件，事件名必须以custom:开头
     * 一般用来注册监听ws生命周期回调、心跳超时回调、服务器响应回调
     * @param eventName 要注册的事件名
     * @param callback 事件触发的回调函数
     */
    on(eventName: string, callback: Function):void;
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
    // emit(eventName: string, ...args: any[]): void;
    /**
     * 解除事件，不能解除（内部注册的）心跳包等待服务器响应回调
     * @param eventName 要解除的事件名
     * @param callback 要解除的事件名下对应的回调函数，如果没传则全部删除
     */
    off(eventName: string, callback?: Function):void;
    /**
     * 清空事件中心记录的事件
     */
    clearEventBus(): void;

}

/**
 * emit不能放开，内部生命周期（心跳服务器响应、普通消息响应）事件，只能内部触发.off不能解除内部注册的心跳事件
 */
export type socketInstanceType =
    'sendMsg'
    | 'connect'
    | 'initHeartbeat'
    | 'startHeartBeat'
    | 'pauseHeartbeat'
    | 'cancelHeartbeat'
    | 'closeWS'
    | 'on'
    | 'once'
    | 'off'
