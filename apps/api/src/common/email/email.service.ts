import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || '留学申请平台';

    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.logger.log('Email transporter initialized');
    } else {
      this.logger.warn('Email service not configured - emails will be logged only');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    // If no transporter, log the email instead
    if (!this.transporter) {
      this.logger.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
      this.logger.debug(`[EMAIL MOCK] Content: ${text || html.substring(0, 200)}...`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.htmlToText(html),
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
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
    const verifyUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;

    return this.sendEmail({
      to,
      subject: '验证您的邮箱 - 留学申请平台',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #3b82f6; margin: 0;">留学申请平台</h1>
            </div>
            <div class="content">
              <h2>验证您的邮箱</h2>
              <p>感谢您注册留学申请平台！请点击下方按钮验证您的邮箱地址：</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" class="button">验证邮箱</a>
              </p>
              <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
              <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
              <p>此链接24小时内有效。</p>
            </div>
            <div class="footer">
              <p>© 2026 留学申请平台</p>
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
      subject: '重置密码 - 留学申请平台',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #3b82f6; margin: 0;">留学申请平台</h1>
            </div>
            <div class="content">
              <h2>重置您的密码</h2>
              <p>我们收到了您的密码重置请求。点击下方按钮设置新密码：</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">重置密码</a>
              </p>
              <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
              <p style="word-break: break-all; color: #666;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ 安全提示</strong>
                <p style="margin: 5px 0 0;">此链接1小时内有效。如果您没有请求重置密码，请忽略此邮件，您的账号是安全的。</p>
              </div>
            </div>
            <div class="footer">
              <p>© 2026 留学申请平台</p>
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
      subject: '欢迎加入留学申请平台！',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #3b82f6; }
            .content { padding: 30px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
            .features { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature { display: flex; align-items: center; margin: 10px 0; }
            .feature-icon { width: 24px; height: 24px; margin-right: 10px; color: #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #3b82f6; margin: 0;">🎓 留学申请平台</h1>
            </div>
            <div class="content">
              <h2>欢迎${userName ? `, ${userName}` : ''}！</h2>
              <p>感谢您加入留学申请平台，您的留学之旅从这里开始！</p>
              
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
              <p>© 2026 留学申请平台</p>
              <p>有任何问题？随时联系我们的支持团队</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }
}




