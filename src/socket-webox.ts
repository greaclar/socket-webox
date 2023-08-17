import initSocketWebox, { SocketWebox as MySocket } from './webSocket/socket';
export { type SocketWeboxType, type initWSOptionsType, type initHeartbeatOptionsType, WSEventsConst as WSEventsMap } from './webSocket/socket.type';
export const SocketWebox = MySocket;
export default initSocketWebox;
