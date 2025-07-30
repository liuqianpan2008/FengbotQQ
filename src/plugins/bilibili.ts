//PLUGIN bilibili.ts

import { param, plugins, runcod, schedule } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import botlogger from '../lib/logger.js';
import * as fs from 'fs'
import { GroupMessage, ImageSegment, PrivateFriendMessage, PrivateGroupMessage, Receive } from 'node-napcat-ts';
import { Client } from "@renmu/bili-api";
import { qqBot } from '../app.js';
import { HtmlImg } from '../lib/Puppeteer.js';
async function convertImageToBase64(filePath: string): Promise<string> {
    try {
        const fileData = await fs.promises.readFile(filePath);
        return `data:image/jpeg;base64,${fileData.toString('base64')}`;
    } catch (error) {
        console.error('图片转换失败:', error);
        return '';
    }
}
@plugins({
    easycmd: true,//是否启用简易命令，启用将将命令注册为<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "blibli", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "B站插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class blibli {
    private bilibili = new Client();
    constructor() {
        this.bilibili.setAuth({
            "bili_jct": "dd824efa742a8dbc536875da592c48a9",
            "SESSDATA": "48b568e6%2C1767151027%2C2a0e6%2A72CjBF4lmo9_M4rfAycCE9-8l6Wup4xX9WG10rXRpvUgvm3jAmeihZH5xXXlikN6tpaQsSVkt1VmEyLVE4UERVQjNTb3o1ODFBYS1nOFlCUmNndS1TeDJVRjg1UVRCT01KUDYyVkFORGZkaWVyWHZqZlZONUFCY1JpRHliU3RpbjV6bHdWdExKSGRBIIEC",
            "DedeUserID": "156627564",
        }, 156627564);
        botlogger.info("bilibili插件加载成功")

    }
    @runcod(["video", "bv", "视频"], "获取视频信息")
    async videoInfo(@param("BV号", 'text') bvId: Receive["text"]): Promise<any> {
        const video = this.bilibili.video;
        if (!bvId?.data?.text) {
            return "请输入BV号"
        }
        const info = await video.info({ bvid: bvId?.data?.text, })
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            info,
            template: { // 模板配置，用于发送图片内容
                enabled: true,//是否启用模板，启用将发送图片内容
                sendText: false,//是否发送文本，启用将发送文本内容，如果都启用则发送两条消息
                path: path.resolve(__dirname, '..', 'resources', 'bilibili', 'video-info.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            },
        };
    }

    @runcod(["三连"], "三连一个视频")
    async videolikeCoinShare(@param("BV号", 'text') bvId: Receive["text"], context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        const { bilibiliData } = await this.readpl(context?.sender?.user_id ?? null) ?? {}
        if (!bvId?.data?.text) {
            return "请输入BV号"
        }
        if (!bilibiliData?.DedeUserID || !bilibiliData?.bili_jct || !bilibiliData?.SESSDATA) {
            return "请先绑定bilibili帐号"
        }
        this.bilibili.setAuth(bilibiliData, Number(bilibiliData.DedeUserID));
        const video = this.bilibili.video;
        const vidoeoInfo = await video.info({ bvid: bvId?.data?.text, })
        video.aid = vidoeoInfo.aid;
        const like = await video.likeCoinShare({
            aid: vidoeoInfo.aid,
        })
        return `三连成功!${vidoeoInfo.title}点赞:${like.like}，投币:${like.coin},收藏:${like.fav}`;
    }
    @runcod(["videoDownload", "DlBV", "下载视频"], "下载视频")
    async videoDownload(@param("BV号", 'text') bvId: Receive["text"], context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (!bvId?.data?.text) {
            return "请输入BV号"
        }
        const { bilibiliData } = await this.readpl(context?.sender?.user_id ?? null) ?? {}
        if (!bilibiliData?.DedeUserID || !bilibiliData?.bili_jct || !bilibiliData?.SESSDATA) {
            return "请先绑定bilibili帐号"
        }
        this.bilibili.setAuth(bilibiliData, Number(bilibiliData.DedeUserID));
        const path = await this.downloadVideo(bvId?.data?.text);
        const isGroupMessage = context?.message_type === 'group';
        if (isGroupMessage && context.group_id) {
            await qqBot.send_group_msg({
                group_id: Number(context.group_id),
                message: [{
                    type: 'video',
                    data: {
                        file: 'data:file;base64,' + await this.fileToBase64(path),
                    }
                }]
            })
        } else {
            await qqBot.send_private_msg({
                user_id: Number(context.sender.user_id),
                message: [{
                    type: 'video',
                    data: {
                        file: 'data:file;base64,' + await this.fileToBase64(path),
                    }
                }]
            })

        }
        return '视频下载成功'

    }
    
    async downloadVideo(bvId: string): Promise<string> {
        if (!bvId) {
            return ""
        }
        const video = this.bilibili.video;
        const vidoeoInfo = await video.info({ bvid: bvId, })
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const output = '/Volumes/liuqianpan2008/MACServer/bilibili/'+`${vidoeoInfo.title}.mp4`;
        if (fs.existsSync(output)) {
            return output;
        }
        const download = await video.download({
            aid: vidoeoInfo.aid,
            bvid: vidoeoInfo.bvid,
            cid: vidoeoInfo.pages[0].cid,
            output: output,
            ffmpegBinPath:"/Users/fenglin/Desktop/botQQ/ffmpeg/ffmpeg",
        
        },{},true)
        return new Promise((resolve, reject) => {
            download.on('progress', (data) => {
                if (data.event === 'download') {
                    botlogger.info(`视频下载进度:${Math.floor(data.progress.progress * 100)}%,已下载:${data.progress.loaded},总大小:${data.progress.total}`);
                }
                
            })
            download.on('error', (data) => {
                botlogger.error(`视频下载失败:${data.message}`);

            })
            download.on('completed', (data) => {
                resolve(output);
            })
        })
    }

    @runcod(["获取视频评论", "获取评论",'BGC'], "获取视频评论")
    async getCommentByBV(@param("BV号", 'text') bvId: Receive["text"], context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (!bvId?.data?.text) {
            return "请输入BV号"
        }
        const uid = await this.getData(context);
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const comment = await this.getComment(bvId?.data?.text);
        botlogger.info(JSON.stringify(comment));
        let rdata: { userName: string; userAvatar: string; IPcaty: string; reply_time: string; msg: string; }[] = []
        comment.replies.forEach((item:any) => {
            const msg= item.content.message.replace(/@/g, '');
            const userName =item.member.uname;
            const userAvatar =item.member.avatar;
            const IPcaty =item.reply_control.location;
            const reply_time =item.reply_control.time_desc;
            rdata.push({
                userName,
                userAvatar,
                IPcaty,
                reply_time,
                msg,
            })
        })
        return {
            rdata:rdata,
            template: { // 模板配置，用于发送图片内容
                enabled: true,//是否启用模板，启用将发送图片内容
                sendText: false,//是否发送文本，启用将发送文本内容，如果都启用则发送两条消息
                path: path.resolve(__dirname, '..', 'resources', 'bilibili', 'video-reple.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            },
        };
    }

    //获取评论
    async getComment(bvId:string){
        if (!bvId) {
            return {}
        }
        const video = this.bilibili.video;
        const vidoeoInfo = await video.info({ bvid: bvId, })
        const reply = this.bilibili.reply;
        const comment = await reply.list({
            oid: vidoeoInfo.aid,
            type: 1,
        })
        return comment;
    }

    @runcod(["评论视频", "评论",'BC'], "评论视频")
    async commentVideo(
        @param("BV号", 'text') bvId: Receive["text"],
        @param("评论内容", 'text') comment: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
            if (!bvId.data?.text) {
                return "请输入BV号"
            }
            if (!comment?.data?.text) {
                return "请输入评论内容"
            }
        await this.getData(context);
        const vidoeoInfo = await this.getComment(bvId?.data?.text);
        const videoInfo = await this.bilibili.video.info({ bvid: bvId?.data?.text, })
        const commentRes = await this.bilibili.reply.add({
            oid: vidoeoInfo.aid,
            type: 1,
            message: comment?.data?.text,
            plat: 1,
        })
        return `视频${videoInfo.title}评论${comment?.data?.text}成功,评论id:${commentRes.rpid}`;
    }
       

    @runcod(["个人信息", "me", "我"], "查看我的信息")
    async info(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (!context?.sender?.user_id) {
            return "请先绑定bilibili帐号"
        }
        await this.getData(context);
        const info = await this.bilibili.user.getMyInfo();
        return `我的信息:${info.profile.name}，等级:${info.level_exp.current_level}，经验:${info.level_exp.current_exp}，硬币:${info.coins}`;
    }

    @runcod(["space", "空间"], "查看空间")
    async space(
        @param("mid", 'text', { type: "text", data: { text: "-1" } }, true) mid: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage): Promise<any> {
        if (!mid?.data?.text) {
            return "请输入mid"
        }
        const uid = await this.getData(context);
        const info = await this.getNewSpaceInfo(mid,context);
        botlogger.info(info.id_str);
        return `$${info.id_str}`;
    }

    //获取空间信息
    async getNewSpaceInfo(mid: Receive["text"],context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        if (!mid?.data?.text) {
            return {}
        }
        const uid = await this.getData(context);
        const info = await this.bilibili.user.space(Number(mid?.data?.text ?? uid)) as any;
        const data = info.items.filter((item:any) => item?.modules?.module_tag?.text !== '置顶')
        return data[0];
    }

    private async getNewspace(userid:number){
        if (!userid) {
            return {}
        }
        const { bilibiliData } = await this.readpl(null) ?? {}
        if (!bilibiliData?.DedeUserID || !bilibiliData?.bili_jct || !bilibiliData?.SESSDATA) {
            throw "无绑定的bilibili帐号"
        }
        this.bilibili.setAuth(bilibiliData, Number(bilibiliData.DedeUserID));
        const info = await this.bilibili.user.space(userid) as any;
        const data = info.items.filter((item:any) => item?.modules?.module_tag?.text !== '置顶')
        return data[0];
    }

    private async getData(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        const { bilibiliData } = await this.readpl(context?.sender?.user_id??null ) ?? {}
        if (!bilibiliData?.DedeUserID || !bilibiliData?.bili_jct || !bilibiliData?.SESSDATA) {
            throw "请先绑定bilibili帐号"
        }
        this.bilibili.setAuth(bilibiliData, Number(bilibiliData.DedeUserID));
        return bilibiliData.DedeUserID;
    }

    @runcod(["绑定", "绑"], "绑定blibli帐号") //命令描述，用于显示在默认菜单中
    async bindPl(@param("data", 'text') data: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
            if (!data?.data?.text) {
                return "请输入绑定数据"
            }
        const seedId = context?.sender?.user_id ?? null
        const bilibiliData: { bili_jct: string, SESSDATA: string, DedeUserID: string } = JSON.parse(data?.data?.text ?? "{}")
        if (bilibiliData.bili_jct && bilibiliData.SESSDATA && bilibiliData.DedeUserID) {
            await this.savepl(seedId, bilibiliData)
        }
        return "绑定成功!"
    }

    @runcod(["解绑", "解"], "解绑bilibili帐号") //命令描述，用于显示在默认菜单中
    async unBindPl(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
            if (!context?.sender?.user_id) {
                return "解绑失败"
            }
        const seedId = context?.sender?.user_id ?? null
        if (!seedId) {
            return "解绑失败"
        }
        try {
            await this.deletepl(seedId)
            return "解绑成功!"
        } catch (error: any) {
            return `解绑失败:${error.message}`
        }
    }

    private async savepl(seedId: number, bilibiliData: { bili_jct: string, SESSDATA: string, DedeUserID: string }): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        //json
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'bilibiliData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[seedId]) {
            data[seedId].bilibiliData = bilibiliData;
            data[seedId].updatetime = new Date().getTime()
        } else {
            data[seedId] = {
                bilibiliData,
                createtime: new Date().getTime(),
                updatetime: new Date().getTime(),
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }

    private async readpl(seedId: number | null): Promise<{ bilibiliData: { bili_jct: string, SESSDATA: string, DedeUserID: string }, createtime: number, updatetime: number } | undefined> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'bilibiliData.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (seedId) {
                if (data[seedId]) {
                    return data[seedId];
                }
            }
            //返回默认第一个
            return data[Object.keys(data)[0]];
        }
        return data[Object.keys(data)[0]];
    }

    private async deletepl(seedId: number): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'bilibiliData.json');
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
    @runcod(["订阅", "订"], "绑定blibli帐号") //命令描述，用于显示在默认菜单中
    async subscribe(@param("data", 'text') data: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage) {
        if (!context?.sender?.user_id) {
            return "请先绑定bilibili帐号"
        }
        const spaceId = data.data?.text ?? null
        if (!spaceId || Number.isNaN(Number(spaceId))) {
            return '请输入正确的bilibili空间id'
        }
        const NewSpace = await this.getNewspace(Number(spaceId));
        if (!NewSpace?.id_str) {
            return '无法获取到最新的动态，请检查输入id是否正确'
        }
        await this.testschedule()
        if (context?.message_type == "group") {
            await this.saveSpace(context?.group_id,spaceId,NewSpace.id_str,"group")
        }else{
            await this.saveSpace(context?.sender?.user_id,spaceId,NewSpace.id_str,"friend")
        }
        return `订阅成功!最新动态id为${NewSpace.id_str}`
    }
    async saveSpace(seedId: number, spaceId: string,NewSpace:string,type:"group"|"friend") {
        if (!seedId) {
            return
        }
        if (!spaceId) {
            return
        }
        if (!NewSpace) {
            return
        }
        if (!type) {
            return
        }

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'bilibiliSpace.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (data[seedId]) {
            const index = data[seedId].findIndex((item: any) => item.spaceId == spaceId);
            if (index != -1) {
                throw new Error("已订阅该空间")
            }
            data[seedId].push({
                NewSpace,
                seedId,
                type,
                spaceId,
                createtime: new Date().getTime(),
                updatetime: new Date().getTime(),
            })
        } else {
            data[seedId] = [{
                NewSpace,
                seedId,
                type,
                spaceId,
                createtime: new Date().getTime(),
                updatetime: new Date().getTime(),
            }]
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
    }
    //读取订阅空间
    async readAllSpace() {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'bilibiliSpace.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        return data;
    }

    // @schedule('* */1 * * * *') // 每30分钟执行一次
    async testschedule() {
        const data = await this.readAllSpace();
        if(!data){
            return;
        }
        const datas = Object.keys(data)
        for (let i = 0; i < datas.length; i++) {
            const key = datas[i];
            const item = data[key];
            for (let j = 0; j < item.length; j++) {
                const element = item[j];
                if (element.type == "group") {
                const NewSpace = await this.getNewspace(element.spaceId);
                if(!NewSpace?.id_str){
                    continue;
                }
                if (NewSpace?.id_str && element?.NewSpace && element.NewSpace != NewSpace.id_str) {
                    await this.saveSpace(element.seedId,element.spaceId,NewSpace.id_str, "group");
                    const htmlImg = new HtmlImg();
                    const img = await htmlImg.render({
                        template:'',
                        data: {},
                        templateIsPath: false,
                        url: `https://t.bilibili.com/${NewSpace.id_str}`,
                        width: 600, // 模板宽度
                        height: 1, // 模板高度
                        type: 'png',// 模板类型
                        quality: 100,// 模板质量
                        fullPage: false,// 是否全屏
                        background: true,
                    });
                    function createImageMessage(base64Data: string): ImageSegment {
                        return {
                            type: "image",
                            data: {file: `base64://${base64Data}`,}
                        };
                    }
                    const base64Data = Buffer.from(img).toString('base64');
                    const imageMessage = createImageMessage(base64Data);
                    const message = [imageMessage];
                    await qqBot.send_group_msg({
                        group_id: Number(element.seedId),
                        message: message as any[]
                    });
                    //终止循环
                    continue;
                }
            }
        }
            
            

        }   
    }
    async fileToBase64(filePath: string) {
        if (!filePath) {
            return ""
        }
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