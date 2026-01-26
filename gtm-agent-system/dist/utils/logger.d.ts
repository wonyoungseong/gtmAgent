/**
 * Structured Logger
 * Agent 시스템을 위한 구조화된 로깅
 */
import { AgentRole } from '../types/agent';
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    agent?: AgentRole;
    sessionId?: string;
    message: string;
    data?: any;
}
export interface LoggerOptions {
    level: LogLevel;
    prefix?: string;
    enableConsole?: boolean;
    enableBuffer?: boolean;
    maxBufferSize?: number;
}
export declare class Logger {
    private options;
    private buffer;
    constructor(options?: Partial<LoggerOptions>);
    /**
     * Child logger 생성 (Agent별 컨텍스트)
     */
    child(context: {
        agent?: AgentRole;
        sessionId?: string;
        prefix?: string;
    }): Logger;
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    /**
     * 로그 기록
     */
    private log;
    /**
     * 콘솔 출력
     */
    private writeToConsole;
    /**
     * 버퍼 조회
     */
    getBuffer(): LogEntry[];
    /**
     * 버퍼 클리어
     */
    clearBuffer(): void;
    /**
     * 로그 레벨 설정
     */
    setLevel(level: LogLevel): void;
}
export declare const logger: Logger;
export declare function createAgentLogger(role: AgentRole, sessionId?: string): Logger;
