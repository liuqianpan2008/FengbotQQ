import { param, plugins, runcod } from "../lib/decorators.js";
import { Rcon } from "rcon-client"
import { Permission } from '../lib/Permission.js';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from "node-napcat-ts";
import { mccfg } from "../lib/config.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs'
import { qqBot } from "../app.js";

@plugins({
    easycmd: true,
    name: "我的世界工具箱",
    version: "0.0.1",
    describe: "这是一个我的世界工具箱，用来管理你的服务器",
    author: "枫叶秋林",
    help: {
        enabled: true,
        description: "查看帮助信息"
    }
})
export class mc {
    rcon: Rcon
    constructor() {
        this.rcon = new Rcon({
            host: mccfg.host,
            port: mccfg.port,
            password: mccfg.password
        })
        qqBot.on('notice.group_decrease', async (context) => {
            if (!context.user_id) {
                return
            }
            const plId = await this.readpl(context.user_id)
            if (plId?.plId) {
                try {
                    const rcon = await this.rcon.connect()
                    if (context.sub_type === 'kick') {
                        const res = await rcon.send(`ban ${plId?.plId}`)
                        await this.deletepl(context.user_id)
                        qqBot.send_group_msg({
                            group_id: context.group_id,
                            message: [{
                                type: "text",
                                data: {
                                    text: `群友:${context.user_id}被踢出,玩家${plId.plId}已被封禁!:\n
                                           指令执行结果：${res}`
                                }
                            }]
                        })
                        return
                    }
                    if (context.sub_type === 'leave') {
                        const res = await rcon.send(`whitelist remove ${plId?.plId}`)
                        if (res.includes(`Removed ${plId?.plId} from the whitelist`)) {
                            await this.deletepl(context.user_id)
                            qqBot.send_group_msg({
                                group_id: context.group_id,
                                message: [{
                                    type: "text",
                                    data: {
                                        text: `群友:${context.user_id}离开群了,玩家${plId.plId}已移除白名单!`
                                    }
                                }]
                            })
                        }
                    }
                    rcon.end()
                } catch (error) {
                    console.log(error)
                }
            } else {
                qqBot.send_group_msg({
                    group_id: context.group_id,
                    message: [{
                        type: "text",
                        data: {
                            text: `群友:${context.user_id}离开群了,但是玩家${plId}不在白名单!`
                        }
                    }]
                })
            }
        })
    }

    @runcod(["list", "在线玩家"], "查看在线玩家") //命令描述，用于显示在默认菜单中
    async list() {
        try {
            const rcon = await this.rcon.connect()
            const res = await rcon.send("list")
            const players = res.split(":");
            rcon.end()
            return players[1]
        } catch (error) {
            return "连接失败"
        }
    }
    @Permission('Admin')
    @runcod(["指令", "cmd"], "运行指令") //命令描述，用于显示在默认菜单中
    async cmd(@param("执行指令", 'text') runcod: Receive["text"]) {//参数装饰器，用于解析参数) {
        try {
            const rcon = await this.rcon.connect()
            runcod.data.text = runcod.data.text?.replace(/,/g, ' ')
            const res = await rcon.send(runcod?.data?.text ?? '')
            rcon.end()
            return res
        } catch (error) {
            return "连接失败"
        }
    }
    @runcod(["绑定", ""], "绑定玩家") //命令描述，用于显示在默认菜单中
    async bindPl(@param("Id", 'text') pId: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        const seedId = context?.sender?.user_id ?? null
        const plId = pId?.data?.text ?? null
        if (!seedId || !plId) {
            return "绑定失败"
        }
        try {
            const rcon = await this.rcon.connect()
            const res = await rcon.send(`whitelist add ${plId}`)
            //Added feng_linH to the whitelist
            if (res.includes(`Added ${plId} to the whitelist`)) {
                await this.savepl(seedId, plId)
                return "绑定成功!"
            }
            rcon.end()
            return res
        } catch (error: any) {
            return `绑定失败:${error.message}`
        }
    }

    @runcod(["解绑", ""], "解绑玩家") //命令描述，用于显示在默认菜单中
    async unBindPl(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        const seedId = context?.sender?.user_id ?? null
        if (!seedId) {
            return "解绑失败"
        }
        try {
            const plId = await this.readpl(seedId)
            if (!plId) {
                return "解绑失败"
            }
            const rcon = await this.rcon.connect()
            const res = await rcon.send(`whitelist remove ${plId}`)
            //Removed feng_linH from the whitelist
            if (res.includes(`Removed ${plId} from the whitelist`)) {
                await this.savepl(seedId, '')
                return "解绑成功!"
            }
            rcon.end()
            return res
        } catch (error: any) {
            return `解绑失败:${error.message}`
        }
    }



    private async savepl(seedId: number, plId: string): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        //json
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'mcData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[seedId]) {
            data[seedId].plId = plId;
            data[seedId].updatetime = new Date().getTime()
        } else {
            data[seedId] = {
                plId,
                createtime: new Date().getTime(),
                updatetime: new Date().getTime(),
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }

    private async readpl(seedId: number): Promise<{ plId: string, createtime: number, updatetime: number } | undefined> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'mcData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[seedId]) {
                return data[seedId];
            }
        }
        if (data[seedId]) {
            return data[seedId];
        }
    }
    //deletepl
    private async deletepl(seedId: number): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'mcData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[seedId]) {
                delete data[seedId];
                fs.writeFileSync(filePath, JSON.stringify(data));
            }
        }
    }



}
