# 安装

socket-webox是一个前端WebSocket封装库，结合事件中心，来对后端推送消息进行分类派发。

+ 可实现灵活配置渐进式的心跳检测机制，区分网络抖动、网络差、客户端掉线。
+ 提供断线重连、检测浏览器兼容性等相关api。使用更方便。
+ 排除声明文件，代码仅7kb不到，gzip后3kb不到。

```shell
# 本地安装
npm i socket-webox -S
```

# 前端原生WebSocket的一些问题

> websocket和http一样是应用层协议，在传输层同样使用了TCP。但地址以ws:或wss:开头。它与http的区别在于，websocket可以互相发起请求。当有新消息时，服务的主动通知客户端，无需客户端主动向服务器询问。

+ 无法判断网络状态。在网络不佳，或者浏览器断网的情况下，WebSocket实例的readyState依旧为open状态，向后端发送消息不会报错，也依旧会认为自己能接收后端的消息。

+ 在使用组件化开发的框架时，往往不同的业务组件需要接收各自的WebSocket消息，每个WebSocket实例只有一个message事件回调，组件间共用时，它们都可以监听到其它组件的更新信息。

+ 当后端侧关闭websocket通道后（或服务中断下线），前端WebSocket实例的readyState变为close状态，但实例依旧存在。如果实例上绑定open、close、message等事件的监听，并不会解除。即使后端恢复了，该WebSocket实例也无法再使用。

+ 需要考虑的边界情况分散：初始化前，需要手动判断当前浏览器是否兼容；实例化时，需要通过监听实例error事件来检测连接错误；后端服务中断则需要监听close事件；WebSocket实例无法检测设备端网络不佳、网络断线的情况。

# socket-webox特点

使用上：将WebSocket与事件中心整合，让其更好用，只需初始化实例，然后监听事件即可。

功能上：提供声明式api，且涵盖WebSocket的全生命周期。从判断浏览器是否兼容、到异常后找到实例把注册的事件一个个解除。这些能力只需调用一个api即可。

> socket-webox不与任何框架耦合，原生环境可用，但在组件化的框架中使用会有更好的体验。注意，开发时使用了主流的ES6+语法，在旧浏览器中可能无法正常运行。
>
> 设计上以扩展原生的WebSocket为主，例如初始化参数、事件的触发流程均看齐原生的WebSocket。

## 使用特点

socket-webox使用上，主要就是监听事件，在事件回调里进行业务操作或者对实例进行配置。可监听的事件分两类：

1. 后端推送消息事件，会进行一对一的事件派发，具体业务注册对应的监听事件。该事件可随组件销毁而取消。

2. WebSocket生命周期事件，会代理触发websocket的原生事件: open（打开）、error（服务错误）、close（关闭），并增加了心跳响应超时事件，结合灵活的api可辨别客户端网络抖动、掉线的情况。

   > PS：所有事件只能监听注册和取消，不能通过外部手动来派事件。事件派发只能是内部来处理。

## 功能特点

渐进式使用体验设计：

+ 使用上和原生的WebSocket类似，初始化，然后监听事件即可。只是要和后端沟通好响应数据的格式。
+ 如果需要心跳检测，传递第二个参数，然后监听心跳超时事件即可。

更精细的后端响应事件派发：

+ 只需一个WebSocket连接实例，即可对多个业务组件进行一对一的消息派发。
+ 对后端消息进行预处理，根据不同的消息，派发不同的事件，不同组件监听对应的事件即可。
+ 当组件销毁时，可在其销毁钩子中，手动解除某个的事件监听。

灵活的心跳检测机制：
+ 在自定义间隔内发送心跳包给后端，如果后端响应超时，会派发超时事件，并自动停止心跳检测。
+ 可设置连续超时一定次数后，才派发响应超时事件和停止心跳检测，防止因为网络抖动误报。
+ 可在超时事件派发时，提醒用户网络差，然后设置更久的响应等待时间，并重新发起心跳检测。通过判断超时事件触发阈值，以提示用户，可能已经断线。
+ 每次调用心跳检测api时，会先自动停止正在运行的心跳检测，代码更健壮。

