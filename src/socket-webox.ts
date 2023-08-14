import initWebsocket, { MyWebSocket } from './webSocket/socket';
export { type MyWebSocketType, WSEventsConst } from './webSocket/socket.type';
export const MySocket = MyWebSocket;
export default initWebsocket;
