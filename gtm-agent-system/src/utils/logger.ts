/**
 * Structured Logger
 * Agent 시스템을 위한 구조화된 로깅
 */

import { AgentRole } from '../types/agent';

export enum LogLevel {
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

export class Logger {
  private options: LoggerOptions;
  private buffer: LogEntry[] = [];

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableBuffer: false,
      maxBufferSize: 1000,
      ...options
    };
  }

  /**
   * Child logger 생성 (Agent별 컨텍스트)
   */
  child(context: { agent?: AgentRole; sessionId?: string; prefix?: string }): Logger {
    const childLogger = new Logger({
      ...this.options,
      prefix: context.prefix || this.options.prefix
    });
    childLogger.buffer = this.buffer; // 버퍼 공유
    return Object.assign(childLogger, {
      defaultContext: context
    });
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 로그 기록
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.options.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.options.prefix ? `[${this.options.prefix}] ${message}` : message,
      data
    };

    // Console 출력
    if (this.options.enableConsole) {
      this.writeToConsole(entry);
    }

    // 버퍼 저장
    if (this.options.enableBuffer) {
      this.buffer.push(entry);
      if (this.buffer.length > (this.options.maxBufferSize || 1000)) {
        this.buffer.shift();
      }
    }
  }

  /**
   * 콘솔 출력
   */
  private writeToConsole(entry: LogEntry): void {
    const levelStr = LogLevel[entry.level].padEnd(5);
    const time = entry.timestamp.split('T')[1].split('.')[0];
    const prefix = `[${time}] ${levelStr}`;

    const msg = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(msg, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(msg, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(msg, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(msg, entry.data || '');
        break;
    }
  }

  /**
   * 버퍼 조회
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * 버퍼 클리어
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }
}

// 기본 로거 인스턴스
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableBuffer: true
});

// Agent별 로거 생성 헬퍼
export function createAgentLogger(role: AgentRole, sessionId?: string): Logger {
  return logger.child({
    agent: role,
    sessionId,
    prefix: role.toUpperCase()
  });
}
