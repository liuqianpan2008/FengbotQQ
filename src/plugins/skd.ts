import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from "node-napcat-ts";
import { param, plugins, runcod } from "../lib/decorators.js";
import { attendance, auth, getBinding, signIn } from "@skland-x/core";
import axios from "axios";
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from "url";
import crypto from 'crypto'
import botlogger from "../lib/logger.js";
import { qqBot } from "../app.js";

async function convertImageToBase64(filePath: string): Promise<string> {
    try {
      const fileData = await fs.promises.readFile(filePath);
      return `data:image/jpeg;base64,${fileData.toString('base64')}`;
    } catch (error) {
      console.error('图片转换失败:', error);
      return '';
    }
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
    ap:{
        now:number,
        max:number,
    },
    level:number,
    registerTs: string,
    name: string,
    skins: number,
    mainStageProgress: string,
    furniture: number,
    chars: number,
    avatar: string,
}

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
        this.saveBinding(context?.sender?.user_id, token?.data?.text)
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
    @runcod(['个人卡片', 'skd卡片','卡片','skdCard'], `skd查询干员信息`)
    async query(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
         context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid =userid?.data?.qq??context?.sender?.user_id
        if (!userid) {
            return '请输入干员名称'
        }
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const data = await this.getInfo(Number(serid), indexNum)
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
        const data = await this.getInfo(2180323481, 0)
        const info = await this.userInfoData(data as any)
        console.log(JSON.stringify(info));
        return {data: info}
    }
    async userInfoData({status,building,chars,skins}:{status:any,building:any,chars:any,skins:any}):Promise<UserInfoData> {
        if (!status || !building || !chars) {
            return {
                ap:{
                    now:0,
                    max:0,
                },
                level:0,
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
            ap:{
                now:0,
                max:0,
            },
            skins: 0,
            level:0,
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
        let apAddTime = Number((new Date().getTime()-new Date(status.ap.lastApAddTime*1000).getTime())/1000/60/6)
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
        data1.chars = chars.length-2
        // 皮肤数量
        data1.skins = skins.length
        return data1
    }
    @runcod(['基建卡片', 'skd基建卡片','基建','skdBuildingCard'], `skd查询干员信息`)
    async buildingCard(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(userid?.data?.qq??context?.sender?.user_id)
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const data = await this.getInfo(serid, indexNum)
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
    async buildingData({ building }:{building:any}) {
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
        data.tiredChars.now = building?.tiredChars?.length??0
        // 无人机
        data.labor.now = Math.min(Math.round((Date.now() / 1000 - building.labor.lastUpdateTime) / 360 + building.labor.value), building.labor.maxValue)
        data.labor.max = building.labor.maxValue
        return data

    }
    @runcod(['我的干员', '我的干员数据'], `查询我的干员数据`)
    async myChars(
        @param("干员名称", 'text',) name: Receive["text"],
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage

    ) {
        const serid = Number(userid?.data?.qq??context?.sender?.user_id)
        if (!name?.data?.text) {
            return '请输入干员名称'
        }
        const Charsname = name.data.text

        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }

        const data = await this.getInfo(serid, indexNum)
        if (data === '-1') {
            return this.getErronStr()
        }
        const chars = (data as any)?.chars
        
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','gamedata','excel','character_table.json')
        const Rdata:any = JSON.parse(fs.readFileSync(dataPath,'utf-8'))
        let charId = ''
        for(let key in Rdata){
            if(Rdata[key].name === Charsname){
                charId = key
            }
        }
        const char = Rdata[charId]
        if(!char){
            return '干员不存在'
        }
        
        const Userchar = chars.find((item:any)=>item.charId === charId)
        if(!Userchar){
            return `您没有${Charsname}干员`
        }
        const UserDataRes = await this.charsReplace(Userchar)
        return {
            data:UserDataRes,
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
    async charsReplace(data:any){
        // 取干员名字
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        const dataPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','gamedata','excel','character_table.json')
        const Rdata:any = JSON.parse(fs.readFileSync(dataPath,'utf-8'))
        data.charName = Rdata[data.charId].name
        // 取干员头像
        data.charPortrait = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','avatar',data.charId+'.png'))
        // 取干员技能
        const skillPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','gamedata','excel','skill_table.json')
        const skillData:any = JSON.parse(fs.readFileSync(skillPath,'utf-8'))
        data.skills.forEach(async (item:any)=>{
            item.skillName = skillData[item.id].levels[0].name
            item.skillIcon = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skill','skill_icon_'+item.id+'.png'))
        })
        // 取干员模组
        const equipPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','gamedata','excel','uniequip_table.json')
        const equipData:any = JSON.parse(fs.readFileSync(equipPath,'utf-8'))
        data.equip.forEach((item:any)=>{
            item.equipName = equipData.equipDict[item.id].uniEquipName
        })
        // 取干员皮肤信息
        const skinPath = path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','gamedata','excel','skin_table.json')
        const skinData:any = JSON.parse(fs.readFileSync(skinPath,'utf-8'))
        data.skinName = skinData.charSkins[data.skinId].displaySkin.skinName
        console.log(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin',data.skinId.replace('@','_')+'.png'));
        //模糊搜索文件取第一个 path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin',data.skinId.replace('@','_')+'.png')
        const files = fs.readdirSync(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin'))
        const file = files.find((item:any)=>item.indexOf(data.skinId.replace('@','_')) !== -1)
        if(file){
            data.skinBank = await convertImageToBase64(path.resolve(__dirname, '..', 'resources', 'skd', 'ArknightsGameResource','skin',file))
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
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage

    ) {
        const serid = Number(userid?.data?.qq??context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        if (tokenList.length === 0) {
            return this.getErronStr()
        }
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const token = tokenList[indexNum]
        if (!token) {
            return this.getErronStr()
        }
        const { code } = await auth(token);
        const { cred, token: signToken } = await signIn(code);
        const timestamp = await this.getTimestamp()
        let signedHeaders = await this.getSignHeader('https://u8.hypergryph.com/u8/pay/v1/recent', 'post', {appId:1,channelMasterId:1}, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const {data:playerInfo} = (await axios({
            url:'https://u8.hypergryph.com/u8/pay/v1/recent',
            method:'POST',
            headers: {
                ...signedHeaders,
                token: signToken,
                cred,
            },
            data: {
                appId:1,
                channelMasterId:1,
                channelToken:{token,},
            },
        }))
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            data:playerInfo.data,
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
    @runcod(['jczl','集成战略','集成查询','jc'], `集成战略查询`)
    async jczl(
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage

    ) {
        const serid = Number(userid?.data?.qq??context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        if (tokenList.length === 0) {
            return this.getErronStr()
        }
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const token = tokenList[indexNum]
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
        let signedHeaders = await this.getSignHeader('https://zonai.skland.com/api/v1/game/arknights/rogue', 'get', {uid: characterList[0].uid}, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const {data} = (await axios({
            url:'https://zonai.skland.com/api/v1/game/arknights/rogue',
            method:'get',
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
            data:data.data,
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

    @runcod(['qd','签到'], `签到`)
    async sign(
        @param("userid", 'at', { type: 'at', data: { qq: '' } }, true) userid: Receive["at"],
        @param("顺序", 'text', { type: 'text', data: { text: '' } }, true) index: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const serid = Number(userid?.data?.qq??context?.sender?.user_id)
        const tokenList = await this.getBinding(serid)
        if (tokenList.length === 0) {
            return this.getErronStr()
        }
        let indexNum = 0
        if (!index?.data?.text || isNaN(Number(index.data.text))) {
            indexNum = 0
        } else {
            indexNum = Number(index.data.text)
        }
        const token = tokenList[indexNum]
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
        const sign = await attendance(cred,signToken,{
            uid:characterList[0].uid,
            gameId:characterList[0].channelMasterId,
        })
        if (sign) {
            return `签到成功, 获得了${sign.data.awards.map((a: { resource: { name: any; }; count: any; }) => `「${a.resource.name}」${a.count}个`).join(',')}`
        }
        return '已经签到过了'
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
    private async saveBinding(seedId: number, token: string): Promise<void> {
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
            data[seedId] = [token];
        }else{
            if (data[seedId].indexOf(token) === -1) {
                data[seedId].push(token);
            }
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }
    //获取绑定
    private async getBinding(seedId: number): Promise<string[]> {
        if (!seedId) {
            return [];
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
        return [];
    }
    //获取信息
    private async getInfo(seedId: number,index:number=0): Promise<string> {
        if (!seedId) {
            return '请输入seedId'
        }
        const tokenList = await this.getBinding(seedId)
        if (tokenList.length === 0) {
            return '-1'
        }
        const token = tokenList[index]
        if (!token) {
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
        let signedHeaders = await this.getSignHeader('https://zonai.skland.com/api/v1/game/player/info', 'get', {uid: characterList[0].uid}, this.REQUEST_HEADERS_BASE, signToken, timestamp);
        const {data:playerInfo} = (await axios({
            url:'https://zonai.skland.com/api/v1/game/player/info',
            method:'get',
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
    private getErronStr():string{
        return '登录 森空岛(https://www.skland.com/)网页版 后，打开 https://web-api.skland.com/account/info/hg 记下 content 字段的值,发送 #绑定skd [content]即可完成绑定'
    }
}