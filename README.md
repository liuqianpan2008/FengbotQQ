> 兄弟项目：[FengQBotNext(JS版本)](https://github.com/actredphos2017/FengQBotNext)
# 插件文档

最简单的插件示范：

```ts
//PLUGIN test.ts <- 这是插件识别前缀，用于识别和自动安装（必要） test.ts 是插件文件名,和类名保持一致

@Plugin({
    easycmd: true,//是否启用简易命令，启用将将命令注册为#<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "测试插件", //插件名称，用于在系统生成帮助菜单中显示插件名称
    version: "1.0.0", //插件版本号，用于在系统生成帮助菜单中显示插件名称
    describe: "测试功能", //插件描述，用于在系统生成帮助菜单中显示插件名称
    author: "枫叶秋林",//插件作者，用于在系统生成帮助菜单中显示插件名称
    help: { //插件帮助信息，用于开启系统自动生成帮助菜单 #<插件名称> help/ #<命令名称>
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class test {
    @runcod(
        ["param"], //命令名称，用于触发命令,可以多个命令名称，用空格分隔，例如：["param", "param2"]
        "参数实例" //命令描述，用于显示系统生成的帮助菜单中
    )//命令装饰器，用于注册命令
    async param( //命令函数，用于处理命令
        @param(
            "参数1", //参数名称，用于显示在菜单中 
            ParamType.String //参数类型，用于解析参数
        )
         param1: string,//参数装饰器，用于解析参数

        @param(
            "参数2", //参数名称，用于显示在菜单中
            ParamType.Number, //参数类型，用于解析参数
            999, //参数默认值，当获取不到参数时，将使用默认值。
            true //是否必填，当为true时，当获取不到参数时，将返回错误信息
         ) param2: number,//参数装饰器，用于解析参数
    ): Promise<any> //返回值类型，用于返回响应内容。 
    {
        if (!param1 || !param2) {
            return "请输入正确的参数格式: #test param <字符串> <数字>";//返回错误信息，用于显示在菜单中
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        // 返回带模板的响应
        return {
            param1,//参数1，用于显示在模版渲染中
            param2,//参数2，用于显示在模版渲染中
            template: { // 模板配置，用于发送图片内容
                enabled: true,//是否启用模板，启用将发送图片内容
                sendText: false,//是否发送文本，启用将发送文本内容，如果都启用则发送两条消息
                path: path.resolve(__dirname, '..', 'resources', 'test', 'param.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 300,// 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true// 是否背景
                }
            },
            toString() { // 用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                return `参数1(字符串): ${param1}\n参数2(数字): ${param2}`;
            }
        };
    }


}
```
直接将这段代码文件复制到机器人的私聊（如果代码不长、可以发送的话）进行安装，也可以将 ts 代码文件上传到包含机器人的群聊进行安装。

## 经济模块
使用 `@coins` 装饰器可以将一个方法标记为经济模块，该方法将在机器人收到消息时被调用。
> 需在配置文件中`confing/economy.ts` 中配置 `enable: true` 为 true 才能使用。
```ts
    @runcod(["remove"], "移除金币")//命令装饰器，用于注册命令
    @coins(
        10,//金币数量
        'remove',//类别 add为增加金币，remove为减少金币
    ) //经济修饰词，用于减少金币
    async remove(){
        return `移除成功`;
    }
```
当使用命令调用该方法，该方法会判断你的帐号金币数量，若金币数量足够可以扣除相应的金币执行该方法。

## 定时模块
使用 `@cron` 装饰器可以将一个方法标记为定时模块，该方法将在机器人启动时被调用。
```ts
    @schedule('* */30 * * * *') // 每30分钟执行一次
    async testschedule() {
        botlogger.info("定时任务测试")
    }
```
运行结果： 每30分钟执行一次，日志输出：定时任务测试

## 配置详解
### 配置文件
配置文件位于 `confing` 目录下。
`bot.yml` 用于配置机器人的基本信息。**需配置完整bot文件Bot才能正常启动**

```yml
bot:
  protocol: "ws"  # 协议 ws/wss
  host: "192.168.100.249"  # 主机地址
  port: 3001  # 端口号
  accessToken: "fenglin666"  # 访问令牌
  throwPromise: true
  reconnection: # 重连配置
    enabled: true
    attempts: 10
    delay: 5000
cmd:
 prefix: "#" # 命令前缀

```

`economy.ts` 用于配置机器人的经济模块
```yml
# 经济系统配置
name: "金币" # 名称
enable: true # 是否启用经济系统
currency: 元 # 货币单位
decimal: 2 # 小数位数
data:
  path: "/Users/fenglin/Desktop/botQQ/data" # 数据路径
  defaultCoins: 0 # 默认金额
```
`load.yml` 用于配置机器人的插件热重载
```yml
# 热重载插件配置文件
enable: true # 是否启用热重载
isuplad: false # 是否上传到服务器 无需配置，程序记录值
name: sakulin.ts # 插件文件名 无需配置，程序记录值
id: 2180323481 # 触发ID 无需配置，程序记录值
isGroupMessage: false # 是否为群消息 无需配置，程序记录值
```
`permission.yml` 用于配置机器人的权限模块
```yml
enable: true # 是否启用权限系统
admins: # 管理员列表
  - '2180323481' # 管理员QQ号
  - '1814872986' # 管理员QQ号
users: # 用户列表
  '211249983': # 权限qq号
    plugins: # 插件权限
        test: # 插件名称
            commands:
                help: true  # 帮助指令指令权限
                param: true # 参数指令指令权限
```

### 联系我
QQ群: 211249983
