import { qqBot } from "../app.js";
import { plugins } from "../lib/decorators.js";
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, RequestGroupAdd } from "node-napcat-ts/dist/Interfaces.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { param, runcod } from '../lib/decorators.js';
import { FileSegment, ImageSegment, Receive } from "node-napcat-ts";
import { Permission } from "../lib/Permission.js";
import { addProp, prop } from "../lib/prop.js";
import { addCoins, getUserData, removeCoins, saveUserData } from "../lib/economy.js";
import { uuid } from "@renmu/bili-api/dist/utils/index.js";

async function convertImageToBase64(filePath: string): Promise<string> {
    try {
        const fileData = await fs.promises.readFile(filePath);
        return `data:image/jpeg;base64,${fileData.toString('base64')}`;
    } catch (error) {
        console.error('图片转换失败:', error);
        return '';
    }
}
let lmsg = '';
@plugins({
    easycmd: true,
    name: "qq群工具箱",
    version: "0.0.1",
    describe: "qq群工具箱",
    author: "枫叶秋林",
    help: {
        enabled: true,
        description: "查看帮助信息"
    }
})
export class Group {
    constructor() {
        qqBot.on("request.group.add", async (e: RequestGroupAdd) => {
            e.quick_action(true)
            await qqBot.send_group_msg({
                group_id: Number(e.group_id),
                message: [{
                    type: "text",
                    data: {
                        text: `欢迎${e.user_id}加入群聊`
                    }

                }]
            })

        })
        //检测违禁词
        qqBot.on("message", async (e) => {
            if (e.message_type !== "group") {
                return;
            }
            const group_id = e.group_id;
            const worldData = await this.readpl(group_id);
            if (worldData?.worldData) {
                let ban = false;
                let words = "";
                e.message.forEach(async (item) => {
                    if (item.type === "text") {
                        const index = worldData.worldData.indexOf(item.data.text);
                        if (index !== -1) {
                            words += item.data.text + ",";
                            ban = true
                        }
                    }
                })
                if (ban) {
                    await qqBot.set_group_ban({
                        group_id: Number(e.group_id),
                        user_id: Number(e.user_id),
                        duration: 60 * 60,
                    })
                    await qqBot.delete_msg({
                        message_id: e.message_id,
                    })
                    await qqBot.send_group_msg({
                        group_id: Number(e.group_id),
                        message: [{
                            type: "text",
                            data: {
                                text: `触发违禁词:${words},群友${e.sender.nickname}(${e.sender.user_id})已被禁言1小时`,
                            }
                        }]
                    })
                }

            }
            if (worldData?.userData) {
                for (let i = 0; i < worldData.userData.length; i++) {
                    const index = worldData.userData[i].indexOf(e.sender.user_id.toString());
                    if (index !== -1) {
                        let probability = worldData.userData[index].split(":")[1];
                        if (Math.random() < Number(probability)) {
                            await qqBot.set_group_ban({
                                group_id: Number(e.group_id),
                                user_id: Number(e.sender.user_id),
                                duration: 60 * 10,
                            })
                        }
                    }
                }
            }
            // 事件监测
            let msg = await this.runEvent(e.sender.user_id, Number(e.group_id));
            if (msg) {
                await qqBot.send_group_msg({
                    group_id: Number(e.group_id),
                    message: [{
                        type: "text",
                        data: {
                            text: msg,
                        }
                    }]
                })
            }
            // 关键词回复
            if (e.message[0]?.type === "text") {
                const text = e.message[0]?.data?.text
                if (lmsg != e.message[0]?.data?.text) {
                    lmsg = e.message[0]?.data?.text;
                    if (text) {
                        let data = await this.getKeywordReply(group_id, text)
                        if (!data) {
                            return
                        }
                        let msg = ((data as any).data.content) as any
                        //console.log(JSON.stringify(msg));
                        for (let i = 0; i < msg.length; i++) {
                            if (msg[i].type == 'image') {
                                const image = msg[i]  as ImageSegment
                                (msg[i] as ImageSegment).data = {
                                    file: await convertImageToBase64(image.data.file),
                                }
                            }
                        }
                        ((data as any).data.content) = msg
                        
                        await qqBot.send_group_msg({
                            group_id: Number(e.group_id),
                            message: [data as any],
                        })
                        lmsg = '';
                    }
                }
            }
        })
        //群邀请直接同意
        qqBot.on("request.group.invte", async (e) => {
            e.quick_action(true)
        })
    }




