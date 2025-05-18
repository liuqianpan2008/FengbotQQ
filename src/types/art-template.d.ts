declare module 'art-template' {
    // 定义artTemplate render的默认配置
    interface artTemplateDefaults {
        escape?: boolean;
        minimize?: boolean;
        filename?: string;
    }
    // 定义artTemplate的默认配置
    interface artTemplate {
        defaults: artTemplateDefaults;
        extension: { [key: string]: Function };
        render(source: string, data: any, options?: any): string;
        compile(source: string, options?: any): (data: any) => string;
    }
    // 定义artTemplate的默认配置
    const artTemplate: artTemplate;
    export = artTemplate;

    function template(filename: string, data: any): string;

    export = template;
} 

