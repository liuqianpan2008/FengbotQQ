
import botlogger from "./logger.js";
import { promises as fsPromises } from 'fs';
import { HtmlImg } from "./Puppeteer.js";
import type {
    GroupMessage,
    PrivateFriendMessage,
    PrivateGroupMessage
} from 'node-napcat-ts/dist/Interfaces.js';
import * as cron from 'node-cron';
import 'reflect-metadata';
import { Command, ParamMetadata, Plugin, } from '../interface/plugin.js';
import * as fs from 'fs'
import * as path from 'path'
// 获取指令前缀
import { Botconfig as config, economy, load, PermissionConfig, saveConfig } from './config.js'
import { ImageSegment, ReplySegment, TextSegment } from "node-napcat-ts/dist/Structs.js";
import { fileURLToPath } from 'node:url';
import { qqBot } from "../app.js";
import { IsPermission } from "./Permission.js";
import { download } from "./download.js";
import { commandList, economyCommands, paramMetadata } from "./decorators.js";
import { addCoins, removeCoins } from "./economy.js";

//WSSendParam
const CMD_PREFIX = config?.cmd?.prefix ?? '#';
// 导出装饰器
// export { param, ParamType };
// export const plugins = pluginsDecorator;
export { config };  // 导出配置对象
// 创建消息工厂函数
function createTextMessage(text: string): TextSegment {
    return {
        type: "text",
        data: {
            text: text,
        }
    };
}

function createImageMessage(base64Data: string): ImageSegment {
    return {
        type: "image",
        data: {
            file: `base64://${base64Data}`,
        }
    };
}

function createReplyMessage(messageId: number | string): ReplySegment {
    return {
        type: "reply",
        data: {
            id: String(messageId)
        }
    };
}

// 修改插件查找函数
function findPlugin(pluginId: string): Plugin | undefined {
    return commandList.find((p: Plugin) => p.id === pluginId);
}
function findeasycmdPlugin(commandId: string): Plugin | undefined {
    return commandList.find((p: Plugin) => p.config.easycmd === true && p.commands.find((c: Command) => c.cmd === commandId || c.aliases?.includes(commandId)));
}
// 修改命令查找函数
function findCommand(plugin: Plugin, cmdName: string): Command | undefined {
    return plugin.commands.find((cmd: Command) => {
        // 从完整命令中提取命令名
        const cmdParts = cmd.cmd.split(/\s+/);
        const matchCmd = cmdParts[cmdParts.length - 1] === cmdName;

        // 检查别名
        const matchAlias = cmd.aliases?.some((alias: string) => {
            const aliasParts = alias.split(/\s+/);
            return aliasParts[aliasParts.length - 1] === cmdName;
        });

        return matchCmd || matchAlias;
    });
}

// 添加插件加载函数
async function loadPlugins(): Promise<void> {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        const pluginsDir = path.join(__dirname, '..', 'plugins');

        // 删除require缓存相关代码
        const files = await fsPromises.readdir(pluginsDir);

        for (const file of files) {
            if (file.endsWith('.ts') && file !== 'index.ts') {
                const filePath = path.join(pluginsDir, file);
                try {
                    // 使用ESM动态导入并添加时间戳防止缓存
                    const module = await import(`${filePath}?t=${Date.now()}`);
                    const pluginClasses = Object.values(module).filter(
                        value => typeof value === 'function' && value.prototype?.plugincfg
                    );

                    for (const PluginClass of pluginClasses) {
                        const instance = new (PluginClass as any)();
                        const pluginConfig = instance.constructor.prototype.plugincfg;

                        if (pluginConfig) {
                            const plugin: Plugin = {
                                id: pluginConfig.id,
                                name: pluginConfig.name,
                                commands: [] as Command[],
                                class: instance.constructor,
                                version: pluginConfig.version,
                                author: pluginConfig.author,
                                describe: pluginConfig.describe,
                                config: pluginConfig
                            };
                            // 触发装饰器
                            await initializePluginCommands(instance);

                            // 初始化定时任务
                            await initializeScheduledTasks(instance);
                        }
                    }
                } catch (error) {
                    botlogger.error(`加载插件文件失败 ${file}:`, error);
                }
            }
        }
    } catch (error) {
        botlogger.error("加载插件目录失败:", error);
    }
}


