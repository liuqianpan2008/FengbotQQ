export interface UserData {
    userId: string; 
    coins: number;
    logs: Economylogs[];
}
export interface Economylogs {
    type: 'add' | 'remove';
    amount: number;
    reason: string;
    date: Date;
}
export interface EconomyCommands {
    name: string; 
    type: 'add' | 'remove';
    amount: number;
    reason: string;
}