实例销毁更简单：
+ 提供销毁的接口，会把所有的实例监听的原生事件、心跳检测定时器、事件中心注册的事件全部销毁。
+ 发起连接的api可调用多次，以实现断线重连，并且每次重连都会先清除旧WebSocket实例上的原生事件监听，内存管理更简单。

typescript类型提示：
+ 可设置前后端发送消息时，数据的类型结构。
+ 提供open、error、close、心跳响应超时事件名的类型对象，导入后即可使用，无需担心拼写错误。

错误处理：

+ 初始化WebSocket的地址无法连接，事件中心会派发error事件，并将错误对象传递。然后派发close事件。这个过程和WebSocket实例原生事件的触发流程一致。

+ 后端中断服务，不会触发error事件，只会触发close事件，并且实例无法再通讯。与原生实例流程一致。

+ 如果客户端不支持WebSocket，实例化时会抛出异常，阻止代码往下执行。但实例自身提供了检测当前浏览器是否包含WebSocket的静态方法，可通过它来预先判断一下，再实例化。

  > 注意：心跳检测触发的网络延迟事件并不是错误事件，因为WebSocket实例本身功能正常，可处理发送和接收消息的任务，只是网络环境异常，无法让数据顺利发送和接收，当用户的网络正常后依旧可用。
  >
  > 但error触发是实例层面的问题，网络正常可能也无法使用。


# 使用示例：

使用约束：后端推送的websocket消息必须为对象类型，且对象里包含一个标记每次消息类型的字段。

> socket-webox使用typescript开发，有对应的声明文件，但示例使用js。

## 初始化

```js
import initSocket from 'socket-webox';
const initSocketOptions = {
    // websocke连接地址，必传
    url: "ws://127.0.0.1:7070/ws/?name=greaclar",
    // websocke连接端口，非必传
    protocols?: string,
    // 后端每次推送的消息中，标记此次消息的类型的属性名，必传
    // 该属性的值会作为事件名派发事件，并把此次消息作为参数调用事件回调。
    receiveEventKey: 'msgMode'
}

// 初始化socket-webox实例
const ws = initSocket(initSocketOptions); 

// 如果浏览器不支持WebSocket，会返回null
if (ws == null) {
    console.log('初始化WebSocket连接失败。您的浏览器不支持。');
} else {
    // 发起连接
	ws.connect();
}
```

## 销毁实例

当实例不需要时，发生错误，连接不可用等，可将实例内的资源释放（解除相关事件的监听及相关定时器）：

```js
const ws = initSocket(initSocketOptions); 
ws.dispose();
```



## 监听后端websocket消息推送

+ 假设后端websocket服务会不定时推送以下消息：

  ```json
  {"msgMode": "update-test1", "msg": "hellow"}
  ```

+ 在任意模块下，通过实例上的on来监听具体的消息推送：

  ```js
  // 每次后端推送以上信息，这里的回调就会触发，
  // 也就是说只要返回的消息中，msgMode为update-test1，对应的回调就会触发
  const callbackFn = (data) => {
      this.msg = data; // data: {msgMode: 'update-test1', msg: 'hellow'}
  }
  ws.on('update-test1', callbackFn);
  ```

+ 解除监听：当前端不需要监听该推送事件了，通过off来解除：

  ```js
  // 解除所有通过updata-test1注册的回调函数
  ws.off('update-test1');
  
  // 也可以只解除某个回调
  ws.off('update-test1', callbackFn);
  ```

## 监听WebSocket实例钩子

可监听的钩子有：

+ 打开事件：当WebSocket成功连接上后端服务时。

+ 关闭事件：后端服务突然断开时，或突然发生错误意外断开。

+ 错误事件：当WebSocket实例发生错误，如初始化时的地址不可用。

