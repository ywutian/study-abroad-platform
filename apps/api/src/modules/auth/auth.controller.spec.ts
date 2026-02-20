import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  const mockTokens = {
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'USER',
    emailVerified: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue({
              user: mockUser,
              message: 'Registration successful',
            }),
            login: jest.fn().mockResolvedValue({
              user: mockUser,
              tokens: mockTokens,
              isNewUser: false,
            }),
            refreshToken: jest.fn().mockResolvedValue(mockTokens),
            logout: jest.fn().mockResolvedValue(undefined),
            verifyEmail: jest
              .fn()
              .mockResolvedValue({ message: 'Email verified successfully' }),
            resendVerificationEmail: jest.fn().mockResolvedValue({
              message: 'If the email exists, a verification link has been sent',
            }),
            requestPasswordReset: jest.fn().mockResolvedValue({
              message: 'If the email exists, a reset link has been sent',
            }),
            resetPassword: jest
              .fn()
              .mockResolvedValue({ message: 'Password reset successful' }),
            changePassword: jest
              .fn()
              .mockResolvedValue({ message: 'Password changed successfully' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should set refreshToken and access_token cookies', async () => {
      const result = await controller.login(
        { email: 'test@example.com', password: 'pass' },
        mockResponse as any,
      );

      // Refresh token cookie
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock_refresh_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );

      // Access token cookie
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock_access_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should return both accessToken and refreshToken in response body', async () => {
      const result = await controller.login(
        { email: 'test@example.com', password: 'pass' },
        mockResponse as any,
      );

      expect(result.accessToken).toBe('mock_access_token');
      expect(result.refreshToken).toBe('mock_refresh_token');
    });

    it('should return user and isNewUser', async () => {
      const result = await controller.login(
        { email: 'test@example.com', password: 'pass' },
        mockResponse as any,
      );

      expect(result.user).toEqual(mockUser);
      expect(result.isNewUser).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should prefer refreshToken from cookie over body', async () => {
      const mockReq = {
        cookies: { refreshToken: 'cookie_token' },
      };

      await controller.refreshToken(
        mockReq as any,
        { refreshToken: 'body_token' },
        mockResponse as any,
      );

      expect(authService.refreshToken).toHaveBeenCalledWith('cookie_token');
    });

    it('should fall back to body refreshToken when no cookie', async () => {
      const mockReq = { cookies: {} };

      await controller.refreshToken(
        mockReq as any,
        { refreshToken: 'body_token' },
        mockResponse as any,
      );

      expect(authService.refreshToken).toHaveBeenCalledWith('body_token');
    });

    it('should throw UnauthorizedException when no token provided', async () => {
      const mockReq = { cookies: {} };

      await expect(
        controller.refreshToken(mockReq as any, {} as any, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should clear cookie when refresh fails', async () => {
      const mockReq = {
        cookies: { refreshToken: 'invalid_token' },
      };
      (authService.refreshToken as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid'),
      );

      await expect(
        controller.refreshToken(mockReq as any, {} as any, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should update cookies on successful refresh', async () => {
      const mockReq = {
        cookies: { refreshToken: 'old_token' },
      };

      await controller.refreshToken(
        mockReq as any,
        {} as any,
        mockResponse as any,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock_refresh_token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock_access_token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should return both accessToken and refreshToken in response body', async () => {
      const mockReq = {
        cookies: { refreshToken: 'old_token' },
      };

      const result = await controller.refreshToken(
        mockReq as any,
        {} as any,
        mockResponse as any,
      );

      expect(result.accessToken).toBe('mock_access_token');
      expect(result.refreshToken).toBe('mock_refresh_token');
    });
  });

  describe('logout', () => {
    it('should clear both cookies', async () => {
      const mockReq = {
        cookies: { refreshToken: 'some_token' },
      };

      await controller.logout(
        { id: 'user-123', email: 'test@example.com', role: 'USER' },
        mockReq as any,
        {},
        mockResponse as any,
      );

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ path: '/' }),
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ path: '/' }),
      );
    });

    it('should pass refreshToken from cookie to service', async () => {
      const mockReq = {
        cookies: { refreshToken: 'cookie_rt' },
      };

      await controller.logout(
        { id: 'user-123', email: 'test@example.com', role: 'USER' },
        mockReq as any,
        {},
        mockResponse as any,
      );

      expect(authService.logout).toHaveBeenCalledWith('user-123', 'cookie_rt');
    });
  });

  describe('public endpoints', () => {
    it('register should call authService.register', async () => {
      await controller.register({
        email: 'new@test.com',
        password: 'pass123',
      });

      expect(authService.register).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'pass123',
      });
    });

    it('verifyEmail should call authService.verifyEmail', async () => {
      const result = await controller.verifyEmail('some_token');

      expect(authService.verifyEmail).toHaveBeenCalledWith('some_token');
      expect(result.message).toContain('verified');
    });

    it('forgotPassword should call authService.requestPasswordReset', async () => {
      await controller.forgotPassword({ email: 'test@example.com' });

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('resetPassword should call authService.resetPassword', async () => {
      await controller.resetPassword({
        token: 'reset_token',
        newPassword: 'newpass123',
      });

      expect(authService.resetPassword).toHaveBeenCalledWith(
        'reset_token',
        'newpass123',
      );
    });
  });
});
