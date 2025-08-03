export declare const testUtils: {
    wait: (ms: number) => Promise<unknown>;
    createMockScraperConfig: (overrides?: {}) => {
        baseUrl: string;
        timeout: number;
        rateLimit: number;
        headers: {
            'User-Agent': string;
        };
    };
    randomString: (length?: number) => string;
    generateMockHTML: (options?: {
        title?: string;
        content?: string;
        codeBlocks?: string[];
        apiSections?: Array<{
            title: string;
            content: string;
        }>;
    }) => string;
    validateTestEnvironment: () => void;
};
//# sourceMappingURL=setup.d.ts.map