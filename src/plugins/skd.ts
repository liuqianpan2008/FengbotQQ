import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from "node-napcat-ts";
import { param, plugins, runcod, schedule } from "../lib/decorators.js";
import { attendance, auth, getBinding, signIn } from "@skland-x/core";
import axios from "axios";
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from "url";
import crypto from 'crypto'
import botlogger from "../lib/logger.js";
import { qqBot } from "../app.js";
import sharp from "sharp";
import { cost } from "@/lib/Plugins.js";

async function convertImageToBase64(filePath: string): Promise<string> {
    try {
        const fileData = await fs.promises.readFile(filePath);
        return `data:image/jpeg;base64,${fileData.toString('base64')}`;
    } catch (error) {
        console.error('图片转换失败:', error);
        return '';
    }
}
//获取图片的宽和高
async function getImageSize(base64: string): Promise<{ width: number; height: number }> {
    const data = base64.split(',')[1];
    const buffer = Buffer.from(data, 'base64');
    const imageSize = await sharp(buffer).metadata();
    return {
        width: imageSize.width || 0,
        height: imageSize.height || 0,
    };
}
async function processImage(base64: string, type: 'easy' | 'hard' | 'EX'): Promise<string> {
    let processData = {
        width: 200,
        height: 200,
        blur: 0.3,
        //马赛克强度
        mosaic: 0.3,
        x: 0,
        y: 0,
    }
    const imageSize = await getImageSize(base64);
    //随机位置
    processData.x = Math.floor(Math.random() * (imageSize.width - processData.width));
    processData.y = Math.floor(Math.random() * (imageSize.height - processData.height));
    switch (type) {
        case 'easy':
            processData.blur = 0.5
            processData.mosaic = 0.3
            break;
        case 'hard':
            processData.width = 200
            processData.height = 200
            processData.blur = 200
            processData.mosaic = 0.5
            break;
        case 'EX':
            processData.width = 150
            processData.height = 150
            processData.blur = 500
            processData.mosaic = 0.7
            break;
    }
    const data = base64.split(',')[1];
    const buffer = Buffer.from(data, 'base64');
    //使用sharp处理马赛克图片

    let processedBuffer = await sharp(buffer)
        .extract({
            width: processData.width,
            height: processData.height,
            left: processData.x,
            top: processData.y,
        })
        .blur(processData.blur)
        .toBuffer();

    while (!await isChar(processedBuffer)) {
        processData.x = Math.floor(Math.random() * (imageSize.width - processData.width));
        processData.y = Math.floor(Math.random() * (imageSize.height - processData.height));
        processedBuffer = await sharp(buffer)
            .extract({
                width: processData.width,
                height: processData.height,
                left: processData.x,
                top: processData.y,
            })
            .blur(processData.blur)
            .toBuffer();
    }
    return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

}
async function isChar(base64:Buffer) {
    const { data, info } = await sharp(base64)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data.buffer);
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (r > 100 && g > 100 && b > 100) {
            return true;
        }
    }
    return false;
}

