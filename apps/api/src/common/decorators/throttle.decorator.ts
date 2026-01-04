import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * 敏感接口限流 - 每分钟 5 次
 * 用于：登录、注册、密码重置等
 */
export const ThrottleSensitive = () => Throttle({ default: { ttl: 60000, limit: 5 } });

/**
 * 严格限流 - 每分钟 3 次
 * 用于：验证码发送、敏感操作
 */
export const ThrottleStrict = () => Throttle({ default: { ttl: 60000, limit: 3 } });

/**
 * 宽松限流 - 每分钟 200 次
 * 用于：读取操作
 */
export const ThrottleRelaxed = () => Throttle({ default: { ttl: 60000, limit: 200 } });

/**
 * AI 接口限流 - 每分钟 20 次
 * 用于：AI 对话、预测等
 */
export const ThrottleAI = () => Throttle({ default: { ttl: 60000, limit: 20 } });

/**
 * 跳过限流
 */
export { SkipThrottle };



