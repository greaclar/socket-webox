<template>
    <div>
        <div class="ipt-contain">
            <el-input placeholder="请输入内容" v-model="wsMsg.msgMode">
                <template slot="prepend">msgMode</template>
            </el-input>
            <el-input placeholder="请输入内容" v-model="wsMsg.msg">
                <template slot="prepend">msg</template>
            </el-input>
        </div>
        <div class="btn-contain">
            <el-button @click="getWS">log实例</el-button>
            <el-button @click="send">send</el-button>
            <el-button @click="pauseHeartbeat">暂停心跳检测</el-button>
            <el-button @click="startHeartBeat">开启心跳检测</el-button>
            <el-button @click="connect">重连</el-button>
            <el-button @click="dispose">关闭ws</el-button>
        </div>
    </div>
</template>

<script>
import { newWS } from '@/utils/initSocket';

export default {
    name: 'test-socket',
    provide() {
        // 父组件中通过provide来提供变量，在子组件中通过inject来注入变量。
        return {
            WS: this.WS,
        }
    },
    data() {
        return {
            wsMsg: {
                msgMode: 'message',
                msg: 'hellow'
            }
        }
    },
    beforeCreate() {
        this.WS = newWS();
        if (this.WS == null) {
            alert('WebSocket创建失败')
            return;
        }
        this.WS?.on('update', (data) => {
            console.log('update', data);
        });
    },
    destroyed() {
        console.log('destory', this.WS?.dispose());
    },
    methods: {
        send() {
            this.WS?.sendMsg(this.$data.wsMsg)
        },
        pauseHeartbeat() {
            this.WS?.pauseHeartbeat();
        },
        startHeartBeat() {
            this.WS?.startHeartbeat();
        },
        connect() {
            this.WS?.connect();
        },
        dispose() {
            this.WS?.dispose();
        },
        getWS() {
            console(this.WS?.getWebSocket());
        }
    },

}
</script>
<style scoped lang='scss'>
.ipt-contain,
.btn-contain {
    display: flex;
    justify-content: space-evenly;
}
</style>