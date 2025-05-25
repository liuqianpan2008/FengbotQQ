export interface Prop{
    propId: string;// 道具ID
    fn: Function; // 道具函数名
    propName: string; // 道具名称
    describe?: string;
    Num: number; // 道具数量
    maxuse: number; // 道具最大使用次数
    img?: string; // 道具图片
    price: number; // 道具价格
    classConstructor:any;
}
export interface UserProp{
    propId: string;
    Num: number;
}