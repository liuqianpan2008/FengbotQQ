//PLUGIN sakulin.ts

import axios from 'axios';
import { param, plugins, runcod } from '../lib/decorators.js';
import 'reflect-metadata';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from 'node-napcat-ts';
import * as fs from 'fs';
import { RootObject } from '../interface/sakulin.js';
import { qqBot } from '../app.js';
import { uuid } from '@renmu/bili-api/dist/utils/index.js';



const imgSourceMap: { [key: string]: string } = {
    "二次元": "https://app.zichen.zone/api/acg/api.php",
    "原神": "https://t.alcy.cc/ysz",
    "三次元": "https://api.lolimi.cn/API/tup/xjj.php",
    "碧蓝档案": "https://image.anosu.top/pixiv/direct?r18=0&keyword=bluearchive",
    "碧蓝航线": "https://image.anosu.top/pixiv/direct?r18=0&keyword=azurlane",
    "明日方舟": "https://image.anosu.top/pixiv/direct?r18=0&keyword=arknights",
    "公主连接": "https://image.anosu.top/pixiv/direct?r18=0&keyword=princess",
    "东方": "https://image.anosu.top/pixiv/direct?r18=0&keyword=touhou"
};

const defaultSource = "二次元";

const imageSourceDesc = Object.keys(imgSourceMap).map(e => ((e == defaultSource) ? (e + "（默认）") : e)).join("、");


@plugins({
    easycmd: true,
    name: "【推荐】红磷的黑科技工具箱，输入 #sakulass 查看具体使用方法",
    version: "1.0.0",
    describe: "日常制作许多有趣好玩的工具箱，如果有什么更好的想法可联系作者活性红磷 😄",
    author: "活性红磷",
    help: {
        enabled: false,
        description: "查看帮助信息"
    }
})
export class sakulass {

    @runcod(["help", "帮助"], "查看帮助信息")
    async help() {
        return {
            template: {
                enabled: true,
                sendText: false,
                html: `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
    <h1 style="color: #333; text-align: center;">红磷的黑科技工具箱 - 插件文档</h1>
    <h2 style="color: #555; margin-top: 30px;">插件信息</h2>
    <ul style="list-style-type: none; padding: 0;">
        <li><strong>ID:</strong> saku</li>
        <li><strong>名称:</strong> 【推荐】红磷的黑科技工具箱</li>
        <li><strong>版本:</strong> 1.0.0</li>
        <li><strong>描述:</strong> 日常制作许多有趣好玩的工具箱，如果有什么更好的想法可联系作者活性红磷 😄</li>
        <li><strong>作者:</strong> 活性红磷</li>
    </ul>
    <h2 style="color: #555; margin-top: 30px;">命令列表</h2>
    <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="color: #666;">help / 帮助</h3>
        <p>查看帮助信息</p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 15px;">
        <h3 style="color: #666;">ping / test</h3>
        <p>这是一个测试用的命令，用来测试这个插件是否正常工作</p>
    </div>
    <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 15px;">
        <h3 style="color: #666;">图 / tu</h3>
        <p>从网上获取随机美图，可添加不同图源作为参数，例如发送 #saku 图 原神。目前可选的图源有：${imageSourceDesc}，如果想要更多的图源，可联系作者活性红磷添加</p>
    </div>
</div>
                `,
                render: {
                    width: 800,
                    fullpage: true
                }
            }
        }
    }

    @runcod(["ping", "test"], "这是一个测试用的命令，用来测试这个插件是否正常工作")
    async test() {
        return {
            template: {
                enabled: true,
                sendText: false,
                html: `
                <div>这是一个测试用的命令，用来测试这个插件是否正常工作</div>
                `
            }
        };
    }

    @runcod(["图", "tu"], `从网上获取随机美图，可添加不同图源作为参数，例如发送 #saku 图 原神来获取目前可选的图源有：${imageSourceDesc}，如果想要更多的图源，可联系作者活性红磷添加`)
    async image(
        @param("图源", "text", { type: 'text', data: { text: defaultSource } }, true) type: Receive["text"],
    ) {

        const source = imgSourceMap[type?.data?.text] ?? imgSourceMap[defaultSource];

        try {
            const response = await fetch(source);
            const blob = await response.blob();

            return {
                picture: {
                    enabled: true,
                    base64: Buffer.from(await blob.arrayBuffer()).toString("base64")
                }
            }
        } catch (e) {
            return `获取时发生错误：${JSON.stringify(e)}`;
        }
    }
    @runcod(["一言", "yiyan"], `获取随机的一励志鸡汤`)
    async yiyan() {
        try {
            const response = await axios.get('https://v1.hitokoto.cn/');
            const data = response.data.hitokoto;
            return {
                template: {
                    enabled: true,
                    sendText: false,
                    render: {
                        fullpage: true
                    },
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; border-radius: 10px;">
                            <h1 style="color: #333; text-align: center;">随机的一励志鸡汤</h1>
                            <p style="color: #666; font-size: 18px; text-align: center;">${data}</p>
                        </div>
                    `,
                }
            }
        } catch (e) {
            return `获取时发生错误：${JSON.stringify(e)}`;
        }
    }

    @runcod(["jm", "jmc", "禁漫", "禁漫天堂"], `老司机必备`)
    async jm(@param("id", "text") jid: Receive["text"],
        @param("episode", "text", { type: 'text', data: { text: "1" } }, true) episode: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const host = '127.0.0.1'
        const port = 24357
        let id = 0;
        if (!Number.isInteger(Number(jid?.data?.text))) {
            //随机5-8位数
            id = Math.floor(Math.random() * (899999 - 100000 + 1)) + 100000;
        }else{
            id = Number(jid?.data?.text);
        }
        if (!Number.isInteger(episode?.data?.text ?? 1)) {
            return `请输入正确的章节`
        }

        const target: RootObject | undefined = await new Promise<RootObject | undefined>((resolve) => {
            const ws = new WebSocket(`ws://${host}:${port}`);
            ws.onopen = () => {
                ws.send(JSON.stringify({ id }));
            }
            ws.onmessage = (res) => {
                const responseData = JSON.parse(res.data)
                if (responseData["SIGNAL"] === "RESPONSE") {
                    ws.close(1000);
                    resolve(responseData);
                }
            }
        }).catch(e => {
            console.log(e);
            return void 0;
        });
        if (!target) {
            return "好像发生了点异常？能联系开发者看看发生什么了吗";
        }
        if (target.success) {
            if (target.pdf.length) {
                let numberEpisode = Number(episode?.data?.text ?? 1);
                --numberEpisode;
                const filename = `${uuid()}.pdf`;
                const isGroupMessage = context.message_type === 'group';
                if (isGroupMessage && context.group_id) {
                    await qqBot.upload_group_file({
                        group_id: Number(context.group_id),
                        file: 'data:file;base64,' + await this.fileToBase64(target.pdf[numberEpisode]),
                        name: filename
                    })
                } else {
                    await qqBot.upload_private_file({
                        user_id: Number(context.sender.user_id),
                        file: 'data:file;base64,' + await this.fileToBase64(target.pdf[numberEpisode]),
                        name: filename
                    })

                }
                return `已发送`
            }
        }

    }
    async fileToBase64(filePath: string) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.toString('base64'));
                }
            });
        });
    }
}