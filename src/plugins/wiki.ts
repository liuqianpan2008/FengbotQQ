//PLUGIN wiki.ts
import { param, plugins, runcod } from '../lib/decorators.js';
import 'reflect-metadata';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from 'node-napcat-ts';
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path';
import { createWorker } from 'tesseract.js';
import { fileURLToPath } from 'url';
import { PSM } from 'tesseract.js';
import { Jimp, loadFont } from 'jimp'; // 假设未引入，添加引入语句
import { Type } from 'js-yaml';


@plugins({
    easycmd: true,
    name: "枫叶秋林的明日方舟工具箱",
    version: "0.0.1",
    describe: "日常制作不出许多有趣好玩的工具箱",
    author: "枫叶秋林",
    help: {
        enabled: true,
        description: "查看帮助信息"
    }
})
export class wiki {

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

    @runcod(['方舟智能点击','智能点击'], `会自动识别文字，安卓模拟器的操作方舟点击操作，优先使用创建的点击步骤`)
    async rig(
        @param("点击文本", 'text') targetText: Receive["text"],
        @param("x偏移", 'text', { type: 'text', data: { text: '' } }, true) x1: Receive["text"],
        @param("y偏移", 'text', { type: 'text', data: { text: '' } }, true) y1: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (!targetText?.data?.text) {
            return '请输入文本'
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', '..', 'botQQ_screenshots');
        const tempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const newtempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        try {
            const { adbPath, deviceList } = this.getadb();
            const buffer = await this.getimg(adbPath, deviceList, tempFile);
            if (!buffer) {
                return;
            }

            const readxy = await this.readxy(targetText?.data?.text)
            let x = 0
            let y = 0
            let img ='' 
            let txst =''
            if (readxy) {
                x = readxy.x1;
                y = readxy.y1;
                txst = '记录结果'
                img = buffer.toString('base64');
            }else{
                const data  = await this.recognizeTextPosition(tempFile, targetText.data.text);
                x = data.x
                y = data.y
                txst = data.txst
                img = data.img
            }
            if (targetText?.data?.text) {
                if (targetText?.data?.text == '任意') {
                    const x = Math.floor(Math.random() * 1000) + 1;
                    const y = Math.floor(Math.random() * 1000) + 1;
                    execSync(`${adbPath} -s ${deviceList[0]} shell input tap ${x} ${y}`);
                } else {
                    if (x1?.data?.text || y1?.data?.text) {
                        execSync(`${adbPath} -s ${deviceList[0]} shell input tap ${x + Number(x1?.data?.text ?? 0)} ${y + Number(y1?.data?.text ?? 0)}`);
                    } else {
                        execSync(`${adbPath} -s ${deviceList[0]} shell input tap ${x} ${y}`);
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 4000));
                const buffer = await this.getimg(adbPath, deviceList, newtempFile);
                if (!buffer) {
                    return;
                }
                const base64Data = buffer.toString('base64');
                context.quick_action([{
                    type: 'text',
                    data: {
                        text: `识别结果：x:${x},y:${y}(${txst})`
                    },
                },{
                    type: 'image',
                    data: {
                        file: `base64://${img}`
                    }
                },{
                    type: 'image',
                    data: {
                        file: `base64://${base64Data}`
                    }
                }]);
            }
            return '截图成功';
        } catch (error) {
            console.error('[ADB错误]', error);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
            const errorMsg = error instanceof Error && error.message
            return errorMsg;
        } finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
        }
    }
    @runcod(['方舟滑动','滑动'], `滑动屏幕`)
    async huadong(
        @param("name", 'text') name: Receive["text"],
        @param("type", 'text', { type: 'text', data: { text: '' } },true) type: Receive["text"],
        @param("距离", 'text', { type: 'text', data: { text: '' } },true) distance: Receive["text"],
        @param("X", 'text', { type: 'text', data: { text: '' } },true) x1: Receive["text"],
        @param("y", 'text', { type: 'text', data: { text: '' } },true) y1: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        if (!name?.data?.text) { return; }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', '..', 'botQQ_screenshots');
        const tempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const newtempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const { adbPath, deviceList } = this.getadb();
        const xy = await this.readxy(name?.data?.text)
        if (xy) {
            if (!x1?.data?.text || !y1?.data?.text) {
                execSync(`${adbPath} -s ${deviceList[0]} shell input swipe ${xy.x1} ${xy.y1} ${xy.x2} ${xy.y2}`);
            } else {
                if (xy.x1 != Number(x1?.data?.text) || xy.y1 != Number(y1?.data?.text) || xy.type != type?.data?.text) {
                    try {
                        let x2 = 0
                        let y2 = 0
                        switch (type?.data?.text) {
                            case '上':
                                x2 = Number(x1.data.text)
                                y2 = Number(y1.data.text) + Number(distance?.data?.text ?? 100)
                                break;
                            case '下':
                                x2 = Number(x1.data.text)
                                y2 = Number(y1.data.text) - Number(distance?.data?.text ?? 100)
                                break;
                            case '左':
                                x2 = Number(x1.data.text) + Number(distance?.data?.text ?? 100)
                                y2 = Number(y1.data.text)
                                break;
                            case '右':
                                x2 = Number(x1.data.text) - Number(distance?.data?.text ?? 100)
                                y2 = Number(y1.data.text)
                                break;
                            default:
                                return '请输入滑动方向'
                        }
                        execSync(`${adbPath} -s ${deviceList[0]} shell input swipe ${x1.data.text} ${y1.data.text} ${x2} ${y2}`);
                        this.savetest(name?.data?.text, 'slide', Number(x1?.data?.text), Number(y1?.data?.text), x2, y2)
                        await new Promise((resolve) => setTimeout(resolve, 4000));
                    }
                    catch (error) {
                        console.error('[ADB错误]', error);
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                        if (fs.existsSync(newtempFile)) {
                            fs.unlinkSync(newtempFile);
                        }
                        const errorMsg = error instanceof Error && error.message
                        return errorMsg;
                    }
                }
            }
        } else {
            if (!x1?.data?.text || !y1?.data?.text) {
                return '请输入坐标';
            }
            try {
                let x2 = 0
                let y2 = 0
                switch (type?.data?.text) {
                    case '上':
                        x2 = Number(x1.data.text)
                        y2 = Number(y1.data.text) - Number(distance?.data?.text ?? 100)
                        break;
                    case '下':
                        x2 = Number(x1.data.text)
                        y2 = Number(y1.data.text) + Number(distance?.data?.text ?? 100)
                        break;
                    case '左':
                        x2 = Number(x1.data.text) - Number(distance?.data?.text ?? 100)
                        y2 = Number(y1.data.text)
                        break;
                    case '右':
                        x2 = Number(x1.data.text) + Number(distance?.data?.text ?? 100)
                        y2 = Number(y1.data.text)
                        break;
                    default:
                        return '请输入滑动方向'
                }
                execSync(`${adbPath} -s ${deviceList[0]} shell input swipe ${x1.data.text} ${y1.data.text} ${x2} ${y2}`);
                this.savetest(name?.data?.text, 'slide', Number(x1?.data?.text), Number(y1?.data?.text), x2, y2)
                await new Promise((resolve) => setTimeout(resolve, 4000));
            }
            catch (error) {
                console.error('[ADB错误]', error);
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
                if (fs.existsSync(newtempFile)) {
                    fs.unlinkSync(newtempFile);
                }
                const errorMsg = error instanceof Error && error.message
                return errorMsg;
            }
        }
        const JGbuffer = await this.getimg(adbPath, deviceList, newtempFile);
        if (!JGbuffer) { return; }
        const base64Data = JGbuffer.toString('base64');
        context.quick_action([
            {
                type: 'image',
                data: {
                    file: `base64://${base64Data}`
                }
        }])
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        if (fs.existsSync(newtempFile)) {
            fs.unlinkSync(newtempFile);
        }
        return '操作成功';
    }
    @runcod(['方舟输入','输入'], `输入文本`)
    async input(
        @param("输入文本", 'text') text: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', '..', 'botQQ_screenshots');
        const tempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const newtempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        try {
            const { adbPath, deviceList } = this.getadb();
            const buffer = await this.getimg(adbPath, deviceList, tempFile);
            if (!buffer) {
                return;
            }
            fs.writeFileSync(tempFile, buffer);
            if (text?.data?.text) {
                // 使用Base64编码处理中文
                const encodedText = text.data.text||"";
                const CMD = `${adbPath} -s ${deviceList[0]} shell am broadcast -a ADB_INPUT_TEXT --es msg "${encodedText}"`
                execSync(CMD);                
                const buffer = await this.getimg(adbPath, deviceList, newtempFile);
                if (!buffer) {
                    return;
                }
                const base64Data = buffer.toString('base64');
                context.quick_action([{
                    type: 'text',
                    data: {
                        text: `记录结果：${text.data.text}`
                    },
                },{
                    type: 'image',
                    data: {
                        file: `base64://${base64Data}`
                    }
                }
            ])
            }
        }
        catch (error) {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
            console.error('[ADB错误]', error);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }finally  {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
        }
    }

