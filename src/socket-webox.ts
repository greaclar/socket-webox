import initSocketWebox, { SocketWebox } from './webSocket/socket';
export { type SocketWeboxType as MyWebSocketType, WSEventsConst } from './webSocket/socket.type';
export const MySocket = SocketWebox;
export default initSocketWebox;