    @runcod(["添加违禁词", "addWorld", "违禁词"], "添加违禁词")
    async addBanWorld(@param("违禁词", 'text') world: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context.message_type !== "group") {
            return "请在群聊中使用";
        }
        if (!world?.data?.text) {
            return "请输入违禁词";
        }
        const group_id = context.group_id;
        const worldData = await this.readpl(group_id);
        if (worldData) {
            worldData.worldData.push(world.data.text);
            await this.savepl(group_id, worldData.worldData, worldData.userData);
            return "添加成功";
        } else {
            await this.savepl(group_id, [world.data.text], []);
            return "添加成功";
        }
    }
    //删除违禁词
    @runcod(["删除违禁词", "delWorld", "违禁词"], "删除违禁词")
    async delBanWorld(@param("违禁词", 'text') world: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context.message_type !== "group") {
            return "请在群聊中使用";
        }
        if (!world?.data?.text) {
            return "请输入违禁词";
        }
        const group_id = context.group_id;
        const worldData = await this.readpl(group_id);
        if (worldData) {
            const index = worldData.worldData.indexOf(world.data.text);
            if (index !== -1) {
                worldData.worldData.splice(index, 1);
                await this.savepl(group_id, worldData.worldData, worldData.userData);
                return "删除成功";
            }
            return "删除失败";
        }
    }

    @runcod(["查看违禁词", "viewWorld", "违禁词"], "查看违禁词")
    async viewBanWorld(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context.message_type !== "group") {
            return "请在群聊中使用";
        }
        const group_id = context.group_id;
        const worldData = await this.readpl(group_id);
        if (worldData) {
            return `当前群聊违禁词有:${worldData?.worldData?.join(",") ?? "无"}`;
        }
    }
    //禁言
    @Permission('Admin')
    @runcod(["禁言", "ban", "闭嘴"], "禁言")
    async banUser(@param("用户id", 'at') user_id: Receive["at"],
        @param("时间（s）", 'text', { type: 'text', data: { text: "60" } }, true) time: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        let timeNum = 60;
        if (time?.data?.text) {
            timeNum = Number(time.data.text);
        }
        const group_id = context.group_id;
        await qqBot.set_group_ban({
            group_id: Number(context.group_id),
            user_id: Number(user_id.data.qq),
            duration: Number(timeNum),
        })
        return `已禁言${user_id.data.qq} ${timeNum}s`;

    }
    //解除禁言
    @Permission('Admin')
    @runcod(["解除禁言", "unban", "说话"], "解除禁言")
    async unbanUser(@param("用户id", 'at') user_id: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        const group_id = context.group_id;
        const worldData = await this.readpl(group_id);

        await qqBot.set_group_ban({
            group_id: Number(context.group_id),
            user_id: Number(user_id.data.qq),
            duration: 0,
        })
        return `已解除禁言${user_id.data.qq}`;

    }
    //开启某人说话随机禁言
    @Permission('Admin')
    @runcod(["随机禁言", "banUser", "禁言"], "开启某人说话随机禁言")
    async banUserRandom(@param("用户id", 'at') user_id: Receive["at"],
        @param("概率（0-1之间）", 'text', { type: 'text', data: { text: "0.5" } }, true) probability: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        let probabilityNum = 0.5;
        if (probability?.data?.text) {
            probabilityNum = Number(probability.data.text);
        }
        const group_id = context.group_id;
        const worldData = await this.readpl(group_id);
        if (worldData) {
            worldData.userData.push(`${user_id.data.qq}:${probabilityNum}`);
            await this.savepl(group_id, worldData.worldData, worldData.userData);
            return `已开启${user_id.data.qq}说话随机禁言`;
        }
    }

    @prop("banProp", "禁言卡", 1, "对一位群友进行禁言10分钟操作",
        await convertImageToBase64("/Users/fenglin/Desktop/botQQ/src/resources/test/Prop/ban.jpg"),
        1000
    )
    async banProp(
        userId: string,
        propparam: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        if (context?.message_type === 'group') {
            await qqBot.set_group_ban({
                group_id: Number(context.group_id),
                user_id: Number(userId),
                duration: 60 * 10,
            })
        }
        return `操作成功！`
    }

    @prop("eventCard", "事件卡", 1, "无视概率，执行一次某个事件",
        await convertImageToBase64("/Users/fenglin/Desktop/botQQ/src/resources/test/Prop/eventCard.jpg"),
        1000
    )
    async eventCard(
        userId: string,
        propparam: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupEventData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        let msg = ''
        let eventId = propparam?.data?.text ?? '-1'
        if (context?.message_type !== 'group') {
            return '请在群聊中使用';
        }
        if (!data[context.group_id]) {
            return '本群无事件';
        }
        let events = data[context.group_id]

        const event = events[eventId];
        const protect = await this.protectEvent(userId.toString())
        if (protect.success) {
            return `触发事件${event.eventContent}但是由于有保护次数，所以事件不生效，剩余保护次数${protect.event}`
        }
        if (event) {
            switch (event.eventRewardType) {
                case '道具':
                    addProp(userId.toString(), event.param, event.eventRewardNum)
                    msg += `触发事件：${event.eventContent}，获得${event.param}道具\n`
                    break;
                case '金币':
                    //执行金币奖励
                    if (event.eventRewardNum >= 0) {
                        msg += `触发事件：${event.eventContent}获得${event.eventRewardNum}金币\n`
                        addCoins(userId.toString(), Number(event.eventRewardNum), msg)

                    } else {
                        msg += `触发事件：${event.eventContent}失去${-event.eventRewardNum}金币\n`
                        removeCoins(userId.toString(), Number(-event.eventRewardNum), msg)

                    }
                    break;
                case '禁言':
                    if (event.eventRewardNum >= 0) {
                        qqBot.set_group_ban({
                            group_id: Number(context.group_id),
                            user_id: Number(userId),
                            duration: 60 * event.eventRewardNum,
                        })
                        msg += `触发事件：${event.eventContent}获得${event.eventRewardNum}分钟禁言`
                    } else {
                        qqBot.set_group_ban({
                            group_id: Number(context.group_id),
                            user_id: Number(userId),
                            duration: 0,
                        })
                        msg += `触发事件：${event.eventContent}解除禁言`
                    }
                    break;
            }
        } else {
            msg += `无效事件，无奖励`
        }
        return msg;


    }
    //保护卡
    @prop("protectCard", "保护卡", 1, "触发事件时保护次数减1",
        await convertImageToBase64("/Users/fenglin/Desktop/botQQ/src/resources/test/Prop/protectCard.jpg"),
        1000
    )
    async protectCard(
        userId: string,
        propparam: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const userData = getUserData(userId);
        if (userData) {
            userData.events++;
            saveUserData(userId, userData);
            return `操作成功！当前保护次数${userData.events}`
        }
    }

    async protectEvent(userId: string): Promise<{
        success: boolean,
        event: number
    }> {
        const userData = getUserData(userId);
        if (userData) {
            if (Number.isNaN(userData.events)) {
                userData.events = 0;
            }
            if (userData.events <= 0) {
                return {
                    success: false,
                    event: userData.events
                }
            }
            userData.events--;
            saveUserData(userId, userData);
            return {
                success: true,
                event: userData.events
            }
        }

        return {
            success: false,
            event: 0
        }
    }

    //设置事件
    @runcod(["设置事件", "setEvent"], "设置事件")
    async setEvent(
        @param("事件内容", "text") eventContent: Receive["text"],
        @param("事件奖励类别", "text") eventRewardType: Receive["text"],
        @param("事件奖励数量", "text") eventRewardNum: Receive["text"],
        @param("事件奖励概率", "text") probability: Receive["text"],
        @param("事件奖励参数", "text", { type: 'text', data: { text: "" } }, true) param: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        if (eventRewardType?.data?.text !== '道具' && eventRewardType?.data?.text !== '金币' && eventRewardType?.data?.text !== '禁言') {
            return "事件奖励类别错误,请选择道具、金币、禁言";
        }

        let Num = 1
        if (eventRewardNum?.data?.text) {
            Num = Number(eventRewardNum?.data?.text);
        }

        let probabilityNum = 0.3
        if (probability?.data?.text) {
            probabilityNum = Number(probability.data.text);
        }

        //道具时候填写参数
        if (eventRewardType?.data?.text === '道具') {
            if (!param?.data?.text) {
                return "道具时候填写参数";
            }
        }

        const eventId = uuid();
        this.saveEvent(context.group_id, eventId, eventContent.data.text, eventRewardType.data.text, Num, probabilityNum, param?.data?.text ?? '');
        return `事件设置成功,事件id:${eventId}`;
    }

    //保存事件
    private async saveEvent(group_id: number, eventId: string, eventContent: string, eventRewardType: '道具' | '金币' | '禁言', eventRewardNum: number = 1, probability: number = 0.3, param: string = '') {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupEventData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[group_id]) {
            data[group_id][eventId] = {
                eventContent: eventContent,
                eventRewardType: eventRewardType,
                param: param,
                eventRewardNum: Number(eventRewardNum),
                probability: Number(probability),
            }
        }
        else {
            data[group_id] = {};
            data[group_id][eventId] = {
                eventContent: eventContent,
                eventRewardType: eventRewardType,
                param: param,
                eventRewardNum: Number(eventRewardNum),
                probability: Number(probability),
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
    }

    async getAllEvent(group_id: number) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupEventData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        let eventIdAndProbability = '事件列表:\n'
        if (!data[group_id]) {
            return '本群没有事件';
        }
        Object.keys(data[group_id]).forEach((key) => {
            if (key !== '') {
                eventIdAndProbability += `事件id:${key},事件内容:${data[group_id][key].eventContent},事件奖励类别:${data[group_id][key].eventRewardType},事件奖励数量:${data[group_id][key].eventRewardNum},事件奖励概率:${data[group_id][key].probability},事件奖励参数:${data[group_id][key].param}\n`;
            }
        })
        return eventIdAndProbability;
    }

    @runcod(["事件列表", "getEvent"], "获取事件")
    async getEvent(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        const eventIdAndProbability = await this.getAllEvent(context.group_id);
        return eventIdAndProbability;
    }

    async runEvent(user_id: number, group_id: number) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupEventData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        let msg = ''
        let eventId = ''

        if (!data[group_id]) {
            return '';
        }
        let events = data[group_id]
        for (let i = 0; i < Object.keys(events).length; i++) {
            if (Object.keys(events)[i] === '') {
                continue;
            }
            let randomNum = Math.random();
            if (randomNum >= events[Object.keys(events)[i]].probability) {
                continue;
            } else {
                const event = events[Object.keys(events)[i]];
                if (event) {
                    const protect = await this.protectEvent(user_id.toString())
                    if (protect.success) {
                        return `触发事件${event.eventContent}但是由于有保护次数，所以本次事件不生效，剩余保护次数${protect.event}`
                    }
                    switch (event.eventRewardType) {
                        case '道具':
                            addProp(user_id.toString(), event.param, event.eventRewardNum)
                            msg += `触发事件：${event.eventContent}，获得${event.param}道具\n`
                            break;
                        case '金币':
                            //执行金币奖励
                            if (event.eventRewardNum >= 0) {
                                msg += `触发事件：${event.eventContent}获得${event.eventRewardNum}金币\n`
                                addCoins(user_id.toString(), Number(event.eventRewardNum), msg)

                            } else {
                                msg += `触发事件：${event.eventContent}失去${-event.eventRewardNum}金币\n`
                                removeCoins(user_id.toString(), Number(-event.eventRewardNum), msg)

                            }
                            break;
                        case '禁言':
                            if (event.eventRewardNum >= 0) {
                                qqBot.set_group_ban({
                                    group_id: Number(group_id),
                                    user_id: Number(user_id),
                                    duration: 60 * event.eventRewardNum,
                                })
                                msg += `触发事件：${event.eventContent}获得${event.eventRewardNum}分钟禁言`
                            } else {
                                qqBot.set_group_ban({
                                    group_id: Number(group_id),
                                    user_id: Number(user_id),
                                    duration: 0,
                                })
                                msg += `触发事件：${event.eventContent}解除禁言`
                            }
                            break;
                    }
                }
            }
        }
        return msg;
    }

    private async savepl(group_id: number, worldData: string[], userData: string[]): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupWorldData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[group_id]) {
            data[group_id].worldData = worldData;
            data[group_id].userData = userData;
            data[group_id].updatetime = new Date().getTime()
        } else {
            data[group_id] = {
                worldData,
                userData,
                createtime: new Date().getTime(),
                updatetime: new Date().getTime(),
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }

    private async readpl(group_id: number): Promise<{ worldData: string[], userData: string[] } | undefined> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupWorldData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[group_id]) {
                return { worldData: data[group_id].worldData, userData: data[group_id].userData ?? [] };
            }
        } else {
            return { worldData: [], userData: [] };
        }
    }

    @runcod(["记录关键词", "Key","key"], "记录关键词")
    async SaveKey(
        @param("key", 'text')
        keyword: Receive["text"],
        @param("引用", 'reply') reply: Receive["reply"],//引用参数必须是最后一个
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        const msg = await qqBot.get_msg({
            message_id: Number(reply.data.id),
        })
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        for (let i = 0; i < msg.message.length; i++) {
            if (msg.message[i].type == 'image') {
                const image = msg.message[i]  as ImageSegment
                let imagePath = path.join('/Volumes/liuqianpan2008/MACServer/Keyimage', image.data.file)
                await this.downloadFile((image?.data as any).url, imagePath);
                (msg.message[i] as ImageSegment).data = {
                    file: imagePath,
                }
            }
            if(msg.message[i].type == 'file'){
                const file = msg.message[i]  as FileSegment
                (msg.message[i] as FileSegment) ={
                    type:'file',
                    data:{
                        file:file.data.file
                    }
                }
                let filePath = path.join('/Volumes/liuqianpan2008/MACServer/Keyimage', file.data.file)
                await this.downloadFile((file?.data as any).url, filePath);
                (msg.message[i] as FileSegment).data.file = filePath
            }
        }
        const nodemsg={
            "type": "node",
            "data": {
                "user_id": msg.sender.user_id, // [发]
                "nickname": msg.sender.nickname, // [发]
                "content": msg.message
            }
        }
        await this.saveKeywordReply(context.group_id, keyword.data.text,nodemsg);
        return "记录成功";
    }

    //删除关键词
    @runcod(["删除关键词", "delkey", "delKey"], "删除关键词")
    async delKey(
        @param("key", 'text')
        keyword: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        await this.delKeywordReply(context.group_id, keyword.data.text);
        return "删除成功";
    }

    //查看关键词
    @runcod(["查看关键词", "viewkey", "viewKey"], "查看关键词")
    async viewKey(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (context?.message_type !== "group") {
            return "请在群聊中使用";
        }
        const reply = await this.getAllKeyBygroup(context.group_id);
        if (reply) {
            return reply;
        } else {
            return "关键词不存在";
        }
    }


    //保存关键词回复
    private async saveKeywordReply(group_id: number, keyword: string, reply: any): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupKeywordReply.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[group_id]) {
            data[group_id][keyword] = reply;
        } else {
            data[group_id] = {
                [keyword]: reply,
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }

    private async getAllKeyBygroup(group_id: number){
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupKeywordReply.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[group_id]) {
                return Object.keys(data[group_id]);
            }
        }
        return "";
    }
    //获取关键词回复
    private async getKeywordReply(group_id: number, keyword: string): Promise<string> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupKeywordReply.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[group_id]) {
                return data[group_id][keyword];
            }
        }
        return "";
    }
    //删除关键词回复
    private async delKeywordReply(group_id: number, keyword: string): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'GroupKeywordReply.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[group_id]) {
                delete data[group_id][keyword];
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }
    //下载文件
    private async downloadFile(url: string, path: string) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(path, buffer);
    }

}