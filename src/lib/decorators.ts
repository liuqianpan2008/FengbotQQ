import * as path from 'path';
import botlogger from './logger.js';
// 读取配置文件
import { Botconfig as config } from './config.js'
const CMD_PREFIX = config?.cmd?.prefix ?? '#';
import { fileURLToPath } from 'node:url';
import { Command, CommandConfig, ParamMetadata, ParamType, PluginConfig } from '../interface/plugin.js';
import { Plugin } from '../interface/plugin.js';




// 存储参数元数据
export const paramMetadata = new Map<string, ParamMetadata[]>();
// 存储命令的数组
export const commandList: Plugin[] = [];

// 修改参数装饰器
export function param(name: string, type: ParamType = ParamType.String, optional: boolean = false): ParameterDecorator {

    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number): void {
        const actualPropertyKey = propertyKey!;
        //获得fn所在的类名和方法名
        const fnName = `${target.constructor.name}.${actualPropertyKey.toString()}`;
        let metadata = paramMetadata.get(fnName);

        if (!metadata) {
            metadata = [];
            paramMetadata.set(fnName, metadata);
        }

        const paramData: ParamMetadata = {
            name,
            type,
            index: parameterIndex,
            optional: optional
        };

        metadata[parameterIndex] = paramData;
    };
}




// 修改插件装饰器
export function plugins(config: PluginConfig): ClassDecorator {
    return function (target: any): void {
        // 保存插件配置
        target.prototype.plugincfg = config;

        // 确保插件名称正确
        const existingPlugin = commandList.find((x) => x.class === target);
        let plugin: Plugin;

        if (existingPlugin) {
            // 更新现有插件的配置
            existingPlugin.name = config.name;
            plugin = existingPlugin;
        } else {
            // 添加新插件
            plugin = {
                id: config.id,
                name: config.name,
                class: target,
                commands: [] as Command[],
                config
            };
            commandList.push(plugin);
            // 添加调试日志
            botlogger.info(`发现插件: ${config.name}[${config.version}],插件类: ${target.name}`);
        }

        // 添加帮助命令
        if (config.help?.enabled !== false) {
            const helpCommand: Command = {
                cmd: 'help',
                desc: config.help?.description || "显示帮助信息",
                aliases: ['帮助', '?'],
                template: {
                    enabled: true,
                    sendText: false
                },
                cmdPrefix: CMD_PREFIX,
                pluginId: config.id,
                class: target,
                fn: async function (): Promise<object> {
                    const plugin = commandList.find(p => p.class === target);
                    if (!plugin) {
                        return {
                            message: "错误: 找不到插件信息"
                        };
                    }
                    // 过滤并格式化命令列表
                    const commands = plugin.commands
                        .filter(cmd => !cmd.cmd.endsWith('help'))
                        .map(cmd => {
                            const fullCmd = `${CMD_PREFIX}${plugin.id} ${cmd.cmd}`;
                            const aliases = cmd.aliases?.map(alias =>
                                `${CMD_PREFIX}${plugin.id} ${alias}`
                            ) || [];

                            return {
                                name: cmd.cmd,
                                fullCmd,
                                desc: cmd.desc,
                                aliases
                            };
                        });

                    const __dirname = path.dirname(fileURLToPath(import.meta.url));
                    // 返回支持模板的响应对象
                    return {
                        title: plugin.name,
                        version: config.version || '',
                        description: config.describe || '',
                        author: config.author || '',
                        commands,
                        pluginId: plugin.id,
                        cmdPrefix: CMD_PREFIX,
                        template: {
                            name: 'help',
                            path: path.join(__dirname, '..', 'resources', 'help', 'help.html'),
                            enabled: true,
                            sendText: false,
                            render: {
                                width: 800,
                                height: 1600,
                                type: 'png',
                                quality: 100,
                                fullPage: false,
                                background: true
                            }
                        },
                        toString() {
                            const commandsText = commands.map(cmd => {
                                let text = `${cmd.fullCmd} - ${cmd.desc}`;
                                if (cmd.aliases.length > 0) {
                                    text += `\n  别名: ${cmd.aliases.join(', ')}`;
                                }
                                return text;
                            }).join('\n');

                            return [
                                `=== ${plugin.name} ===`,
                                `版本: ${config.version}`,
                                config.describe ? `描述: ${config.describe}` : '',
                                config.author ? `作者: ${config.author}` : '',
                                '',
                                '可用命令:',
                                commandsText
                            ].filter(Boolean).join('\n');
                        }
                    };
                },
            };

            plugin.commands.push(helpCommand);
            botlogger.info(`成功注册[${plugin.id}]帮助命令: ${CMD_PREFIX}${plugin.id} help`);
        }

        // 检查并添加默认命令
        if (!config.defaultCommandId) {
            config.defaultCommandId = "help";
        }
    };
}



// 修改 runcod 装饰器
/**
 * 运行命令装饰器
 * @param cmd - 命令名称或别名数组
 * @param desc - 命令描述
 * @param config - 命令配置
 */
//权限
export function runcod(cmd: string | string[], desc: string, config: CommandConfig = {}, IsTest = false): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        // 延迟执行命令注册
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            // 获取插件配置
            const pluginConfig = target.constructor.prototype.plugincfg;
            if (!pluginConfig) {
                botlogger.error(`未找到插件配置: ${target.constructor.name}`);
                return originalMethod.apply(this, args);
            }

            const pluginName = pluginConfig.name;

            // 获取或创建插件的命令列表
            let plugin = commandList.find((p: Plugin) => p.class === target.constructor);
            if (!plugin) {
                plugin = {
                    id: pluginConfig.id,
                    name: pluginName,
                    commands: [] as Command[],
                    class: target.constructor,
                    config: pluginConfig
                };
                commandList.push(plugin);
                botlogger.info(`创建新插件: ${pluginName}`);
            }

            // 如果命令还没有注册
            if (!descriptor.value.isCommand) {
                const cmdList = Array.isArray(cmd) ? cmd : [cmd];
                const allCmds = cmdList.map(c => c);

                // 第一个命令作为主命令，其他的作为别名
                const [mainCmd, ...aliases] = allCmds;

                // 添加命令
                const command: Command = {
                    cmd: mainCmd,
                    desc,
                    fn: descriptor.value,
                    aliases,
                    cmdPrefix: CMD_PREFIX,
                    pluginId: plugin.id,
                    class: target.constructor,
                    template: {
                        enabled: !IsTest,
                        sendText: IsTest, // 默认不发送文本,
                        ...(config.template || {})
                    },
                    paramdata: paramMetadata.get(target.constructor.prototype[propertyKey]) || [],
                };

                plugin.commands.push(command);

                // 修改日志输出
                botlogger.info(`注册插件${plugin.id}命令: ${CMD_PREFIX}${plugin.id} ${mainCmd} 成功`);

                // 添加命令标记
                descriptor.value.isCommand = true;
                descriptor.value.cmd = Array.isArray(cmd) ? cmd[0] : cmd;
                descriptor.value.desc = desc;
                descriptor.value.aliases = Array.isArray(cmd) ? cmd.slice(1) : [];
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}


// 添加定时任务装饰器
export function schedule(cron: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        // 保存原始方法
        const originalMethod = descriptor.value;

        // 添加定时任务标记
        descriptor.value.isScheduled = true;
        descriptor.value.cron = cron;
        descriptor.value.methodName = propertyKey;

        // 返回修改后的描述符
        return descriptor;
    };
}
