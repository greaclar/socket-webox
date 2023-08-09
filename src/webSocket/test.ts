

/**
 * 前后交流的数据类型
 */
type msgType = {
    msgMode: string,
    msg: any
}
/**
 * 初始化一个socket的参数
 */
const initSocketOpt = {
    // name参数为和后端沟通好的属性，它的值用来标记本次连接
    url: "ws://127.0.0.1:2048/ws/?name=zhangsan",
    // 每次后端返回的消息必须是一个对象，且包含msgMode字段，该字段值作为事件名触发事件中心的事件
    receiveEventKey: 'msgMode'
}