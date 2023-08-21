/**
 * 事件中心与ws解耦，ws关闭不会清空外部注册的事件。但会关掉监听心跳返回包时内部注册的事件
 * 
 * ws的生命周期钩子，心跳包响应超时都会触发WSEventEnum内固定的事件，外部触发会被拦截，但可被服务器响应触发
 * 服务器返回消息，并设置消息哪个字段是事件名，内部会根据服务器的响应触发对应的事件
 * ，外部均可监听，前提自己注册了对应事件在事件中心中。
 * 
 *  MyWebSocket实例类型，T为sendMsg的参数类型，K为接收到后端消息的消息类型
 * 外部可停止心跳，重启心跳（传递参数表示更新心跳间隔）
 * 外部可调用实例的connect重新实例化一个WebSocket，旧的会被销毁（连同心跳检测）
 * 外部可发送msg
 * 外部可监听事件的触发（ws生命周期事件：open、error、close）
 * 外部可取消事件的触发
 * 外部可销毁ws
 */

import initSocketWebox from "socket-webox";

// ts示例
type msgType = {
    msgType: string,
    msg: any
}

const initSocketOption = {
    // name参数为和后端沟通好的属性，它的值用来标记本次连接
    url: "ws://127.0.0.1:7070/ws/?user_name=greaclar",
    // 每次后端返回的消息必须是一个对象，且包含msgID字段，该字段值作为事件名触发事件中心的事件
    receiveEventKey: 'msgID'
}

const SocketWebox = initSocketWebox<msgType>(initSocketOption);


// 普通流程示例

function connectWS() {
    const WS = new WebSocket("ws://127.0.0.1:7070/ws/?user_name=user1");
    // WebSocket实例上的事件

    // 当连接成功打开
    WS.addEventListener('open', () => {
        console.log('ws连接成功');
    });
    // 监听后端的推送消息
    WS.addEventListener('message', (event) => {
        console.log('ws收到消息', event.data);
    });
    // 监听后端的关闭消息，如果发送意外错误，这里也会触发
    WS.addEventListener('close', () => {
        console.log('ws连接关闭');
    });
    // 监听WS的意外错误消息
    WS.addEventListener('error', (error) => {
        console.log('ws出错', error);
    });
    return WS;
}

let WS = connectWS();
let heartbeatStatus = 'waiting';

WS.addEventListener('open', () => {
    // 启动成功后开启心跳检测
    startHeartbeat()
})

WS.addEventListener('message', (event) => {
    const { data } = event;
    console.log('心跳响应', data, data === '"heartbeat"');
    if (data === '"heartbeat"') {
        heartbeatStatus = 'received';
    }
})

function startHeartbeat() {
    setTimeout(() => {
        heartbeatStatus = 'waiting';
        WS.send('heartbeat');
        waitHeartbeat();
    }, 1500)
}

function waitHeartbeat() {
    setTimeout(() => {
        console.log('ws心跳超时', heartbeatStatus);
        if (heartbeatStatus === 'waiting') {
            // 心跳应答超时
            WS.close();
        } else {
            // 启动下一轮心跳检测
            startHeartbeat();
        }
    }, 1500)
}