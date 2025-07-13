import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from "node-napcat-ts";
import { commandList, param, plugins, runcod } from "../lib/decorators.js";
import { addPermission, getuserPermissions, IsAdmin, removePermission } from "../lib/Permission.js";

@plugins({
    easycmd: false,//是否启用简易命令，启用将将命令注册为<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "权限管理道具", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "官方权限插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示道具插件" //帮助信息描述
    }
})
export class Permission{
    @runcod(["list", "查看权限"],"查看权限" )
    async list(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if(await IsAdmin(context?.sender?.user_id)){
            return "你是管理员,拥有所有权限"
        }
        const Data = await getuserPermissions(context?.sender?.user_id.toString()??"0")
        if(Data.length === 0){
            return "你没有设置任何权限"
        }
        let s ='权限列表:\n'
        Data.forEach((permission) => {
            const parts = permission.split('.');
            const pluginName = parts[0];
            const commandName = parts[1];
            commandList.forEach((command) => {
                if(command.id === pluginName){
                    s += `插件：${command.name}\n`;
                    command.commands.forEach((cmd) => {
                        if(cmd.fnName === commandName){
                            s += `指令：${command.name}【${cmd.cmd}】有权限 \n`;
                        }else{
                            s += `指令：${command.name}【${cmd.fnName}】无权限 \n`;
                        }
                    })
                }else{
                    s += `插件：${command.name} 无权限 \n`;
                }
            })
            return s;
        })

    }
    @runcod(["add", "添加权限"],"添加权限,指令为空则未拥有该插件下所有命令权限" )
    async add(
        @param("qq号","at") userid: Receive["at"],
        @param("插件名称","text") Userplugin: Receive["text"],
        @param("指令名称","text",{type:'text',data:{text:"-1"}},true) Usercommand: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if(await IsAdmin(Number(userid?.data?.qq))){
            return "你是管理员,拥有所有权限"
        }
        commandList.forEach((command) => {
            if(command.id === Userplugin?.data?.text && Usercommand?.data?.text==="-1"){
                command.commands.forEach((cmd) => {
                    addPermission(Number(userid?.data?.qq).toString(),command.id,cmd.fnName)
                })
            }
            if(command.id === Userplugin?.data?.text && Usercommand?.data?.text!="-1"){
                command.commands.forEach((cmd) => {
                    if(cmd.fnName === Usercommand?.data?.text){
                        addPermission(Number(userid?.data?.qq).toString(),command.id,cmd.fnName)
                    }
                })
            }
        })
        return "添加权限成功"
    }
    @runcod(["remove", "移除权限"],"移除权限,指令为空则移除该插件下所有命令权限" )
    async remove(
        @param("插件名称","at") userid: Receive["at"],
        @param("插件名称","text") Userplugin: Receive["text"],
        @param("指令名称","text",{type:'text',data:{text:"-1"}},true) Usercommand: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage      
    ){
        if(await IsAdmin(Number(userid?.data?.qq))){
            return "你是管理员,拥有所有权限"
        }
        commandList.forEach((command) => {
            if(command.id === Userplugin?.data?.text && Usercommand?.data?.text==="-1"){
                command.commands.forEach((cmd) => {
                    removePermission(Number(userid?.data?.qq).toString(),command.id,cmd.fnName)
                })
            }
            if(command.id === Userplugin?.data?.text && Usercommand?.data?.text!="-1"){
                command.commands.forEach((cmd) => {
                    if(cmd.fnName === Usercommand?.data?.text){
                        removePermission(Number(userid?.data?.qq).toString(),command.id,cmd.fnName)
                    }
                })
            }
        })
    }
}