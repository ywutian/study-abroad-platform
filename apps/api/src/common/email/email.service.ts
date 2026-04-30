import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
    this.fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') || 'Lumni';

    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.logger.log('Resend email service initialized');
    } else {
      this.logger.warn(
        'RESEND_API_KEY not configured - emails will be logged only',
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    if (!this.resend) {
      this.logger.log(`[EMAIL MOCK] To: ${String(to)}, Subject: ${subject}`);
      this.logger.debug(
        `[EMAIL MOCK] Content: ${text || html.substring(0, 200)}...`,
      );
      return true;
    }

    try {
      const toArray = Array.isArray(to) ? to : [to];
      const { error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: toArray,
        subject,
        html,
        text: text || this.htmlToText(html),
      });

      if (error) {
        this.logger.error(`Resend error for ${String(to)}: ${error.message}`);
        return false;
      }

      this.logger.log(`Email sent to ${String(to)}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${String(to)}`, error);
      return false;
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Pre-built email templates
  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const verifyUrl = `${this.configService.get('FRONTEND_URL')}/verify-email/callback?token=${token}`;

    return this.sendEmail({
      to,
      subject: '验证您的邮箱 - Lumni',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1d1813; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #1d1813; color: #fff7ea; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #d8c8b2; color: #6f665b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #1d1813; margin: 0;">Lumni</h1>
            </div>
            <div class="content">
              <h2>验证您的邮箱</h2>
              <p>感谢您注册 Lumni！请点击下方按钮验证您的邮箱地址：</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" class="button">验证邮箱</a>
              </p>
              <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
              <p style="word-break: break-all; color: #6f665b;">${verifyUrl}</p>
              <p>此链接24小时内有效。</p>
            </div>
            <div class="footer">
              <p>© 2026 Lumni</p>
              <p>如果您没有注册账号，请忽略此邮件。</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    return this.sendEmail({
      to,
      subject: '重置密码 - Lumni',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1d1813; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #1d1813; color: #fff7ea; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #d8c8b2; color: #6f665b; font-size: 12px; }
            .warning { background: #f7e8c4; border: 1px solid #ddb85a; padding: 12px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #1d1813; margin: 0;">Lumni</h1>
            </div>
            <div class="content">
              <h2>重置您的密码</h2>
              <p>我们收到了您的密码重置请求。点击下方按钮设置新密码：</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">重置密码</a>
              </p>
              <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
              <p style="word-break: break-all; color: #6f665b;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ 安全提示</strong>
                <p style="margin: 5px 0 0;">此链接1小时内有效。如果您没有请求重置密码，请忽略此邮件，您的账号是安全的。</p>
              </div>
            </div>
            <div class="footer">
              <p>© 2026 Lumni</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  async sendWelcomeEmail(to: string, userName?: string): Promise<boolean> {
    const loginUrl = `${this.configService.get('FRONTEND_URL')}/login`;

    return this.sendEmail({
      to,
      subject: '欢迎加入 Lumni！',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1d1813; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #1d1813; color: #fff7ea; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #d8c8b2; color: #6f665b; font-size: 12px; }
            .features { background: #fff4e2; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature { display: flex; align-items: center; margin: 10px 0; }
            .feature-icon { width: 24px; height: 24px; margin-right: 10px; color: #1d1813; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #1d1813; margin: 0;">Lumni</h1>
            </div>
            <div class="content">
              <h2>欢迎${userName ? `, ${escapeHtml(userName)}` : ''}！</h2>
              <p>感谢您加入 Lumni，你的留学申请流程从这里开始！</p>
              
              <div class="features">
                <h3 style="margin-top: 0;">平台功能</h3>
                <div class="feature">📊 <span>AI 录取预测 - 了解您的申请竞争力</span></div>
                <div class="feature">📚 <span>案例库 - 浏览真实录取案例</span></div>
                <div class="feature">🏫 <span>学校榜单 - 自定义权重排名</span></div>
                <div class="feature">✍️ <span>文书助手 - AI 辅助文书修改</span></div>
              </div>

              <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" class="button">开始使用</a>
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Lumni</p>
              <p>有任何问题？随时联系我们的支持团队</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // 账号删除确认邮件
  async sendAccountDeletionEmail(to: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: '账号删除确认 - Lumni',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #ef4444; }
            .content { padding: 30px 0; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #d8c8b2; color: #6f665b; font-size: 12px; }
            .warning { background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #ef4444; margin: 0;">账号删除确认</h1>
            </div>
            <div class="content">
              <p>您的账号删除请求已处理。</p>
              
              <div class="warning">
                <strong>重要信息：</strong>
                <ul style="margin: 10px 0 0; padding-left: 20px;">
                  <li>您的数据将在 30 天内被永久删除</li>
                  <li>在此期间，您可以联系客服恢复账号</li>
                  <li>30 天后，所有数据将不可恢复</li>
                </ul>
              </div>

              <p>如果这不是您本人操作，请立即联系我们的支持团队。</p>
            </div>
            <div class="footer">
              <p>© 2026 Lumni</p>
              <p>客服邮箱：support@studyabroad.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // 订阅成功邮件
  async sendSubscriptionConfirmationEmail(
    to: string,
    planName: string,
    amount: number,
    currency: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: `订阅成功 - ${escapeHtml(planName)} - Lumni`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1d1813; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #1d1813; color: #fff7ea; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #d8c8b2; color: #6f665b; font-size: 12px; }
            .receipt { background: #fff4e2; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .receipt-row { display: flex; justify-content: space-between; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #1d1813; margin: 0;">✅ 订阅成功</h1>
            </div>
            <div class="content">
              <p>感谢您订阅 <strong>${escapeHtml(planName)}</strong>！您现在可以享受所有高级功能。</p>
              
              <div class="receipt">
                <h3 style="margin-top: 0;">订单详情</h3>
                <div class="receipt-row">
                  <span>计划：</span>
                  <strong>${escapeHtml(planName)}</strong>
                </div>
                <div class="receipt-row">
                  <span>金额：</span>
                  <strong>${currency === 'CNY' ? '¥' : '$'}${amount}</strong>
                </div>
                <div class="receipt-row">
                  <span>日期：</span>
                  <span>${new Date().toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              <p style="text-align: center; margin: 30px 0;">
                <a href="${this.configService.get('FRONTEND_URL')}/settings/subscription" class="button">管理订阅</a>
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Lumni</p>
              <p>如有问题，请联系 billing@studyabroad.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // 联系客服邮件
  async sendContactEmail(
    userEmail: string,
    subject: string,
    message: string,
    category: string,
  ): Promise<boolean> {
    const supportEmail =
      this.configService.get('SUPPORT_EMAIL') || 'support@studyabroad.com';

    return this.sendEmail({
      to: supportEmail,
      subject: `[${escapeHtml(category)}] ${escapeHtml(subject)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1d1813; background: #f7f1e6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .info { background: #fff4e2; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .message { background: white; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>用户反馈</h2>
            
            <div class="info">
              <p><strong>用户邮箱：</strong> ${escapeHtml(userEmail)}</p>
              <p><strong>分类：</strong> ${escapeHtml(category)}</p>
              <p><strong>时间：</strong> ${new Date().toLocaleString('zh-CN')}</p>
            </div>
            
            <div class="message">
              <h3>消息内容：</h3>
              <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }
}
