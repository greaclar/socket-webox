import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui'
// addEventListener 版本
window.addEventListener("offline", () => {
    Message.error("网络连接已断开。");
});
window.addEventListener("online", () => {
    Message.success("联网成功。");
});
  

/**
 * 初始化一个socket-webox实例
 * 
 */
export function newWS() {
    const initSocketOptions = {
        /**
         * websocke连接地址，url参数name参数是和后端沟通好的属性，它的值用来标记本次连接
         */ 
        url: "ws://192.168.21.155:7070/ws/?name=user1",
        /**
         * 后端每次推送的消息中，标记此次消息的类型的属性名。该属性的值会作为事件名派发事件，并把此次消息作为参数调用事件回调。
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
        receiveEventKey: 'msgMode'
    }
    const heartbeatOptions = {
        /**
         * 向后端发送的心跳包内容
         */
        heartbeatMsg: { msgMode: 'heartbeat', msg: null },
        /**
         * 后端响应心跳包时，上面参数里initSocketOptions.receiveEventKey的属性值如果是'heartbeat'，才会标记为心跳响应
         * @example
         * ```js
         * // 心跳包发送后，后端需要响应的消息如下，只要求msgMode为'heartbeat'，msg字段可不定义
         * { msgMode: 'heartbeat', msg: 'answer' }
         * ```
         */
        receivedEventName: 'heartbeat',
        /**
         * 心跳包发送间隔，两次心跳包发送的实际间隔为3000ms，中间需要检测响应情况。
         */
        heartbeatTime: 1500,
        /**
         * 当发送心跳包后无响应连续1次后，再派发心跳包延迟事件。即允许连续掉包1次，接着第2次掉包则派发心跳延迟事件。否则忽略。
         * 非必传，默认值 0
         */
        retryMaxTime: 1,
    }

    // 以下参数用来外部控制断线后，重连的
    let reConnectCount = 0; // 当WebSocket异常关闭，重新连接的次数
    let reConnectMaxCount = 3; // 最大重连次数
    let reConnectTimmer = null; // 重连计时器，避免重连间隔太短

    const ws = initSocket(initSocketOptions, heartbeatOptions); // 初始化socket-webox实例
    // 如果浏览器不支持WebSocket，会返回null
    if (ws === null) {
        Message('初始化WebSocket连接失败。您的浏览器不支持。');
        return;
    }

    // 监听ws的打开事件，当ws打开成功后调用
    ws.on(WSEventsMap.open, () => {
        Message('WebSocket 连接成功。');
        reConnectCount = 0; // 重置重连次数
        ws.startHeartbeat(); // 开启心跳
    });
    
    // 监听心跳包延迟事件，当心跳包不能按时推送到客户端就会调用
    ws.on(WSEventsMap.heartbeatOvertime, () => {
        if (ws.getHeartbeatTime() >= 3000) { // 等待时间达到阈值
            Message.error('线路不通，请检测网络状态。');
            confirm('线路不通，是否重连？') && ws.connect();
            return;
        }
        Message('线路拥堵，正在检测线路状态。');
        ws.startHeartbeat(ws.getHeartbeatTime() + 1000, 1); // 更新心跳间隔，及重心跳包连续掉包允许次数
    })

    // 监听当前WebSocket实例连接关闭事件。初始连接失败会触发error、close、后端中断只会触发close
    ws.on(WSEventsMap.close, () => {
        console.log('WebSocket closed');
        // 连续重连次数小于最大尝试重连次数
        if (reConnectCount < reConnectMaxCount) {
            // 使用定时器发起重连，防止重连太频繁
            reConnectTimmer = setTimeout(() => {
                reConnectCount++;
                console.log('WebSocket 断开连接，正在尝试第' + reConnectCount + '次重新连接。');
                Message('WebSocket 断开连接，正在尝试第' + reConnectCount + '次重新连接。');
                ws.connect();
            }, 500);
        } else {
            Message.error('WebSocket 网络已断开。');
            clearTimeout(reConnectTimmer);
            ws.dispose();
        }
    })

    // 监听当前WebSocket实例的错误事件。当WebSocket实例出现错误调用，如初始化的地址无法连接
    ws.on(WSEventsMap.error, (error) => {
        console.log('WebSocket error', error);
        Message('WebSocket连接出现错误。请刷新页面');
    })

    // 发起连接，一般先注册事件，再发起连接。
    // connect()每次调用都会先销毁旧的WebSocket实例再初始化一个新的。注册的事件会应用到新的实例上。
    ws.connect();
    return ws;
}

