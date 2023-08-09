# 前端原生WebSocket的一些问题

+ 无法判断网络状态。在网络不佳，或者浏览器断网的情况下，WebSocket实例的readyState依旧为open状态，向后端发送消息不会报错，也依旧会认为自己能接收后端的消息。
+ 在使用组件化开发的框架时，往往不同的业务组件需要接收各自的WebSocket消息，每个WebSocket实例只有一个message事件回调，组件间共用时，它们都可以监听到其它组件的更新信息。
+ 当后端异常，关闭websocket通道后，前端WebSocket实例的readyState变为close状态，但实例依旧存在。如果实例上绑定open、close、message等事件的监听，并不会解除。即使后端恢复了，该WebSocket实例也无法再连接。

# socket-box特点

对WebSocket实例进行二次封装，让其更好用。

内置事件中心，通过事件中心的方式，来派发WebSocket实例的生命周期钩子，如: open、error、close、message（根据消息类型，可进行更精细的事件派发），以及心跳响应超时钩子。

灵活的心跳检测机制：
+ 在自定义间隔内发送心跳包给后端，如果后端响应超时，会派发超时事件，并自动停止检测。
+ 可在超时事件派发时，设置更久的响应等待时间，并重新发起心跳检测，有效适应网络差的情况。可自由控制超时事件触发次数阈值，以提示用户，可能已经断线。
+ 多次调用心跳检测启动的api时，会先自动停止正在运行的心跳检测，代码更健壮。

更精细的message事件派发：
+ 在一个应用中，只需一个WebSocket实例，来对多个业务组件进行对应的消息派发。
+ 支持对后端消息进行预处理，根据不同的消息，派发不同的事件，不同组件监听对应的事件即可。
+ 当组件销毁时，可在其销毁钩子中，手动解除对应的事件监听。

实例销毁更简单：
+ 销毁实例时，会把所有的实例绑定原生事件、心跳检测定时器、事件中心注册的事件全部销毁。

typescript类型提示：
+ 可设置前后端发送消息时，数据的类型结构。
+ 提供open、error、close、message、心跳响应超时事件名的类型对象，导入后即可使用，无需担心拼写错误。