type Character = {
    uid: string;
    isOfficial: boolean;
    isDefault: boolean;
    channelMasterId: string;
    channelName: string;
    nickName: string;
    isDelete: boolean;
}
type UserInfoData = {
    ap: {
        now: number,
        max: number,
    },
    level: number,
    registerTs: string,
    name: string,
    skins: number,
    mainStageProgress: string,
    furniture: number,
    chars: number,
    avatar: string,
}
//储存猜干员
const guessCharList = new Map()
//储存技能
const skillList = new Map()
@plugins({
    easycmd: true,//是否启用简易命令，启用将将命令注册为<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "森空岛", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "森空岛插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class skd {
    private REQUEST_HEADERS_BASE = {
        "User-Agent": "Skland/1.0.1 (com.hypergryph.skland; build:100001014; Android 31; ) Okhttp/4.11.0",
        "Accept-Encoding": "gzip",
        "Connection": "close",
    }
    constructor() {

    }

    @runcod(["绑定skd", "skd绑定"], `绑定skd`)
    async bind(
        @param("token", 'text') token: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (!token?.data?.text) {
            return '请输入token'
        }
        const { code } = await auth(token?.data?.text)
        const { cred, token: signToken } = await signIn(code)
        const { list } = await getBinding(cred, signToken)
        const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
        if (characterList.length === 0) {
            return '该通行证未查询到绑定的账号'
        }
        this.saveBinding(context?.sender?.user_id, token?.data?.text, characterList[0].uid)
        qqBot.delete_msg({
            message_id: context.message_id,
        })
        return `绑定账号：${characterList.map((i: { nickName: string; }) => i.nickName).join(',')}，绑定成功`
    }

    @runcod(["干员", "查询干员"], `干员bilibiliWiki截图`)
    async browser(
        @param("干员名称", 'text') name: Receive["text"],
        @param("内容信息", 'text', { type: 'text', data: { text: '' } }, true) element: Receive["text"]
    ) {
        let sandbox = ''
        switch (element?.data?.text) {
            case '评论':
                sandbox = '#flowthread'
                break;
            case '语音':
                sandbox = '::-p-xpath(/html/body/div[2]/div[2]/div[4]/div[5]/div/div[27])'
                break;
            case '档案':
                sandbox = '::-p-xpath(/html/body/div[2]/div[2]/div[4]/div[5]/div/div[24])'
                break;
            case '模组':
                sandbox = '::-p-xpath(/html/body/div[2]/div[2]/div[4]/div[5]/div/div[21])'
                break;
            case '基建':
                sandbox = '::-p-xpath(/html/body/div[2]/div[2]/div[4]/div[5]/div/div[19])'
                break;
            case '技能材料':
                sandbox = '::-p-xpath(/html/body/div[2]/div[2]/div[4]/div[5]/div/div[17])'
            default:
                sandbox = ''
        }
        return {
            selector: sandbox,
            template: { // 模板配置，用于发送图片内容
                enabled: true,//是否启用模板，启用将发送图片内容
                sendText: false,//是否发送文本，启用将发送文本内容，如果都启用则发送两条消息
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,
                    url: `https://wiki.biligame.com/arknights/${name?.data?.text}`// 模板路径，推荐按规范放置在resources目录下
                }
            },
            toString() { //重写toString方法，用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                return `访问${name?.data?.text}`;
            }
        }
    }
    @runcod(['个人卡片', 'skd卡片', '卡片', 'skdCard'], `skd查询干员信息`)
    async query(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = userid?.data?.qq ?? context?.sender?.user_id
        if (!serid) {
            return '请输入干员名称'
        }
        const data = await this.getInfo(Number(serid))
        if (data === '-1') {
            return this.getErronStr()
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const info = await this.userInfoData(data as any)
        return {
            data: info,
            pluginResources: path.resolve(__dirname, '..', 'resources', 'skd'),
            template: {
                enabled: true,//是否启用模板，启用将发送图片内容
                path: path.resolve(__dirname, '..', 'resources', 'skd', 'userinfo.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            }
        }
    }
    async queryMe() {
        const data = await this.getInfo(2180323481)
        const info = await this.userInfoData(data as any)
        console.log(JSON.stringify(info));
        return { data: info }
    }
    async userInfoData({ status, building, chars, skins }: { status: any, building: any, chars: any, skins: any }): Promise<UserInfoData> {
        if (!status || !building || !chars) {
            return {
                ap: {
                    now: 0,
                    max: 0,
                },
                level: 0,
                registerTs: '',
                name: '',
                mainStageProgress: '',
                furniture: 0,
                chars: 0,
                skins: 0,
                avatar: '',
            }
        }
        let data1 = {
            ap: {
                now: 0,
                max: 0,
            },
            skins: 0,
            level: 0,
            registerTs: '',
            name: '',
            mainStageProgress: '',
            furniture: 0,
            chars: 0,
            avatar: '',
        }
        // 注册时间
        //格式化时间8位
        function formatTime(time: Date) {
            return time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate() + ' ' + time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds();
        }
        data1.registerTs = formatTime(new Date(status.registerTs * 1000))

        // 游戏昵称
        data1.name = 'Dr.' + status.name
        //取整
        let apAddTime = Number((new Date().getTime() - new Date(status.ap.lastApAddTime * 1000).getTime()) / 1000 / 60 / 6)
        apAddTime = Math.floor(apAddTime)
        console.log(status.ap);
        data1.ap = {
            now: status.ap.current + apAddTime,
            max: status.ap.max,
        }
        // 等级
        data1.level = status.level
        // 头像
        data1.avatar = status.avatar.url
        // 作战进度
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const lvPath = path.resolve(__dirname, '..', 'resources', 'wiki', 'levels.json')
        let levels = JSON.parse(fs.readFileSync(lvPath, 'utf8'))
        data1.mainStageProgress = levels[status.mainStageProgress] || ''
        // 家具保有
        data1.furniture = building.furniture.total
        // 干员数量
        data1.chars = chars.length - 2
        // 皮肤数量
        data1.skins = skins.length
        return data1
    }
    @runcod(['基建卡片', 'skd基建卡片', '基建', 'skdBuildingCard'], `skd查询干员信息`)
    async buildingCard(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(userid?.data?.qq ?? context?.sender?.user_id)
        const data = await this.getInfo(serid)
        if (data === '-1') {
            return this.getErronStr()
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const buildingData = await this.buildingData(data as any)
        return {
            data: buildingData,
            pluginResources: path.resolve(__dirname, '..', 'resources', 'skd'),
            template: {
                enabled: true,//是否启用模板，启用将发送图片内容
                path: path.resolve(__dirname, '..', 'resources', 'skd', 'building.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            }
        }
    }
    async buildingData({ building }: { building: any }) {
        if (!building) {
            return {}
        }
        let data = {
            tradings: {
                now: 0,
                max: 0,
            },
            manufactures: {
                now: 0,
                max: 0,
            },
            dormitories: {
                now: 0,
                max: 0,
            },
            board: {
                now: 0,
                max: 0,
            },
            tiredChars: {
                now: 0,
                max: 0,
            },
            labor: {
                now: 0,
                max: 0,
            },
        }
        // 订单进度
        data.tradings.now = building.tradings.reduce((acc: any, cur: { chars: string | any[]; }) => acc + cur.chars.length, 0)
        data.tradings.max = building.tradings.reduce((acc: any, cur: { stockLimit: any; }) => acc + cur.stockLimit, 0)
        // 制造进度
        data.manufactures.now = building.manufactures.reduce((acc: any, cur: { weight: any; }) => acc + cur.weight, 0)
        data.manufactures.max = building.manufactures.reduce((acc: any, cur: { capacity: any; }) => acc + cur.capacity, 0)

        // 休息进度
        data.dormitories.now = building.dormitories.reduce((acc: any, cur: { chars: any[]; }) => acc + cur.chars.reduce((acc, cur) => acc + (cur.ap === 8640000 ? 1 : 0), 0), 0)
        data.dormitories.max = building.dormitories.reduce((acc: any, cur: { chars: string | any[]; }) => acc + cur.chars.length, 0)
        // 线索进度
        data.board.now = building.meeting.clue.board.length
        data.board.max = 7
        // 干员疲劳
        data.tiredChars.now = building?.tiredChars?.length ?? 0
        // 无人机
        data.labor.now = Math.min(Math.round((Date.now() / 1000 - building.labor.lastUpdateTime) / 360 + building.labor.value), building.labor.maxValue)
        data.labor.max = building.labor.maxValue
        return data

    }

    @runcod(['我的干员', '我的干员数据'], `查询我的干员数据`)
    async myChars(
        @param("干员名称", 'text',) name: Receive["text"],
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(userid?.data?.qq ?? context?.sender?.user_id)
        if (!name?.data?.text) {
            return '请输入干员名称'
        }
        const Charsname = await this.getCharacterAlias(name.data.text) ?? name.data.text
        const data = await this.getInfo(serid)
        if (data === '-1') {
            return this.getErronStr()
        }
        const chars = (data as any)?.chars

        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'character_table.json')
        const Rdata: any = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        let charId = ''
        for (let key in Rdata) {
            if (Rdata[key].name === Charsname) {
                charId = key
            }
        }
        const char = Rdata[charId]
        if (!char) {
            return '干员不存在'
        }

        const Userchar = chars.find((item: any) => item.charId === charId)
        if (!Userchar) {
            return `您没有${Charsname}干员`
        }
        const UserDataRes = await this.charsReplace(Userchar)
        return {
            data: UserDataRes,
            pluginResources: path.resolve(__dirname, '..', 'resources', 'skd'),
            template: {
                enabled: true,//是否启用模板，启用将发送图片内容
                path: path.resolve(__dirname, '..', 'resources', 'skd', 'chars.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            }
        }


    }
    // 处理干员码值替换
    async charsReplace(data: any) {
        // 取干员名字
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'character_table.json')
        const Rdata: any = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        data.charName = Rdata[data.charId].name
        // 取干员头像
        data.charPortrait = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'avatar', data.charId + '.png'))
        // 取干员技能
        const skillPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'skill_table.json')
        const skillData: any = JSON.parse(fs.readFileSync(skillPath, 'utf-8'))
        data.skills.forEach(async (item: any) => {
            item.skillName = skillData[item.id].levels[0].name
            item.skillIcon = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skill', 'skill_icon_' + item.id + '.png'))
        })
        // 取干员模组
        const equipPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'uniequip_table.json')
        const equipData: any = JSON.parse(fs.readFileSync(equipPath, 'utf-8'))
        data.equip.forEach((item: any) => {
            item.equipName = equipData.equipDict[item.id].uniEquipName
        })
        // 取干员皮肤信息
        const skinPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'skin_table.json')
        const skinData: any = JSON.parse(fs.readFileSync(skinPath, 'utf-8'))
        data.skinName = skinData.charSkins[data.skinId].displaySkin.skinName
        //模糊搜索文件取第一个 path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin',data.skinId.replace('@','_')+'.png')
        const files = fs.readdirSync(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skin'))
        const file = files.find((item: any) => item.indexOf(data.skinId.replace('@', '_') + "b") !== -1)
        if (file) {
            data.skinBank = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skin', file))
        }
        // 格式化获取时间
        function formatTime(time: Date) {
            return time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate() + ' ' + time.getHours() + ':' + time.getMinutes() + ':' + time.getSeconds();
        }
        data.gainTime = formatTime(new Date(data.gainTime * 1000))
        return data
    }
    @runcod(['kj'], `我的氪金`)
    async kj(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage

    ) {
        const serid = Number(userid?.data?.qq ?? context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        if (tokenList.uid === 0) {
            return this.getErronStr()
        }
        const token = tokenList.token
        if (!token) {
            return this.getErronStr()
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const timestamp = await this.getTimestamp()
        let signedHeaders = await this.getSignHeader('https://u8.hypergryph.com/u8/pay/v1/recent', 'post', { appId: 1, channelMasterId: 1 }, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const { data: playerInfo } = (await axios({
            url: 'https://u8.hypergryph.com/u8/pay/v1/recent',
            method: 'POST',
            headers: {
                ...signedHeaders,
                token: signToken,
                cred,
            },
            data: {
                appId: 1,
                channelMasterId: 1,
                channelToken: { token, },
            },
        }))
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            data: playerInfo.data,
            pluginResources: path.resolve(__dirname, '..', 'resources', 'skd'),
            template: {
                enabled: true,//是否启用模板，启用将发送图片内容
                path: path.resolve(__dirname, '..', 'resources', 'skd', 'kj.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            }

        }
    }

    @runcod(['jczl', '集成战略', '集成查询', 'jc'], `集成战略查询`)
    async jczl(
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage

    ) {
        const serid = Number(userid?.data?.qq ?? context?.sender?.user_id)
        const tokendata = (await this.getBinding(serid))
        if (tokendata.uid === 0) {
            return this.getErronStr()
        }
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const token = tokendata.token
        if (!token) {
            return this.getErronStr()
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const { list } = await getBinding(cred, signToken);
        const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
        if (characterList.length === 0) {
            return '-1'
        }
        const timestamp = await this.getTimestamp()
        let signedHeaders = await this.getSignHeader('https://zonai.skland.com/api/v1/game/arknights/rogue', 'get', { uid: characterList[0].uid }, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const { data } = (await axios({
            url: 'https://zonai.skland.com/api/v1/game/arknights/rogue',
            method: 'get',
            headers: {
                ...signedHeaders,
                token: signToken,
                cred,
            },
            params: {
                uid: characterList[0].uid,
            },
        }))
        //写入文件
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        fs.writeFileSync(path.resolve(__dirname, '..', 'resources', 'skd', 'jczl.json'), JSON.stringify(data));
        return {
            data: data.data,
            pluginResources: path.resolve(__dirname, '..', 'resources', 'skd'),
            template: {
                enabled: true,//是否启用模板，启用将发送图片内容
                path: path.resolve(__dirname, '..', 'resources', 'skd', 'jczl.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true,// 是否背景
                }
            }

        }
    }

    @runcod(['qd', '签到'], `签到`)
    async sign(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(userid?.data?.qq ?? context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        if (tokenList.uid === 0) {
            return this.getErronStr()
        }
        const token = tokenList.token
        if (!token) {
            return this.getErronStr()
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const { list } = await getBinding(cred, signToken);
        const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
        if (characterList.length === 0) {
            return '-1'
        }
        const sign = await attendance(cred, signToken, {
            uid: characterList[0].uid,
            gameId: characterList[0].channelMasterId,
        })
        if (sign) {
            return `签到成功, 获得了${sign.data.awards.map((a: { resource: { name: any; }; count: any; }) => `「${a.resource.name}」${a.count}个`).join(',')}`
        }
        return '已经签到过了'
    }

    @runcod(['allqd', '全量签到'], `全量签到`)
    async allqd(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(context?.sender?.user_id)
        if (!serid) {
            return '没有绑定账号'
        }
        const binding = await this.readBinding()
        if (!binding) {
            return '没有绑定账号'
        }
        let msg = ''
        for (const key in binding) {
            const tokens = binding[key];
            for (const token of tokens) {
                try {
                    const { code } = await auth(token);
                    const { cred, token: signToken } = await signIn(code);
                    const { list } = await getBinding(cred, signToken);
                    const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
                    if (characterList.length === 0) {
                        continue
                    }
                    const sign = await attendance(cred, signToken, {
                        uid: characterList[0].uid,
                        gameId: characterList[0].channelMasterId,
                    })
                    if (sign) {
                        msg += `账号${key}签到成功, 获得了${sign.data.awards.map((a: { resource: { name: any; }; count: any; }) => `「${a.resource.name}」${a.count}个`).join(',')}\n`
                    } else {
                        msg += `账号${key},今天已经完成签到了\n`
                    }
                } catch (error) {
                    msg += `账号${key}签到失败, 可能是过期了, 请重新绑定\n`
                }
            }
            
        }
        return msg
    }

    @runcod(['删除别名', '删除干员别名'], `删除干员别名`)
    async deleteCAlias(
        @param("干员", 'text',) name: Receive["text"],
        @param("别名", 'text',) asname: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const nameStr = name.data.text
        const asnameStr = asname.data.text
        if (!nameStr || !asnameStr) {
            return '请输入干员和别名'
        }
        await this.deleteCharacterAlias(nameStr, asnameStr)
        return `成功删除${nameStr}的别名${asnameStr}`
    }
    @runcod(['添加别名', '添加干员别名'], `添加干员别名`)
    async addCAlias(
        @param("干员", 'text',) name: Receive["text"],
        @param("别名", 'text',) asname: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const nameStr = name.data.text
        const asnameStr = asname.data.text
        if (!nameStr || !asnameStr) {
            return '请输入干员和别名'
        }
        await this.saveCharacterAlias(nameStr, asnameStr)
        return `成功为${nameStr}添加别名${asnameStr}`
    }
    @runcod(['查看别名', '查看干员别名'], `查看干员别名`)
    async viewCAlias(
        @param("干员", 'text',) name: Receive["text"],
    ) {
        const nameStr = name.data.text
        if (!nameStr) {
            return '请输入干员'
        }
        const aliasList = await this.getCharacterAliasList(nameStr)
        if (!aliasList) {
            return '该干员没有别名'
        }
        if (aliasList.length === 0) {
            return '该干员没有别名'
        }
        return `干员${nameStr}的别名有：${aliasList.join(',')}`
    }

    private async getTimestamp() {
        return String(Math.floor(Date.now() / 1000) - 2);
    }
    private async getSignHeader(apiUrl: string, method: string, body: any, oldHeader: any, signToken: string, timestamp: string) {
        if (!apiUrl) {
            return '请输入apiUrl'
        }
        if (!method) {
            return '请输入method'
        }
        if (!signToken) {
            return '请输入signToken'
        }
        if (!timestamp) {
            return '请输入timestamp'
        }

        let header = { ...oldHeader };
        const urlParsed = new URL(apiUrl);
        let bodyOrQuery = method.toLowerCase() === 'get'
            ? new URLSearchParams(body || urlParsed.searchParams).toString()
            : (body ? JSON.stringify(body) : '');
        const {
            md5: sign, headerCa
        } = await this.generateSignature(signToken, urlParsed.pathname, bodyOrQuery, timestamp);
        header['sign'] = sign;
        header = { ...header, ...headerCa };
        return header;
    }
    private async generateSignature(token: string, path: string, bodyOrQuery: string, timestamp: string) {
        if (!token) {
            return {
                md5: '',
                headerCa: {},
            }
        }
        if (!path) {
            return {
                md5: '',
                headerCa: {},
            }
        }
        if (!bodyOrQuery) {
            return {
                md5: '',
                headerCa: {},
            }
        }
        if (!timestamp) {
            return {
                md5: '',
                headerCa: {},
            }
        }
        let headerCa = Object.assign({}, {
            "platform": "", "timestamp": "", "dId": "", "vName": ""
        },);
        headerCa.timestamp = timestamp;
        let headerCaStr = JSON.stringify(headerCa);

        let s = path + bodyOrQuery + timestamp + headerCaStr;
        let hmac = crypto.createHmac('sha256', Buffer.from(token, 'utf-8')).update(s).digest('hex');
        let md5 = crypto.createHash('md5').update(hmac).digest('hex');
        return { md5: md5, headerCa: headerCa };
    }
    //储存绑定
    private async saveBinding(seedId: number, token: string,uid:string): Promise<void> {
        if (!seedId) {
            return;
        }
        if (!token) {
            return;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'SKDBinding.json');
        let data: any = {};
        if (!seedId) {
            return;
        }
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if (!data[seedId]) {
            data[seedId] ={
                uid:uid,
                token:token
            }
        } else {
            if (data[seedId].token !== token) {
                data[seedId].token = token;
                data[seedId].uid = uid;
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }
    //获取绑定
    private async getBinding(seedId: number): Promise<{uid:number,token:string}> {
        if (!seedId) {
            return {uid:0,token:''};
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'SKDBinding.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if (data[seedId]) {
                return data[seedId];
            }
        }
        return {uid:0,token:''};
    }
    //读取绑定
    private async readBinding() {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'SKDBinding.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        return data;
    }
    //获取信息
    private async getInfo(seedId: number): Promise<string> {
        if (!seedId) {
            return '请输入seedId'
        }
        const token = (await this.getBinding(seedId)).token
        const uid = (await this.getBinding(seedId)).uid
        if (!token || !uid) {
            return '-1'
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const { list } = await getBinding(cred, signToken);
        const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
        if (characterList.length === 0) {
            return '-1'
        }
        const timestamp = await this.getTimestamp()
        let signedHeaders = await this.getSignHeader('https://zonai.skland.com/api/v1/game/player/info', 'get', { uid: characterList[0].uid }, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const { data: playerInfo } = (await axios({
            url: 'https://zonai.skland.com/api/v1/game/player/info',
            method: 'get',
            headers: {
                ...signedHeaders,
                token: signToken,
                cred,
            },
            params: {
                uid: characterList[0].uid,
            },
        }))

        return playerInfo.data
    }
    private getErronStr(): string {
        return '登录 森空岛(https://www.skland.com/)网页版 后，打开 https://web-api.skland.com/account/info/hg 记下 content 字段的值,发送 #绑定skd [content]即可完成绑定'
    }
    //干员别名
    private async getCharacterAlias(asname: string) {
        if (!asname) {
            return;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'CharaAlias.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        //根据别名确定干员
        for (const key in data) {
            if (data[key].indexOf(asname) !== -1) {
                return key;
            }
        }
        return;
    }

    //干员全部别名
    private async getCharacterAliasList(name: string) {
        if (!name) {
            return [];
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'CharaAlias.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        if (data[name]) {
            return data[name];
        }
        return [];
    }

    //根据干员确定别名
    private async saveCharacterAlias(name: string, asname: string) {
        if (!name) {
            return;
        }
        if (!asname) {
            return;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'CharaAlias.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        if (!data[name]) {
            data[name] = [];
        }
        data[name].push(asname)
        fs.writeFileSync(filePath, JSON.stringify(data));
    }

    //根据别名删除干员
    private async deleteCharacterAlias(name: string, asname: string) {
        if (!name) {
            return;
        }
        if (!asname) {
            return;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'CharaAlias.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        if (data[name]) {
            if (data[name].indexOf(asname) !== -1) {
                data[name].splice(data[name].indexOf(asname), 1);
            }
        }
        if (data[name].length === 0) {
            delete data[name];
        }
        fs.writeFileSync(filePath, JSON.stringify(data));

    }

    //猜干员
    @runcod(['猜干员', '猜干员别名'], `猜干员`)
    private async guessCharacter(
        //难度选择
        @param('type', 'text', { type: "text", data: { text: '' } }, true) type: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        let typeText: 'easy' | 'hard' | 'EX' = 'easy'
        if (!type?.data?.text) {
            typeText = 'easy'
        } else if (['hard', '困难'].some(keyword => type.data.text.includes(keyword))) {
            typeText = 'hard'
        } else if (['EX', 'ex', 'extreme', '极限'].some(keyword => type.data.text.includes(keyword))) {
            typeText = 'EX'
        } else if (['easy', '简单'].some(keyword => type.data.text.includes(keyword))) {
            typeText = 'easy'
        } else {
            return '请输入正确的难度:[ easy ,hard ,EX ]'
        }
        if (!context.message) {
            return '请输入干员名称'
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'character_table.json')
        const files = fs.readdirSync(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skin'))
        const Rdata: any = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        let file, CharanData, skinBank = ''

        // 随机抽取一位有皮肤的干员
        while (!file) {
            const charList = Object.keys(Rdata)
            //随机抽取一位
            const Charan = charList[Math.floor(Math.random() * charList.length)]
            CharanData = Rdata[Charan]
            let skinid = CharanData?.skills[Math.floor(Math.random() * CharanData?.skills?.length)]?.skillId ?? ''
            if (!skinid) {
                continue;
            }
            //模糊搜索文件取第一个 path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin',data.skinId.replace('@','_')+'.png')
            //替换sktok_
            skinid = skinid.replace('skchr_', '')
            file = files.find((item: any) => item.indexOf(skinid + "b") !== -1)
            if (file) {
                skinBank = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skin', file))
            }
        }
        let dataImas = await processImage(skinBank, typeText)
        const charan = {
            name: (CharanData as any).name,
            skinBank,
            alias: dataImas,
            count: 0,
            type: typeText,
        }
        if (guessCharList.has(context.user_id)) {
            return '已生成，请等待下一次游戏'
        }
        if (context.message_type == 'group') {
            qqBot.send_msg({
                group_id: context.group_id,
                message: [{
                    type: 'image',
                    data: {
                        file: dataImas,
                    }
                }],
            })
            guessCharList.set(context.group_id, charan)
        } else {
            qqBot.send_msg({
                user_id: context.user_id,
                message: [{
                    type: 'image',
                    data: {
                        file: dataImas,
                    }
                }],
            })
            guessCharList.set(context.user_id, charan)
        }
        console.log(`debug:${charan.name}`);
        return `开始游戏了，输入#猜 干员名称 进行猜奖`
    }
    @runcod(['猜'], `猜干员`)
    private async guessCharacterAlias(
        @param("干员或者技能", 'text',) name: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        let data
        if (context.message_type == 'private') {
            data = guessCharList.get(context.sender.user_id)
        } else {
            data = guessCharList.get(context.group_id)
        }
        if (!data) {
            return '请先输入 #猜干员 开始游戏'
        }
        if (!name?.data?.text) {
            return '请输入干员名称'
        }
        let namedata = await this.getCharacterAlias(name?.data?.text) ?? name?.data?.text
        data.count++
        if (data.count >= 3 || name?.data?.text == '结束') {
            guessCharList.delete(context.user_id)
            if (context.message_type == 'group') {
                qqBot.send_msg({
                    group_id: context.group_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.skinBank,
                        }
                    }],
                })

            } else {
                qqBot.send_msg({
                    user_id: context.user_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.dataImas,
                        }
                    }],
                })
            }
            return `游戏结束，你猜了${data.count}次，正确答案是${data.name}`
        }
        if (data.name == namedata) {
            if (context.message_type == 'private') {
                guessCharList.delete(context.sender.user_id)
            } else {
                guessCharList.delete(context.group_id)
            }
            if (context.message_type == 'group') {
                qqBot.send_msg({
                    group_id: context.group_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.skinBank,
                        }
                    }],
                })

            } else {
                qqBot.send_msg({
                    user_id: context.user_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.skinBank,
                        }
                    }],
                })
            }
            return `恭喜你猜对了，你${data.count}次猜中了`
        } else {
            const dataImas = await processImage(data.skinBank, data.type)
            if (context.message_type == 'group') {
                qqBot.send_msg({
                    group_id: context.group_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: dataImas,
                        }
                    }],
                })

            } else {
                qqBot.send_msg({
                    user_id: context.user_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: dataImas,
                        }
                    }],
                })
            }
            return `不正确,猜错了${data.count}次`

        }


    }

    @runcod(['猜干员技能'], `开始猜技能`)
    private async guessSkill(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (!context) {
            return '请输入技能名称'
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        ///Users/fenglin/Desktop/botQQ/src/resources/skd/ArknightsGameResource/gamedata/excel/skill_table.json
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'gamedata', 'excel', 'skill_table.json')
        if (!fs.existsSync(dataPath)) {
            return '数据文件不存在'
        }
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
        //随机抽取一个
        let skillName=''
        let cost = ''
        while(!fs.existsSync(cost)){
            const skillKey = Object.keys(data)[Math.floor(Math.random() * Object.keys(data).length)]
            skillName = data[skillKey].levels[0].name
            cost = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource', 'skill', `skill_icon_${data[skillKey].skillId}.png`)
        }
        const iconBase64 = await convertImageToBase64(cost)
        const charan = {
            count: 0,
            name: skillName,
            iconBase64: iconBase64,
        }
        if (context.message_type == 'group') {
            if (skillList.has(context.group_id)) {
                return '已生成，请等待下一次游戏'
            }
            qqBot.send_msg({
                group_id: context.group_id,
                message: [{
                    type: 'image',
                    data: {
                        file: iconBase64,
                    }
                }],
            })
            skillList.set(context.group_id, charan)
        }

        if (context.message_type == 'private') {
            if (skillList.has(context.user_id)) {
                return '已生成，请等待下一次游戏'
            }
            qqBot.send_msg({
                user_id: context.user_id,
                message: [{
                    type: 'image',
                    data: {
                        file: iconBase64,
                    }
                }],
            })
            skillList.set(context.user_id, charan)
        }
        console.log(`debug:${charan.name}`);
        return `开始游戏了，输入#cjn 技能名称 进行猜奖`
    }

    @runcod(['cjn', 'cj', 'jn'], `猜技能`)
    private async guessSkillAlias(
        @param("技能名称", 'text',) name: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        let data
        if (context.message_type == 'private') {
            data = skillList.get(context.sender.user_id)
        } else {
            data = skillList.get(context.group_id)
        }
        
        if (!data) {
            return '请先输入 #猜干员技能 开始游戏'
        }
        if (!name?.data?.text) {
            return '请输入技能名称'
        }
        let namedata = await this.getCharacterAlias(name?.data?.text) ?? name?.data?.text
        data.count++
        if (data.count >= 3 || name?.data?.text == '结束') {
            
            if (context.message_type == 'group') {
                skillList.delete(context.group_id)
                qqBot.send_msg({
                    group_id: context.group_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.iconBase64,
                        }
                    }],
                })

            } else {
                skillList.delete(context.user_id)
                qqBot.send_msg({
                    user_id: context.user_id,
                    message: [{
                        type: 'image',
                        data: {
                            file: data.iconBase64,
                        }
                    }],
                })
            }
            return `游戏结束，猜了${data.count}次，正确答案是${data.name}`
        }
        if (data.name == namedata) {
            if (context.message_type == 'private') {
                skillList.delete(context.sender.user_id)
            } else {
                skillList.delete(context.group_id)
            }
            return `恭喜你猜对了，你${data.count}次猜中了`
        } else {
            return `不正确,猜错了${data.count}次`
        }
    }

    @runcod(['加好友'], `加好友`)
    private async addFriend(
        @param("绑定qq号", 'at',{type:'at',data:{qq:''}},true) qq: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if(!qq?.data?.qq){
            return '请输入qq号'
        }
        const serid = Number(context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        const token = tokenList.token
        if (!token) {
            return this.getErronStr()
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const { list } = await getBinding(cred, signToken)
        const characterList = (list.filter((i: { appCode: string; }) => i.appCode === 'arknights').map((i: { bindingList: any; }) => i.bindingList).flat()) as Character[]
        if (characterList.length === 0) {
            return '该通行证未查询到绑定的账号'
        }
        const uid = characterList[0].uid
        const timestamp = await this.getTimestamp()
        const findtoken = await this.getBinding(Number(qq.data.qq))
        let signedHeaders = await this.getSignHeader('https://zonai.skland.com/api/v1/game/friend', 'post', { targetUid: Number(findtoken.uid),uid: uid, }, this.REQUEST_HEADERS_BASE, signToken, timestamp);
     
        if(findtoken.uid === 0){
            return '添加好友的qq号未绑定'
        }
        if(findtoken.token === token){
            return '不能添加自己'
        }
        console.log("had");
        
        console.log(JSON.stringify({
            ...signedHeaders,
            token: signToken,
            cred,
        }));
        console.log("DATA");
        console.log(JSON.stringify({
            targetUid: Number(findtoken.uid),
            uid: uid,
        }))
        const  {data}  = (await axios({
            url: 'https://zonai.skland.com/api/v1/game/friend',
            method: 'POST',
            headers: {
                ...signedHeaders,
                token: signToken,
                cred,
            },
            data: {
                targetUid: Number(findtoken.uid),
                //targetUid: "840220562",
                uid: uid,
                channelToken: { token, },
            },
        }))
        console.log(JSON.stringify(data));
        if(data.message !== 'OK'){
            return '添加好友失败'
        }else{
            return '已发送添加好友请求'
        }
    }
    
    @runcod(['看号'], `看号`)
    private async look(
        @param("使用方案，默认使用枫叶秋林实例方案", 'at',{type:'at',data:{qq:''}},true) qq: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if(!context?.sender?.user_id){
            return '请输入qq号'
        }
        const serid = Number(context?.sender?.user_id)
        const data = await this.getInfo(serid)
        if (data === '-1') {
            return this.getErronStr()
        }
        const chars = (data as any)?.chars
    }

    @runcod(['查看方案'], `查看方案`)
    private async lookSkill(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if(!context?.sender?.user_id){
            return '请输入qq号'
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'Skdskill');
        //filePath下所有文件名称
        const files = fs.readdirSync(filePath).filter((file) => file.endsWith('.json'));
        return files.map((i) => i.replace('.json', '')).join(',');
    }
    
    private async readSkill(name: string,) {
        if(!name){
            return '请输入方案名称'
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'Skdskill',`${name}.json`);
        const data = fs.readFileSync(filePath);
        return data.toString();
    }



}