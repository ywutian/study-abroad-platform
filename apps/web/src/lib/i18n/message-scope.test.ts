import { describe, expect, it } from 'vitest';
import { ADMIN_ONLY_NAMESPACES, stripAdminNamespaces } from './message-scope';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

describe('stripAdminNamespaces', () => {
  it('剥掉 admin，保留其余 namespace', () => {
    const scoped = stripAdminNamespaces({ admin: { a: 1 }, common: { b: 2 } });
    expect(scoped).toEqual({ common: { b: 2 } });
  });

  it('不修改入参（provider 会复用同一个 messages 对象）', () => {
    const original = { admin: { a: 1 }, common: { b: 2 } };
    stripAdminNamespaces(original);
    expect(original.admin).toEqual({ a: 1 });
  });

  it('namespace 不存在时不报错', () => {
    expect(stripAdminNamespaces({ common: { b: 2 } })).toEqual({ common: { b: 2 } });
  });

  it.each(['en', 'zh'])('%s 字典里 ADMIN_ONLY_NAMESPACES 全部真实存在', (locale) => {
    const messages = (locale === 'en' ? en : zh) as Record<string, unknown>;
    for (const ns of ADMIN_ONLY_NAMESPACES) {
      expect(messages).toHaveProperty(ns);
    }
  });

  // 收益回归哨兵：如果哪天 admin 被拆散或搬走，这条会失败，提醒重新评估分域是否还值得
  it.each(['en', 'zh'])('%s 分域后至少省下 15% 体积', (locale) => {
    const messages = (locale === 'en' ? en : zh) as Record<string, unknown>;
    const full = JSON.stringify(messages).length;
    const scoped = JSON.stringify(stripAdminNamespaces(messages)).length;
    expect((full - scoped) / full).toBeGreaterThan(0.15);
  });
});
