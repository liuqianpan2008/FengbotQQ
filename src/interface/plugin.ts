import { Receive } from "node-napcat-ts";

// 更新 Plugin 接口
export interface Plugin {
    id: string;
    name: string;
    commands: Command[];
    class: any;
    version?: string;
    author?: string;
    describe?: string;
    config: PluginConfig
}

// 修改插件装饰器配置接口
export interface PluginConfig {
    easycmd?: boolean;
    name: string;// 插件名称
    version?: string;// 插件版本
    describe?: string;// 插件描述
    author?: string;// 插件作者
    help?: {// 帮助命令配置,使用框架默认的帮助配置
        enabled?: boolean;      // 是否启用帮助命令
        command?: string[];     // 帮助命令
        description?: string;   // 帮助命令描述
    };
    defaultCommandId?: string; // 默认函数
}

// 在 decorators.ts 中定义统一的接口
export interface Command {
    cmd: string;        // 命令名称
    desc: string;       // 命令描述
    fnName: string;    // 函数名称
    fn: Function;       // 命令函数
    aliases?: string[]; // 命令别名
    cmdPrefix: string;  // 命令前缀
    pluginId: string;   // 插件ID
    class: new () => any;
    template?: {
        enabled: boolean;   // 是否启用模板
        sendText: boolean;  // 是否发送文本
        [key: string]: any; // 其他模板配置
    };
}
// 参数元数据接口
export interface ParamMetadata {
    name: string; // 参数名称
    type: "text" | "image" | "reply" | "poke" | "at" | "file" | "dice" | "rps" | "face" | "video" | "record" | "forward" | "json" | "markdown"; // 参数类型
    index: number; // 参数索引
    defaultValue?: Receive[keyof Receive]; // 默认值
    optional: boolean; // 是否可选
}
// 添加模板配置接口
export interface TemplateConfig {
    enabled: boolean;
    sendText: boolean;
    [key: string]: any;
}

// 修改命令装饰器配置
export interface CommandConfig {
    template?: TemplateConfig;
    [key: string]: any;
}

