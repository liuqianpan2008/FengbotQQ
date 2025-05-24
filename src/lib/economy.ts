
import { UserData } from "../interface/economy.js";
import fs from 'fs';
import { economy } from "./config.js";


export function addCoins(userId: string, amount: number, reason: string): void {
    const userData = getUserData(userId);
    userData.coins += amount;
    userData.logs.push({
        type: 'add',
        amount: amount,
        reason: reason,
        date: new Date()
    });
    saveUserData(userId, userData);
}
export function removeCoins(userId: string, amount: number, reason: string): void {
    const userData = getUserData(userId);
    if (userData.coins < amount) {
        throw new Error(`${economy.name}不足，需要${amount}${economy.currency},拥有${userData.coins}${economy.currency}`);
    }
    userData.coins -= amount;
    userData.logs.push({
        type: 'remove',
        amount: amount,
        reason: reason,
        date: new Date()
    });
     saveUserData(userId, userData);
}
function getUserData(userId: string): UserData {
    if (!fs.existsSync(`${economy.data.path}`)) {
        throw new Error(`未找到用户数据目录，请检查配置文件`);
    }
    if (!fs.existsSync(`${economy.data.path}/${userId}.json`)) {
        const newUserData: UserData = {
            userId: userId,
            coins: economy.data.defaultCoins,
            logs: []
        };
        fs.writeFileSync(`${economy.data.path}/${userId}.json`, JSON.stringify(newUserData, null, 4));
        return newUserData;
    }
    const userData = JSON.parse(fs.readFileSync(`${economy.data.path}/${userId}.json`, 'utf-8')) as UserData;
    return userData;
}
function  saveUserData(userId: string, userData: UserData): void {
    if (!fs.existsSync(`${economy.data.path}`)) {
        throw new Error(`未找到用户数据目录，请检查配置文件`);
    }
    fs.writeFileSync(`${economy.data.path}/${userId}.json`, JSON.stringify(userData, null, 4));
}