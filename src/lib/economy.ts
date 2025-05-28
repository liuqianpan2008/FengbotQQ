import { UserData } from "../interface/economy.js";
import fs from 'fs';
import { economy } from "./config.js";


export function addCoins(userId: string, amount: number, reason: string): void {
    const userData = getUserData(userId);
    if(userData){
        userData.economy.coins += amount;
        userData.economy.logs.unshift({
            type: 'add',
            amount: amount,
            reason: reason,
            date: formatDate(new Date())
        });
        saveUserData(userId, userData);
    }
}
export function removeCoins(userId: string, amount: number, reason: string): void {
    const userData = getUserData(userId);
    if (!userData) {
        throw new Error(`未找到用户数据`);
    }
    if (userData.economy.coins < amount) {
        throw new Error(`${economy.name}不足，需要${amount}${economy.currency},拥有${userData.economy.coins}${economy.currency}`);
    }
    userData.economy.coins -= amount;
    userData.economy.logs.unshift({
        type: 'remove',
        amount: amount,
        reason: reason,
        date: formatDate(new Date())
    });
     saveUserData(userId, userData);
}
export function getUserData(userId: string): UserData|null {
    if (!fs.existsSync(`${economy.data.path}`)) {
        throw new Error(`未找到用户数据目录，请检查配置文件`);
    }
    if (!userId) {
        return null
    }
    if (!fs.existsSync(`${economy.data.path}/${userId}.json`)) {
        const newUserData: UserData = {
            userId: userId,
            economy: {
                coins: economy.data.defaultCoins,
                logs: [],
                
            },
            props: [],
            Permission: []
        };
        fs.writeFileSync(`${economy.data.path}/${userId}.json`, JSON.stringify(newUserData, null, 4));
        return newUserData;
    }
    const userData = JSON.parse(fs.readFileSync(`${economy.data.path}/${userId}.json`, 'utf-8')) as UserData;
    return userData;
}
export function saveUserData(userId: string, userData: UserData): void {
    if (!fs.existsSync(`${economy.data.path}`)) {
        throw new Error(`未找到用户数据目录，请检查配置文件`);
    }
    fs.writeFileSync(`${economy.data.path}/${userId}.json`, JSON.stringify(userData, null, 4));
}
//格式化时间
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}