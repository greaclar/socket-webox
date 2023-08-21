import initSocket, { WSEventsMap, type SocketWeboxType, type initWSOptionsType, type initHeartbeatOptionsType } from 'socket-webox';
import { Message } from 'element-plus';
/**
 * 前后交流的数据类型
 */
type msgType = {
    msgID: string,
    msg: any
}


export function newWS(): SocketWeboxType<msgType, msgType> | null {
    // 初始化一个websocket的参数
    const initSocketOpt:initWSOptionsType = {
        // 读取.env里的配置
        url: import.meta.env.VITE_WS_URL,
        // 每次后端返回的消息必须是一个对象，且包含msgID字段，该字段值作为事件名触发事件中心的事件
        receiveEventKey: 'msgID',
    }
    // 心跳参数
    const heartbeatOptions:initHeartbeatOptionsType<msgType> = {
        heartbeatMsg: { msgID: 'heartbeat', msg: null },
        receivedEventName: 'heartbeat',
        heartbeatTime: 1500,
        retryMaxCount: 1
    }
    // 错误重连
    let reconnectCount = 0;
    let reconnectTimmer:ReturnType<typeof setTimeout> | undefined;
    const reconnectMaxCount = 3;
    const reconnectTime = 1000;

    const ws = initSocket<msgType>(initSocketOpt, heartbeatOptions);
    
    if (ws == null) {
        ElMessage.error('您的浏览器不支持websocket。')
        return null;
    }
    // 每次连接上后
    ws.on(WSEventsMap.open, () => {
        ElMessage.success('ws 连接成功。');
        reconnectCount = 0;
        ws.startHeartbeat(1500);
    });
    // 异常关闭
    ws.on(WSEventsMap.close, () => {
        if (reconnectCount < reconnectMaxCount){
            clearTimeout(reconnectTimmer);
            reconnectTimmer = setTimeout(() => {
                reconnectCount++;
                ElMessage.warning('ws 连接已断开，正在尝试第 '+reconnectCount+' 次重连。');
                ws.connect();
            }, reconnectTime);
            return;
        }
        clearTimeout(reconnectTimmer);
        ws.dispose();
        ElMessage.error('ws 已关闭。');
    })
    // 心跳应答延迟
    ws.on(WSEventsMap.heartbeatOvertime, () => {
        if (ws.getHeartbeatTime()! > 2000) {
            // ElMessage.error('ws 心跳超时。');
            confirm('ws连接突然断开，是否尝试重连') && ws.connect();
            return;
        }
        ElMessage('ws 连接异常，正在检查线路状态。');
        ws.startHeartbeat(ws.getHeartbeatTime()! + 500, 1);
    })
    ws.on(WSEventsMap.error, () => {
        ElMessage.error('ws 连接异常。');
    });
    ws.connect();
    return ws;
}
