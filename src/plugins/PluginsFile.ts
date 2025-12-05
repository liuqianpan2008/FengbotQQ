import { param, plugins, runcod } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from 'node-napcat-ts';
import botlogger from '../lib/logger.js';
import * as fs from 'fs'
import { qqBot } from '../app.js';
import { load, saveConfig } from '../lib/config.js';
import { download } from '../lib/download.js';
import { IsAdmin } from '../lib/Permission.js';
import { BotPlugin } from './plugin.js';
import axios from 'axios';
interface ShopPlugin {
        name: string;
        version: string;
        describe: string;
        author: string;
        url: string;
        status: 'disabled' | 'enabled';
    }
@plugins({
    name: "插件文件管理", //插件名称，用于显示在菜单中
    version: "1.0.2", //插件版本号，用于显示在菜单中
    describe: "可以查看服务器的插件/日志，可以上传插件到群内", 
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class PluginsFile extends BotPlugin {
    constructor() {
        super("PluginsFile");
        if (load.enable==true){
            qqBot.on('message', async (context) => {
                try {
                    if (context.message[0].type === "file") {
                        const file = context.message[0].data;
                        botlogger.info("收到文件消息:" + JSON.stringify(file));
                        if (file.file.includes(".ts")) {
                            if (!IsAdmin(context.sender.user_id)) {
                                context.quick_action([{
                                    type: 'text',
                                    data: { text: `无权限，无法加载插件` }
                                }]);
                                return;
                            }
                            const url = (file as any).url; // 文件URL
                            await download(url, `../plugins/${file.file}`);
                            botlogger.info("下载完成:" + JSON.stringify(file));
                            context.quick_action([{
                                type: 'text',
                                data: { text: `插件下载完成,开始重载` }
                            }]);
                            let isload = load
                            isload.isuplad = true;
                            isload.name = file.file
                            if ((context.message_type === 'group')) {
                                isload.id = context.group_id
                            } else {
                                isload.id = context.sender.user_id
                            }
                            isload.isGroupMessage = (context.message_type === 'group');
                            saveConfig("load", isload)
                        }
                        return;
                    }
                    if (context.message[0].type !== 'text') {
                        return;
                    }
                    const msg = context.message[0].data.text || '';
                    if (msg.startsWith("//PLUGIN ")) {
                        const endOfLine = msg.indexOf("\n");
                        if (endOfLine !== -1) {
                            const pluginName = msg.substring(9, endOfLine).trim();
                            if (pluginName.endsWith(".ts")) {
                                if (!IsAdmin) {
                                    context.quick_action([{
                                        type: 'text',
                                        data: { text: `无权限，无法加载插件` }
                                    }]);
                                    return;
                                }
                                botlogger.info("开始安装插件: " + pluginName);
                                const __dirname = path.dirname(fileURLToPath(import.meta.url));
                                // @ts-ignore
                                fs.writeFileSync(path.join(__dirname, "..", "plugins", pluginName), msg, "utf8");
                                context.quick_action([{
                                    type: 'text',
                                    data: { text: `插件下载完成,开始重载` }
                                }]);
                                let isload = load
                                isload.isuplad = true;
                                isload.name = pluginName
                                if ((context.message_type === 'group')) {
                                    isload.id = context.group_id
                                } else {
                                    isload.id = context.sender.user_id
                                }
                                isload.isGroupMessage = (context.message_type === 'group');
                                saveConfig("load", isload)
                            }
                        }
                    }
                } catch (error) {
                    botlogger.error("处理消息时出错:", error);
                    await context.quick_action([{
                        type: 'text',
                        data: { text: `处理消息时出错: ${error instanceof Error ? error.message : '未知错误'}` }
                    }]);
                }
                // 检查消息类型和内容
               
            })
        }
    }
    @runcod(["download", "下载插件"], "下载插件")
    async download(
        @param("插件名称", 'text') pluName: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.promises.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'index.ts'
            );
            // 在服务器日志中输出找到的文件列表
            botlogger.info(`找到插件文件：${foundFiles.join(', ')}`);

            // 根据文件名查找具体插件
            const targetFile = foundFiles.find((file: string) =>
                path.parse(file).name.toLowerCase() === pluName.data.text.toLowerCase()
            );

            if (!targetFile) {
                return `未找到名为 ${pluName} 的插件`;
            }

            // 返回文件完整路径
            const fullPath = path.join(pluginsDir, targetFile);
            //.toString('base64'

            const file = Buffer.from(await fs.promises.readFile(fullPath, { encoding: "utf-8" })).toString('base64')
            const isGroupMessage = context.message_type === 'group';
            if (isGroupMessage && context.group_id) {
                await qqBot.upload_group_file({
                    group_id: Number(context.group_id),
                    file: 'data:file;base64,' + file,
                    name: pluName?.data?.text + '.ts'
                })

            } else {
                await qqBot.upload_private_file({
                    user_id: Number(context.sender.user_id),
                    file: 'data:file;base64,' + file,
                    name: pluName?.data?.text + '.ts'
                })
            }

            return '上传成功';
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }

    @runcod(["plugins", "插件列表"], "查看插件文件")
    async plugins(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.promises.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'index.ts'
            );
            foundFiles.forEach((file, index) => {
                foundFiles[index] = path.parse(file).name;
            })
            return `找到插件文件：${foundFiles.join(', ')}`;
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }
    

    @runcod(["shopPl", "商城插件"], "查看商城插件")
    async shopPl(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const shopPlugins = await this.getShopPlugins();
        let message = '商城插件列表：\n';
        if (shopPlugins.size === 0) {
            message += '当前没有可用的商城插件。';
        } else {
            shopPlugins.forEach((plugin, name) => {
                message += `${name} - ${plugin.describe} (版本: ${plugin.version}, 作者: ${plugin.author}, 状态: ${plugin.status})\n`;
            });
        }   
        return message;

    }
    @runcod(["enableShopPl", "启用商城插件"], "启用商城插件")
    async enableShopPl(
        @param("插件名称", 'text') pluName: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const shopPlugins = await this.getShopPlugins();
        if (!pluName.data.text) {
            return '请输入插件名称。';
        }
        if (shopPlugins.size === 0) {
            return '当前没有可用的商城插件。';
        }
        if (shopPlugins.get(pluName.data.text)?.status === 'enabled') {
            return `插件 ${pluName} 已启用`;
        }
        if (!shopPlugins.has(pluName.data.text)) {
            return `未找到名为 ${pluName} 的商城插件`;
        }
        const shopPlugin = shopPlugins.get(pluName.data.text) as ShopPlugin;
        shopPlugin.status = 'enabled';
        shopPlugins.set(pluName.data.text, shopPlugin);
        await this.init("PluginsFile");
        if (!this.config.Shopurl) {
            throw new Error("Shopurl 未配置");
        }
        await download(this.config.Shopurl + shopPlugin.url, `../plugins/${pluName.data.text}.ts`);
        return `已启用 ${pluName.data.text} 插件`;
    }

    //卸载
    @runcod(["disableShopPl", "禁用商城插件"], "禁用商城插件")
    async disableShopPl(
        @param("插件名称", 'text') pluName: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const shopPlugins = await this.getShopPlugins();
        if (!pluName.data.text) {
            return '请输入插件名称。';
        }
        if (shopPlugins.size === 0) {
            return '当前没有可用的商城插件。';
        }
        if (shopPlugins.get(pluName.data.text)?.status === 'disabled') {
            return `插件 ${pluName} 已禁用`;
        }
        if (!shopPlugins.has(pluName.data.text)) {
            return `未找到名为 ${pluName} 的商城插件`;
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const fullSavePath = path.join(__dirname, '../plugins', pluName.data.text + '.ts');
        if (fs.existsSync(fullSavePath)) {
            fs.unlinkSync(fullSavePath);
            const shopPlugin = shopPlugins.get(pluName.data.text) as ShopPlugin;
            shopPlugin.status = 'disabled';
            shopPlugins.set(pluName.data.text, shopPlugin);
            return `已卸载 ${pluName.data.text} 插件`;
        }else{
            return `未找到 ${pluName.data.text} 插件文件`;
        }
    }
    //升级
    @runcod(["upgradeShopPl", "升级商城插件"], "升级商城插件")
    async upgradeShopPl(
        @param("插件名称", 'text') pluName: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        const shopPlugins = await this.getShopPlugins();
        if (!pluName.data.text) {
            return '请输入插件名称。';
        }
        if (shopPlugins.size === 0) {
            return '当前没有可用的商城插件。';
        }
        if (!shopPlugins.has(pluName.data.text)) {
            return `未找到名为 ${pluName} 的商城插件`;
        }
        const shopPlugin = shopPlugins.get(pluName.data.text) as ShopPlugin;
        if (shopPlugin.status === 'disabled') {
            return `插件 ${pluName} 未启用`;
        }
        if (shopPlugin.version === (await this.getShopPlugins()).get(pluName.data.text)?.version) {
            return `插件 ${pluName} 已是最新版本`;
        }
        await download(this.config.Shopurl + shopPlugin.url, `../plugins/${pluName.data.text}.ts`);
        return `已升级 ${pluName.data.text} 插件`;
    }
    
    private async getShopPlugins(): Promise<Map<string, ShopPlugin>> {
        await this.init("PluginsFile");
        if (!this.config.Shopurl) {
            throw new Error("Shopurl 未配置");
        }
        const plugins = await this.readPluginList();
        const response = await axios.get(await this.config.Shopurl+"/info.json");
        const data = JSON.parse(JSON.stringify(response.data))
        // 合并插件状态
        const shopPlugins = new Map(Object.entries(data));
        shopPlugins.forEach((plugin) => {
            (plugin as ShopPlugin).status = 'disabled';
        })
        plugins.forEach((plugin) => {
            if (shopPlugins.has(plugin.id)) {
                const shopPlugin = shopPlugins.get(plugin.id) as ShopPlugin;
                shopPlugin.status = 'enabled';
                shopPlugins.set(plugin.id, shopPlugin);
            }
        });
        return shopPlugins as Map<string, ShopPlugin>;
    }

}