+ 心跳响应延迟事件：如果设置的心跳检测，当心跳包无法按时接收到。

  socket-webox为所有事件提供一个映射对象，来找到对应的事件名，导入即可使用。

  ```js
  // 'socket-webox';
  // ws实例生命周期内会触发的事件
  export const WSEventsMap = {
      open: 'inner:open', // 打开事件
      close: 'inner:close', // 关闭事件
      error: 'inner:error', // 错误事件
      heartbeatOvertime: 'inner:heartbeatOvertime' // 心跳延迟事件
  }
  ```

使用示例：

```js
import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui';

// 初始化一个socket-webox实例的工厂函数
export function newSocketWebox() {
    // 初始化socket-webox实例
    const ws = initSocket({
        url: "ws://127.0.0.1:7070/ws/?name=user1",
        receiveEventKey: 'msgMode'
    }); 
    
    // 如果浏览器不支持WebSocket，会返回null
    if (ws == null) {
        Message('初始化WebSocket连接失败。您的浏览器不支持。');
        return null;
    }

    // 监听ws的打开事件，当ws打开成功后调用
    ws.on(WSEventsMap.open, () => {
        Message('WebSocket 连接成功。');
    });
    
    // 监听当前WebSocket实例连接关闭事件。初始连接失败会触发error、close、后端中断只会触发close
    ws.on(WSEventsMap.close, () => {
        Message.error('WebSocket 网络已断开。');
    })

    // 监听当前WebSocket实例的错误事件。当WebSocket实例出现错误调用，如初始化的地址无法连接
    ws.on(WSEventsMap.error, (error) => {
        console.log('WebSocket error', error);
        Message('WebSocket出现错误。请刷新页面');
    })
    
    // 监听心跳包延迟事件，当心跳包不能按时推送到客户端就会调用，因为没有传递心跳参数，这里不会触发
    ws.on(WSEventsMap.heartbeatOvertime, () => {
        Message('网络拥堵，正在检测网络状态。');
    })

    // 发起连接，推荐先注册事件，再发起连接。
    // connect()每次调用都会先销毁旧的WebSocket实例再初始化一个新的。注册的事件会应用到新的实例上。
    ws.connect();
    return ws;
}
```

## 配置心跳检测

设置心跳检测的本质是检测当前网络环境，检测出是网络抖动、网络差、网络不可用，然后提醒用户修复网络。socket-webox采取的是渐进式的提醒策略，首先排除网络抖动，避免误提醒；然后提醒用户网络不佳；最后才是提醒用户已断线。

心跳检测需要在初始化实例时，传递第二个参数：

```js
import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui';

const initSocketOptions = {
    url: "ws://127.0.0.1:7070/ws/?name=user1",
    receiveEventKey: 'msgMode' // 读取后端响应消息的msgMode属性，用来区分消息类型是心跳包还是普通消息
}
const heartbeatOptions = {
    // 定时向后端发送的心跳包内容
    heartbeatMsg: { msgMode: 'heartbeat', msg: null },
    // 后端响应心跳包时，标记消息类型为心跳响应的字符串
    // @example
    // 心跳包发送后，后端需要响应的消息如下:
    // { msgMode: 'heartbeat', msg: 'answer' }，只要求msgMode为'heartbeat'，msg属性可不定义
    receivedEventName: 'heartbeat',
    // 心跳包发送间隔，两次心跳包发送的实际间隔为3000ms，中间需要检测心跳响应情况。
    heartbeatTime: 1500,
    // 当发送心跳包后无响应连续1次后，再派发心跳包延迟事件。
    // 即允许连续掉包1次，接着第2次掉包则派发心跳延迟事件。第二次正常则忽略。
    // 非必传，默认值 0
    retryMaxTime: 1,
}
const ws = initSocket(initSocketOptions, heartbeatOptions); // 初始化socket-webox实例
```

心跳检测配置后，可监听心跳延迟事件。该事件在心跳包发送后，前端无法在期望时间内接收达到后端应答时触发。并且触发后，心跳检测会自动停止。