// 初始化插件命令
async function initializePluginCommands(instance: any): Promise<void> {
    const methods = Object.getOwnPropertyNames(instance.constructor.prototype)
        .filter(name => name !== 'constructor');

    for (const methodName of methods) {
        const method = instance.constructor.prototype[methodName];
        try {
            if (typeof method === 'function') {
                method.call(instance, '', '');
            }
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('Cannot read properties of undefined')) {
                continue;
            }
            botlogger.error(`触发装饰器时出错: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
}

// 初始化定时任务
async function initializeScheduledTasks(instance: any): Promise<void> {
    const methods = Object.getOwnPropertyNames(instance.constructor.prototype)
        .filter(name => name !== 'constructor');

    for (const methodName of methods) {
        const method = instance.constructor.prototype[methodName];
        if (method.isScheduled) {
            try {
                // 创建定时任务
                cron.schedule(method.cron, async () => {
                    try {
                        await method.call(instance);
                    } catch (error) {
                        botlogger.error(`执行定时任务失败 [${methodName}]:`, error);
                    }
                });
                botlogger.info(`注册定时任务 [${methodName}]: ${method.cron}`);
            } catch (error) {
                botlogger.error(`注册定时任务失败 [${methodName}]:`, error);
            }
        }
    }
}

// 修改 runplugins 函数
export async function runplugins() {
    try {
        // 清理旧实例
        commandList.forEach(plugin => {
            plugin.commands.forEach(cmd => {
                // 检查 cmd.fn 是否存在，并且是否有 close 方法
                if (cmd.fn && typeof (cmd.fn as any).close === 'function') {
                    (cmd.fn as any).close();
                }
            });
        });

        // 清空现有命令列表
        commandList.length = 0;
        // 注册插件
        botlogger.info("开始注册插件...");
        // 自动加载插件
        await loadPlugins();
        // 设置消息处理器
        qqBot.on('message', async (context) => {
            try {
                // 检查消息类型和内容
                if (context.message[0].type === "file") {
                    const file = context.message[0].data;
                    botlogger.info("收到文件消息:" + JSON.stringify(file));
                    if (file.file.includes(".ts")) {
                        let isAdmin = PermissionConfig.admins.some((admin: string) => admin === String(context.sender.user_id));
                        if (!isAdmin) {
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

                            let isAdmin = PermissionConfig.admins.some((admin: string) => admin === String(context.sender.user_id));
                            if (!isAdmin) {
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

                if (msg == CMD_PREFIX) {
                    context.quick_action([{
                        type: 'text',
                        data: {
                            text: "可用的命令有：\n" +
                                commandList.map(p => `${CMD_PREFIX}${p.id}: ${p.name}`).join('\n') +
                                "\n\n" +
                                `使用 “${CMD_PREFIX}插件名 help” 或 “${CMD_PREFIX}插件名 ?” 查询命令的详情 ^_^`
                        }
                    }]);
                    return;
                }

                botlogger.info('收到消息:' + context.message[0].data.text);
                // 检查是否是命令
                if (!msg.startsWith(CMD_PREFIX)) {
                    return;
                }

                // 解析命令
                const parts = msg.slice(CMD_PREFIX.length).trim().split(/\s+/);
                const pluginId = parts[0];
                const cmdName = parts[1];
                const args = parts.slice(2);

                botlogger.info('尝试匹配插件:', pluginId);

                // 显示可用插件
                botlogger.info('可用插件:');
                commandList.forEach(p => {
                    botlogger.info(`  [${p.id}]: ${p.name}`);
                });

                // 查找插件
                const plugin = findPlugin(pluginId);
                if (!plugin) {
                    botlogger.info(`插件未找到: ${pluginId}`);
                    //尝试easycmd开启的插件
                    const easyplugin = findeasycmdPlugin(pluginId)
                    if (!easyplugin) {
                        botlogger.info(`插件未找到: ${pluginId}`);
                        return;
                    }
                    let command: Command | undefined = undefined;
                    command = findCommand(easyplugin, pluginId);
                    if (!command) {
                        botlogger.info(`命令未找到: ${pluginId}`);
                        return;
                    }
                    //指令权限检查
                    if (context.message_type === 'private') {
                        if (!await IsPermission(context.user_id, easyplugin.id, command.cmd)) {
                            botlogger.info(`[${context.user_id}]无权限执行命令: ${CMD_PREFIX}${easyplugin.id} ${command.cmd}`);
                            context.quick_action([{
                                type: 'text',
                                data: { text: `你没有权限执行此命令` }
                            }]);
                            return;
                        }
                    }
                    if (context.message_type === 'group') {
                        if (!await IsPermission(context.group_id, easyplugin.id, command.cmd)) {
                            botlogger.info(`[${context.group_id}]无权限执行命令: ${CMD_PREFIX}${easyplugin.id} ${command.cmd}`);
                            context.quick_action([{
                                type: 'text',
                                data: { text: `你没有权限执行此命令` }
                            }])
                            return;
                        }
                    }
                    // 执行命令
                    await handleCommand(context, easyplugin, command, parts.slice(1), true);
                    return;
                }
                botlogger.info(`找到插件[${plugin.id}]: ${plugin.name}`);

                // 显示可用命令
                botlogger.info('可用命令:');
                plugin.commands.forEach(cmd => {
                    botlogger.info(`${CMD_PREFIX}${plugin.id} ${cmd.cmd}`);
                });

                let command: Command | undefined = undefined;
                if (cmdName == undefined) {
                    botlogger.info(`未检测到第二个参数，运行默认命令: ${plugin.config.defaultCommandId}`);

                    const commandId = plugin.config.defaultCommandId ?? "help";

                    command = findCommand(plugin, commandId);
                } else {
                    command = findCommand(plugin, cmdName);
                }

                if (!command) {
                    botlogger.info(`命令未找到: ${cmdName}`);
                    return;
                }

                botlogger.info(`找到命令: ${CMD_PREFIX}${plugin.id} ${command.cmd}`);
                //指令权限检查
                if (context.message_type === 'private') {
                    if (!await IsPermission(context.user_id, plugin.id, command.cmd)) {
                        botlogger.info(`[${context.user_id}]无权限执行命令: ${CMD_PREFIX}${plugin.id} ${command.cmd}`);
                        context.quick_action([{
                            type: 'text',
                            data: { text: `你没有权限执行此命令` }
                        }]);
                        return;
                    }
                }
                if (context.message_type === 'group') {
                    if (!await IsPermission(context.group_id, plugin.id, command.cmd)) {
                        botlogger.info(`[${context.group_id}]无权限执行命令: ${CMD_PREFIX}${plugin.id} ${command.cmd}`);
                        context.quick_action([{
                            type: 'text',
                            data: { text: `你没有权限执行此命令` }
                        }])
                        return;
                    }
                }
                // 执行命令
                await handleCommand(context, plugin, command, args);

            } catch (error) {
                botlogger.error("处理消息时出错:", error);
                await context.quick_action([{
                    type: 'text',
                    data: { text: `处理消息时出错: ${error instanceof Error ? error.message : '未知错误'}` }
                }]);
            }
        });

        botlogger.info("插件注册完成");
        botlogger.info("命令表:");
        for (const plugin of commandList) {
            botlogger.info(`[${plugin.id}]:`);
            for (const cmd of plugin.commands) {
                botlogger.info(`  ${CMD_PREFIX}${plugin.id} ${cmd.cmd}`);
            }
        }

    } catch (error) {
        botlogger.error("注册插件时出错:", error);
    }
}

// 修改 handleCommand 函数
async function handleCommand(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage, plugin: Plugin, command: Command, args: string[],easycmd:boolean=false): Promise<void> {
    try {
        // 解析参数 - 传入完整消息文本
        if (!context.message[0].type || context.message[0].type !== 'text') {
            throw new Error('消息内容为空');
        }
        const message = context.message[0].data.text || '';
        const parsedArgs = await parseCommandParams(message, context, command,easycmd);

        botlogger.info('命令参数解析完成:' + JSON.stringify({
            command: command.cmd,
            args: parsedArgs.slice(0, -1) // 不显示 context 对象
        }));
        await cost(context, command);
        // 执行命令
        const pluginInstance = new (command.class)();
        const result = await command.fn.apply(pluginInstance, parsedArgs);

        // 检查是否是群消息
        const isGroupMessage = context.message_type === 'group';
        const baseMessage = isGroupMessage && context.message_id
            ? [createReplyMessage(context.message_id)]
            : [];

        // 检查是否有模板配置
        if (result?.template?.enabled) {
            try {
                let templateIsPath: boolean = true;
                const templateHtml = result.template.html;
                const templatePath = result.template.path;
                if (templateHtml) {
                    templateIsPath = false;
                } else if (!templatePath || !fs.existsSync(templatePath)) {
                    throw new Error(`Template not found: ${templatePath}`);
                }

                // 生成图片
                const htmlImg = new HtmlImg();
                try {
                    const img = await htmlImg.render({
                        template: templateIsPath ? templatePath : templateHtml,
                        templateIsPath,
                        data: result,
                        width: result.template.render?.width || 800,
                        height: result.template.render?.height || 600,
                        type: result.template.render?.type || 'png',
                        quality: result.template.render?.quality || 100,
                        fullPage: result.template.render?.fullPage || false,
                        background: result.template.render?.background || true
                    });

                    // 发送图片
                    const base64Data = Buffer.from(img).toString('base64');
                    const imageMessage = createImageMessage(base64Data);
                    const message = [...baseMessage, imageMessage];

                    if (isGroupMessage && context.group_id) {
                        await qqBot.send_group_msg({
                            group_id: Number(context.group_id),
                            message: message as any[]
                        });
                    } else {
                        await qqBot.send_private_msg({
                            user_id: Number(context.user_id),
                            message: message as any[]
                        });
                    }

                    // 如果配置了同时发送文字
                    if (result.template.sendText) {
                        const text = result?.toString?.() || String(result);
                        const textMessage = createTextMessage(text);
                        const textOnlyMessage = [...baseMessage, textMessage];

                        if (isGroupMessage && context.group_id) {
                            await qqBot.send_group_msg({
                                group_id: Number(context.group_id),
                                message: textOnlyMessage as any[]
                            });
                        } else {
                            await qqBot.send_private_msg({
                                user_id: Number(context.user_id),
                                message: textOnlyMessage as any[]
                            });
                        }
                    }

                } finally {
                    await htmlImg.close();
                }
            } catch (error) {
                botlogger.error('图片生成失败:', error);
                // 如果图片生成失败，发送文本
                const text = result?.toString?.() || String(result);
                const textMessage = createTextMessage(text);
                const message = [...baseMessage, textMessage];

                if (isGroupMessage && context.group_id) {
                    await qqBot.send_group_msg({
                        group_id: Number(context.group_id),
                        message: message as any[]
                    });
                } else {
                    await qqBot.send_private_msg({
                        user_id: Number(context.user_id),
                        message: message as any[]
                    });
                }
            }
        } else if (result?.picture?.enabled) {

            const messages: any[] = [createImageMessage(result.picture.base64)];

            if (typeof result.picture.supplement == "string") {
                messages.push(createTextMessage(result.picture.supplement));
            }

            if (isGroupMessage && context.group_id) {
                await qqBot.send_group_msg({
                    group_id: Number(context.group_id),
                    message: messages
                });
            } else {
                await qqBot.send_private_msg({
                    user_id: Number(context.user_id),
                    message: messages
                });
            }

        }

        else if (typeof result?.redirect == "string") {
            const targetCommand = findCommand(plugin, result.redirect);
            if (!targetCommand) {
                botlogger.info(`命令未找到: ${result.redirect}`);
                return;
            }
            return await handleCommand(context, plugin, targetCommand, args);
        }

        else {
            // 发送普通文本响应
            const message = [...baseMessage, createTextMessage(result)];

            if (isGroupMessage && context.group_id) {
                await qqBot.send_group_msg({
                    group_id: Number(context.group_id),
                    message: message
                });
            } else {
                await qqBot.send_private_msg({
                    user_id: Number(context.user_id),
                    message: message
                });
            }
        }

    } catch (error: unknown) {
        botlogger.error('执行命令出错:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        await context.quick_action([{
            type: 'text',
            data: { text: `执行命令时出错: ${errorMessage}` }
        }]);
    }
}

// 导出加载插件函数
export async function loadplugins() {
    await runplugins();
}

// 修改 runcod 装饰器
export function runcod(cmd: string | string[], desc: string): MethodDecorator {
    return function decorator(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
        // 获取插件配置
        const pluginConfig = target.constructor.prototype.plugincfg;
        if (!pluginConfig) {
            botlogger.error(`未找到插件配置: ${target.constructor.name}`);
            return descriptor;
        }

        const pluginId = pluginConfig.id;
        const pluginName = pluginConfig.name;

        // 获或创建插件的命令列表
        let plugin = commandList.find((p: Plugin) => p.class === target.constructor);
        if (!plugin) {
            plugin = {
                id: pluginId,
                name: pluginName,
                commands: [],
                class: target.constructor,
                config: pluginConfig
            };
            commandList.push(plugin);
            botlogger.info(`创建新插件[${pluginId}]: ${pluginName}`);
        }

        // 使用新的命令格式
        const cmdList = Array.isArray(cmd) ? cmd : [cmd];
        const [mainCmd, ...aliases] = cmdList;

        // 修改命令创建
        const command: Command = {
            cmd: mainCmd,
            desc,
            fn: descriptor.value,
            fnName: propertyKey.toString(),
            aliases,
            cmdPrefix: CMD_PREFIX,
            pluginId: pluginId,
            class: target.constructor,
            template: {
                enabled: false,
                sendText: true
            },
        };

        plugin.commands.push(command);
        botlogger.info(`注册命令[${pluginId}]: ${CMD_PREFIX}${pluginId} ${mainCmd}`);

        return descriptor;
    };
}

// 指令花费金币
export async function cost( context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage,command: Command){
    if (economy.enable == false) {
        return;
    }
    const ecocmd = economyCommands.get(command.pluginId + "." + command.fnName);
    if (ecocmd) {
      if (ecocmd.type ==='add') {
        addCoins(context.sender.user_id.toString(), ecocmd.amount, ecocmd.reason);
      }else{
        removeCoins(context.sender.user_id.toString(), ecocmd.amount, ecocmd.reason);
      }
    }
}

// 修改参数解析函数
async function parseCommandParams(message: string, context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage, command: Command,easycmd:boolean): Promise<any[]> {
    const cmdArgs = message.split(/\s+/).filter(Boolean);

    // 移除命令前缀和命令名
    const parts = message.split(/\s+/);
    let cmdIndex = 2;
    if (easycmd) {
        cmdIndex = 1;
    }
    const paramArgs = parts.slice(cmdIndex); 

    // 调试日志
    botlogger.info('DEBUG - 命令参数:' + JSON.stringify({ paramArgs }));

    const params: any[] = [];
    const param = paramMetadata.get(command.pluginId + "." + command.fnName);
    if (param) {
        let defaultValuei = 0
        param.forEach((paramData) => {
            if (paramData.defaultValue) {
                defaultValuei++    
            }
        })
        for (const paramData of param) {
            const { name, type, index, optional } = paramData;
            const msg = `正确格式为: ${CMD_PREFIX}${command.pluginId} ${command.cmd} ${param.map(p => p.optional ? `[${p.name}]` : `<${p.name}>`).join(' ')}`
            
            if (paramArgs.length + defaultValuei < param?.length) {
                throw new Error(`参数不足,${msg}`);
            }
            if (!optional && !paramArgs[index]) {
                throw new Error(`参数 <${name}> 是必需的,${msg}`);
            }
            switch (type) {
                case "string":
                    params[index] = paramArgs[index] || '';
                    break;
                case "number":
                    params[index] = Number(paramArgs[index]) || 0;
                    if (isNaN(params[index])) {
                        throw new Error(`参数 ${name} 必须是数字,${msg}`);
                    }
                    break;
                case "boolean":
                    params[index] = paramArgs[index] === 'true';
                    if (optional && paramArgs[index] === undefined) {
                        params[index] = false;
                    }
                    break;
                case "rest":
                    params[index] = paramArgs.slice(index);
                    break;
                default:
                    throw new Error(`未知参数类型: ${type},${msg}`);
            }
            if (optional && paramArgs[index] === undefined) {
                params[index] = paramData.defaultValue;
            }
        }
    }
    // 添加 context 参数
    params.push(context);

    // 调试日志
    botlogger.info('DEBUG - 最终参数:' + JSON.stringify({
        params: params.slice(0, -1), // 不显示 context
        paramCount: params.length,
        paramArgs
    }));

    return params;
}