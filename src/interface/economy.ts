import { Prop } from "./prop.js";

export interface UserData {
    userId: string; 
    economy:{
        coins: number;
        logs: Economylogs[];
    },
    props:Prop[]
}
export interface Economylogs {
    type: 'add' | 'remove';
    amount: number;
    reason: string;
    date: string;
}
export interface EconomyCommands {
    name: string; 
    type: 'add' | 'remove';
    amount: number;
    reason: string;
}