```js
// 监听心跳包延迟事件，当心跳包不能按时推送到客户端就会调用
ws.on(WSEventsMap.heartbeatOvertime, () => {
    Message('网络拥堵，已停止心跳检测。');
})
```

### 心跳检测相关api

配置了心跳检测后，socket-webox提供相关的api来判别不同网络环境，以实现灵活的处理：

```js
ws.getHeartbeatTime(); // 获取当前心跳包发送间隔时间
ws.startHeartBeat(); // 启动心跳检测
ws.pauseHeartBeat(); // 暂停心跳检测
ws.startHeartBeat(1800, 1); // 以1800ms的间隔，允许连续掉包1次（只掉包一次会忽视）的配置，重新启动心跳检测。
```

处理思路：

+ 设置retryMaxTime参数，允许范围内的掉包（心跳响应包在期望时间内未返回）次数，排除网络抖动，此时不需要处理。
+ 当心跳包延迟事件触发，此时可能是网络差，也可能是浏览器断网了，此时可设置久一点的心跳包发送间隔，并提醒用户网络不佳。
+ 如果后续继续发生延迟事件，且此时的心跳包发送间隔可能已经超过可忍受阈值了，可以判断为网络不可用了，需要提醒用户修复网络。

配置：

```js
import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui';

export function newSocketWebox() {
    const initSocketOptions = {
        url: "ws://127.0.0.1:7070/ws/?name=user1",
        receiveEventKey: 'msgMode'
    }
    const heartbeatOptions = {
        heartbeatMsg: { msgMode: 'heartbeat', msg: null },
        receivedEventName: 'heartbeat',
        heartbeatTime: 1500,
        retryMaxTime: 0, // 一旦发生后端心跳响应不及时，就触发心跳延迟事件
    }
    const ws = initSocket(initSocketOptions, heartbeatOptions);
    
    if (ws == null) {
        Message('初始化WebSocket连接失败。您的浏览器不支持。');
        return null;
    }

    // 监听ws的打开事件，此时应该启动心跳检测
    ws.on(WSEventsMap.open, () => {
        Message('WebSocket 连接成功。');
        ws.startHeartBeat(); // 启动心跳检测
    });
    
    // 监听心跳包延迟事件，当心跳包不能按时推送到客户端就会调用
    ws.on(WSEventsMap.heartbeatOvertime, () => {
        // 等待时间达到阈值，3000ms间隔还发生延迟，说明网络极差，可以判断为断网了。
        if (ws.getHeartbeatTime() >= 3000) { 
            Message.error('网络不通，请切换网络。');
            // ws.dispose(); 此时可销毁实例
            return;
        }
        Message('网络拥堵，正在检测网络状态。');
        // 更新心跳间隔，及心跳包连续掉包允许次数
        // 每触发一次心跳延迟，就在原来的等待间隔上加500ms，并允许忽略一次
        ws.startHeartBeat(ws.getHeartbeatTime() + 500, 1); 
    })

    ws.connect();
    return ws;
}
```



## 配置断线重连

当发生断线，一般是服务问题，可能是服务宕机了，需要前端重新发起连接。

> 断线的情况和心跳检测是两个范畴。心跳检测是判断客户端网络状态，并提醒用户修复网络。

处理思路：

+ 监听关闭事件，当发生关闭事件，则重新发起连接，并记录重连次数，如果重连次数达到阈值，提示用户连接不可用。

  > 原生WebSocket实例中，当初始化的地址无法连接，会先触发error，再触发close事件，但后端中断连接，只会触发close事件。socket-webox也遵守了该流程。一般只要处理close事件即可。

+ socket-webox实例上提供connect方法，会先销毁旧的WebSocket实例资源，再初始化一个新的WebSocket实例。已注册的事件会应用到新的实例上，例如监听的open、error、close事件会被应用到新的连接实例上。