    @runcod(['方舟点击','点击'], `创建一个点击步骤`)
    async rig2(
        @param("点击文本", 'text') targetText: Receive["text"],
        @param("x偏移", 'text', { type: 'text', data: { text: '' } }, true) x1: Receive["text"],
        @param("y偏移", 'text', { type: 'text', data: { text: '' } }, true) y1: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', '..', 'botQQ_screenshots');
        const tempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const newtempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        try {
            const { adbPath, deviceList } = this.getadb();
            const buffer = await this.getimg(adbPath, deviceList, tempFile);
            if (!buffer) {
                return;
            }
            fs.writeFileSync(tempFile, buffer);
            if (targetText?.data?.text) {
                execSync(`${adbPath} -s ${deviceList[0]} shell input tap ${x1.data.text} ${y1.data.text}`);
                const buffer = await this.getimg(adbPath, deviceList, newtempFile);
                if (!buffer) {
                    return;
                }
                const base64Data = buffer.toString('base64');
                await new Promise((resolve) => setTimeout(resolve, 4000));
                context.quick_action([{
                    type: 'text',
                    data: {
                        text: `记录结果：x:${x1.data.text},y:${y1.data.text}(${targetText.data.text})\n 图片记录`
                    },
                },{
                    type: 'image',
                    data: {
                        file: `base64://${base64Data}`
                    }
                }]);
                this.savetest(targetText.data.text, 'cilik' , Number(x1.data.text) , Number(y1.data.text));
            }
            return '操作成功';
        } catch (error) {
            console.error('[ADB错误]', error);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
            const errorMsg = error instanceof Error && error.message
            return errorMsg;
        } finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
        }
    }

    @runcod(['步骤','查看步骤'], `查看创建的步骤`)
    async list(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'test.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        let str = ''
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const element = data[key];
                str += `${key}(${element.type?? 'click' }):x:${element.x1},y:${element.y1}\n`;
            }
        }
        return str;
    }
    @runcod(['步骤集','查看步骤集'], `查看创建的步骤集`)
    async lists(){
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'tests.json');
        let str=''
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        let i=1;
        for (const key in data) {
           const v = await this.readtests(key)
           if (v) {
            str+= `${i++}.${key}:`
            for (const i in v) {
                str+= `${v[i].name}(${v[i].type}),`
            }
           }
        }
        return str;
    }
    @runcod(['创建步骤集'], `创建步骤集`)
    async createlist(
        @param("步骤集名称", 'text') testname: Receive["text"],
        @param("步骤,例子：步骤名称1:类别,步骤名称2:类别", 'text') texts: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        let str=''
        const tests = texts?.data?.text?.split(',')
        const datatest:{
            name: string;
            type: 'input' | 'click' | 'slide';
        }[] = [];
        if (tests) {
            for (const test of tests) {
                const [name, type] = test.split(':');
                if (type == 'input') {
                    datatest.push({type,name});
                }else if (type == 'click'){
                    const xy = await this.readxy(name)
                    if (xy) {
                        datatest.push({type,name});
                    }else{
                        str+= `步骤${name}未找到,请创建\n`
                    }
                }else{
                    str+= `步骤${name}未找到,请创建\n`
                }
                
            }
            this.createtests(testname.data.text,datatest);
            str+= `步骤集${testname.data.text}创建成功\n`
        }
        return str;
    }
    @runcod(['执行步骤集','runtests'], `执行步骤集`)
    async runtest(
        @param("步骤集名称", 'text') name: Receive["text"],
        @param("步骤,例子：输入值1:输入值2:输入值3:", 'text',{type:'text',data:{text:''}},true) input: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if (!name?.data?.text) {
            return '步骤集名称不能为空';   
        }
        if (input?.data?.text == '') {
            return '输入值不能为空';
        }
        let str=''
        const inputs = input?.data?.text?.split(':')
        const tests = await this.readtests(name.data.text)
        const { adbPath, deviceList } = this.getadb();
        if (tests) {
            for (const test of  tests) {
                if (test.type == 'input') {
                    if (inputs) {
                        const input = inputs.shift()
                        if (input) {
                            const CMD = `${adbPath} -s ${deviceList[0]} shell am broadcast -a ADB_INPUT_TEXT --es msg "${input}"`
                            execSync(CMD);
                            await new Promise((resolve) => setTimeout(resolve, 3000));
                            str += `步骤${test.name}执行成功 类别:${test.type}输入值:${input}\n`
                        }
                    }
                }else if (test.type == 'click'){
                    const readxy = await this.readxy(test.name)
                    let cmd=`${adbPath} -s ${deviceList[0]} shell input tap ${readxy?.x1?? 0} ${readxy?.y1??0}`
                    execSync(cmd);
                    str += `步骤${test.name}执行成功 类别:${test.type}(x:${readxy?.x1?? 0},y:${readxy?.y1??0})\n`
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }else if (test.type == 'slide'){
                    const readxy = await this.readxy(test.name)
                    let cmd=`${adbPath} -s ${deviceList[0]} shell input swipe ${readxy?.x1?? 0} ${readxy?.y1??0} ${readxy?.x2?? 0} ${readxy?.y2??0}`
                    execSync(cmd);
                    str += `步骤${test.name}执行成功 类别:${test.type}(x:${readxy?.x1?? 0},y:${readxy?.y1??0},x2:${readxy?.x2?? 0},y2:${readxy?.y2??0})\n`
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
            await this.tu(context);
            return str;
        }
        return str??'步骤集不存在';
    }
    @runcod(['方舟状态','截图','状态'], `当前方舟运行状态`)
    async tu(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if (!context) {
            return;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', '..', 'botQQ_screenshots');
        const tempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        const newtempFile = path.join(tempDir, `screenshot_${Date.now()}.png`);
        try {
            const { adbPath, deviceList } = this.getadb();
            const buffer = await this.getimg(adbPath, deviceList, tempFile);
            if (!buffer) {
                return;
            }
            fs.writeFileSync(tempFile, buffer);
            const GRID = (await this.drawGrid(tempFile))
            const base64Data = buffer.toString('base64');
            context.quick_action([{
                type: 'image',
                data: {
                    file: `base64://${base64Data}`
                }
            }, 
            {
                type: 'image',
                data: {
                    file: `base64://${GRID}`
                }
            }]);
            return '截图成功';
        } catch (error) {
            console.error('[ADB错误]', error);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
            const errorMsg = error instanceof Error && error.message
            return errorMsg;
        } finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(newtempFile)) {
                fs.unlinkSync(newtempFile);
            }
        }
    }
    //获取安卓模拟器设备
    getadb() {
        const adbPath = '/opt/homebrew/bin/adb';
        // 获取有效设备列表
        const devicesOutput = execSync(`${adbPath} devices`).toString();
        const deviceList = devicesOutput.split('\n')
            .slice(1)
            .filter(line => line.trim().endsWith('device'))
            .map(line => line.split('\t')[0]);

        if (deviceList.length === 0) {
            throw new Error('未检测到已连接的安卓设备');
        }
        return {
            adbPath,
            deviceList
        };
    }
    async getimg(adbPath: string, deviceList: string[], tempFile: string) {
        if (deviceList.length === 0) {
            return   
        }
        if (!adbPath){
            return
        }
        execSync(`${adbPath} -s ${deviceList[0]} exec-out screencap -p > ${tempFile}`);
        const readStream = fs.createReadStream(tempFile);
        const chunks = [];
        for await (const chunk of readStream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
    private async recognizeTextPosition(imagePath: string, text: string): Promise<{ x: number; y: number,img:string ,txst:string}> {
        if (!imagePath || !text) {
            return { x: 0, y: 0,img:'',txst:'' };
        }
        try {
            const worker = await createWorker();
            await worker.load('chi_sim');
            await worker.reinitialize('chi_sim');

            await worker.setParameters({
                user_defined_dpi: '320',
                tessedit_char_whitelist: text,
                tessedit_pageseg_mode: PSM.SINGLE_BLOCK

            });
            //识别文本未知
            const { data } = await worker.recognize(imagePath, {

            }, { blocks: true });

            if (!data || data.blocks?.length !== 1) {
                throw new Error('未找到文本块');
            }
            const target = data.blocks[0];


            await worker.terminate();

            if (!target) {
                throw new Error('未找到目标文本');
            }
            let words: any = []
            let txst='';
            target.paragraphs.forEach((paragraph) => {
                paragraph.lines.forEach((line) => {
                    line.words.forEach((word) => {
                        words.push({
                            x0: word.bbox.x0,
                            x1: word.bbox.x1,
                            y0: word.bbox.y0,
                            y1: word.bbox.y1,
                            text:  txst += `文本：${line.text}（${Math.floor(word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2)},${Math.floor(word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2)}）\n`
                        })
                    });
                });
            })
            const x = Math.floor(words[0].x0 + (words[0].x1 - words[0].x0) / 2)
            const y = Math.floor(words[0].y0 + (words[0].y1 - words[0].y0) / 2)
            return {x,y, img:await this.drawCircle(imagePath,x,y) ,txst};
        } catch (error) {
            throw new Error(`识别失败：${error instanceof Error ? error.message : '请检查OCR依赖安装'}`);
        }
    }
    //绘制圆形标记
    private async drawCircle(imagePath: string, x: number,y: number): Promise<string> {
        if (!imagePath) {
            return '';
        }
        const image = await Jimp.read(imagePath);
            const marker = new Jimp({
                width: 50,
                height: 50,
                color: 0x00000000
            });
            marker.scan(0, 0, marker.bitmap.width, marker.bitmap.height,  (x, y, idx) => {
                const dx = x - 25;
                const dy = y - 25;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 25) {
                    marker.bitmap.data[idx + 3] = 255;
                }
            });
            marker.circle({ radius: 5, x: 25, y: 25 });
            image.composite(marker, x - 10, y - 10);
            const img =await image.getBase64('image/png');
            return img.split(',')[1];
    }
    //绘制网格
    private async drawGrid(imagePath: string): Promise<string> {
        if (!imagePath) {
            return '';
        }
        const image = await Jimp.read(imagePath);
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const tempDir = path.resolve(__dirname, '..', 'font', 'open-sans-8-white.fnt');
        const font = await loadFont(tempDir);
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const gridSize = 50;
        for (let x = 0; x < width; x += gridSize) {
            if (typeof Jimp !== 'undefined' && image instanceof Jimp) {
                image.scan(x, 0, 1, height, (xScan, yScan, idx) => {
                    image.bitmap.data[idx + 0] = 0;   // R
                    image.bitmap.data[idx + 1] = 0;   // G
                    image.bitmap.data[idx + 2] = 0;   // B
                    image.bitmap.data[idx + 3] = 255; // A
                });
            }
        }
        for (let y = 0; y < height; y += gridSize) {
            // 绘制水平线
            if (typeof Jimp!== 'undefined' && image instanceof Jimp) {
                image.scan(0, y, width, 1, (xScan, yScan, idx) => {
                    image.bitmap.data[idx + 0] = 0;   // R
                    image.bitmap.data[idx + 1] = 0;   // G
                    image.bitmap.data[idx + 2] = 0;   // B
                    image.bitmap.data[idx + 3] = 255; // A  
                })
            }
        }
        // 线两段标注数字
        for (let x = 0; x < width; x += gridSize) {
            for (let y = 0; y < height; y += gridSize) {
                if (typeof Jimp!== 'undefined' && image instanceof Jimp) {
                    if (font) {
                        image.print({ font, x: x - 10, y: y - 10, text: `${x},${y}` });
                    }
                }
            }
        }

        const img = await image.getBase64('image/png');
        return img.split(',')[1];
    }
    //保存步骤记录
    private async savetest(test: string,type:'cilik' | 'slide', x1: number, y1: number, x2?:number, y2?:number): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        //json
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'test.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }else{
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
        if(data[test]){
            switch(type){
                case 'cilik':
                    data[test].x1=x1
                    data[test].y1=y1
                    break;
                case 'slide':
                    data[test].x1=x1
                    data[test].y1=y1
                    data[test].x2=x2
                    data[test].y2=y2
            }
        }else{
            switch(type){
                case 'cilik':
                    data[test]={type,x1,y1}
                    break;
                case 'slide':
                    data[test]={type,x1,y1,x2,y2}
            }
            
        }
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }
    //读取步骤记录
    private async readxy(test: string): Promise< { type:'cilik' | 'slide', x1: number, y1: number, x2?:number, y2?:number } | undefined> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'test.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        if(data[test]){
            return data[test] as { type:'cilik' | 'slide', x1: number, y1: number, x2?:number, y2?:number };
        }
    }
    //创建步骤记录
    private async createtests(name:string , test: {
        name: string;
        type: 'input' | 'click' | 'slide';
        
    }[]): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'tests.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        data[name]=test
        fs.writeFileSync(filePath, JSON.stringify(data));
        return;
    }
    //读取步骤记录
    private async readtests(name:string): Promise<{
        name: string;
        type: 'input' | 'click' | 'slide';
    }[] | undefined> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, '..', '..', 'botQQ_screenshots', 'tests.json');
        let data: any = {};
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
            if(data[name]){
                return data[name] ;
            }
        }
        if(data[name]){
            return data[name];
        }
    }
}

