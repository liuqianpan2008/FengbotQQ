// 添加金币相关的fn装饰器

import { Prop } from "../interface/prop.js";
import { getUserData, saveUserData } from "./economy.js";
import botlogger from "./logger.js";

export const Props = new Map<string,Prop>();
/**
 * 道具相关的fn装饰器
 * @param propId 道具ID
 * @param propName 道具名称
 * @param img 道具图片
 * @param price 道具价格
 */
export function prop(propId:string,propName: string, maxuse: number=1, describe?: string ,img?: string ,price?: number) {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor): void {
        const actualPropertyKey = propertyKey!;
        const fnName = `${target.constructor.name}.${actualPropertyKey.toString()}`;
        const constructor = target.constructor;
        
        const prop:Prop  = {
            maxuse: maxuse,
            propId: propId,
            fn: descriptor.value.bind(target),
            describe:describe,
            Num: 0,
            propName: propName,
            img: img,
            price: price || 0,
            classConstructor: constructor
        };
        Props.set(fnName,prop)
        botlogger.info(`注册${prop.propName}道具成功！`)
    };
}

export function getProp(fnName: string): Prop | undefined {
    return Props.get(fnName);
}

export async function getuserProp(userId: string): Promise<Prop[]> {
    return await getUserData(userId).props;
}
// 减少道具数量
export async function reduceProp(userId: string, propId: string, Num: number = 1): Promise<boolean> {
    const userProp = await getuserProp(userId) || [];
    let addprop = userProp.find((prop) => prop.propId === propId);
    if (!addprop) {
        return false
    }else{
        addprop.Num -= Num;
    }
    // 保存道具数据
    const userData = await getUserData(userId)
    userData.props = userProp;
    await saveUserData(userId,userData);
    return true;
}
export async function addProp(userId: string, propId: string, Num: number = 1): Promise<boolean> {
    const userProp = await getuserProp(userId) || [];
    let addprop = userProp.find((prop) => prop.propId === propId);
    if (!addprop) {
        Props.forEach(prop=>{
            if (prop.propId === propId) {
                addprop = prop
                addprop.Num = Num
                userProp.push(addprop)
            }
        })
    }else{
        addprop.Num += Num;
    }
    // 保存道具数据
    const userData = await getUserData(userId)
    userData.props = userProp;
    await saveUserData(userId,userData);
    return true;
}