```js
import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui'

export function newSocketWebox() {
    const initSocketOptions = {
        url: "ws://127.0.0.1:7070/ws/?name=user1",
        receiveEventKey: 'msgMode'
    }
    const ws = initSocket(initSocketOptions);
    
    if (ws == null) {
        Message('初始化WebSocket连接失败。您的浏览器不支持。');
        return null;
    }
    
    let reConnectCount = 0; // 当WebSocket异常关闭，重新连接的次数
    const reConnectMaxCount = 3; // 最大重连次数
    let reConnectTimmer = null; // 重连计时器，避免重连间隔太短

    // 监听ws的打开事件，成功打开重置重试次数
    ws.on(WSEventsMap.open, () => {
        Message.success('WebSocket 连接成功。');
        reConnectCount = 0; // 重置重连次数
    });
    
    // 监听当前WebSocket实例连接关闭事件。初始连接失败会触发error、close、后端中断只会触发close
    ws.on(WSEventsMap.close, () => {
        // 连续重连次数小于最大尝试重连次数
        if (reConnectCount < reConnectMaxCount) {
            // 使用定时器发起重连，防止重连太频繁
            reConnectTimmer = setTimeout(() => {
                reConnectCount++;
                Message('WebSocket 断开连接，正在尝试第' + reConnectCount + '次重新连接。');
                // connect()每次调用都会先销毁旧的WebSocket实例再初始化一个新的。已注册的事件会应用到新的实例上。
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
        Message('WebSocket连接出现错误。请刷新页面');
    })

    // 发起连接。
    ws.connect();
    return ws;
}
```



## 完整配置

```js
import initSocket, { WSEventsMap } from 'socket-webox';
import { Message } from 'element-ui'

export function newSocketWebox() {
    const initSocketOptions = {
        url: "ws://127.0.0.1:7070/ws/?name=user1",
        receiveEventKey: 'msgMode'
    }
    const heartbeatOptions = {
        heartbeatMsg: { msgMode: 'heartbeat', msg: null },
        receivedEventName: 'heartbeat',
        heartbeatTime: 1500,
        retryMaxTime: 0, 
    }
    
    let reConnectCount = 0; 
    const reConnectMaxCount = 3; 
    let reConnectTimmer = null; 
    
    const ws = initSocket(initSocketOptions, heartbeatOptions);
    
    if (ws == null) {
        Message('初始化WebSocket连接失败。您的浏览器不支持。');
        return null;
    }
    
    // 监听ws的打开事件，成功打开重置重试次数；打开心跳检测
    ws.on(WSEventsMap.open, () => {
        Message.success('WebSocket 连接成功。');
        reConnectCount = 0; // 重置重连次数
        ws.startHeartBeat(); // 启动心跳检测
    });
    
    // 监听心跳包延迟事件，当心跳包不能按时推送到客户端就会调用
    ws.on(WSEventsMap.heartbeatOvertime, () => {
        if (ws.getHeartbeatTime() >= 3000) { 
            Message.error('网络不通，请切换网络。');
            return;
        }
        Message('网络拥堵，正在检测网络状态。');
        ws.startHeartBeat(ws.getHeartbeatTime() + 500, 1); 
    })
    
    // 监听当前WebSocket实例连接关闭事件。初始连接失败会触发error、close、后端中断只会触发close
    ws.on(WSEventsMap.close, () => {
        if (reConnectCount < reConnectMaxCount) {
            reConnectTimmer = setTimeout(() => {
                reConnectCount++;
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
        Message('WebSocket连接出现错误。请刷新页面');
    })

    // 发起连接。
    ws.connect();
    return ws;
}
```

组件A中使用：

+ 如果是在vue中使用，可挂载到vue原型上，然后各个组件都可访问。

```html
<template>
  <div> test-1:{{ msg }} </div>
</template>

<script>
import { newSocketWebox } from '@/utils/newSocketWebox';
export default {
  name: 'test-1',
  data() {
    return { msg:null }
  },
  mounted() {
    const ws = newSocketWebox();
    if (ws == null) return;
    this.ws = ws;
    this.ws.on('update-test1', (data) => {
        this.msg = data;
    })
  },
  destory() {
    // this.ws?.off('update-test1')
    this.ws?.dispose();
  }
}
</script>
```

