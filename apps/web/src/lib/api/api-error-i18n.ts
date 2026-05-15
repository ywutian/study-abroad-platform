/**
 * Static error message translations for use outside React context (API client).
 * Keys must match those in api-error-map.ts.
 */
import {
  PASSWORD_POLICY_MESSAGE_EN,
  PASSWORD_POLICY_MESSAGE_ZH,
} from '@study-abroad/shared';

export const API_ERROR_MESSAGES: Record<'zh' | 'en', Record<string, string>> = {
  zh: {
    // Auth
    emailAlreadyRegistered: '该邮箱已被注册',
    passwordStrength: PASSWORD_POLICY_MESSAGE_ZH,
    invalidCredentials: '邮箱或密码错误',
    currentPasswordIncorrect: '当前密码不正确',
    emailNotVerified: '请先验证邮箱后再登录',
    tooManyAttempts: '尝试次数过多，请稍后再试',
    invalidVerificationToken: '验证链接无效或已过期',
    emailAlreadyVerified: '邮箱已经验证过了',
    invalidResetToken: '重置密码链接无效或已过期',
    sessionExpired: '会话已过期，请重新登录',

    // Conflict
    schoolAlreadyInList: '该学校已在清单中',
    schoolNameExists: '同名学校已存在',
    deadlineAlreadyExists: '该截止日期已存在',
    timelineRoundExists: '该轮次申请已存在',
    alreadySubscribed: '已订阅',
    caseAlreadyVerified: '该案例已认证',
    pendingVerificationExists: '已有待处理的认证请求',
    requestAlreadyProcessed: '该请求已被处理',
    predictionInProgress: '预测正在进行中',
    recommendationInProgress: '推荐正在生成中，请勿重复提交',
    alreadyExists: '该项目已存在',

    // Already done
    alreadyBanned: '该用户已被封禁',
    notBanned: '该用户未被封禁',
    alreadyApplied: '您已经申请过了',
    alreadyReviewed: '该内容已被审核',
    alreadyReported: '您已举报过了',
    alreadySubmitted: '您已经提交过了',
    alreadyPredicted: '您已对此案例进行过预测',
    alreadyTeamMember: '您已经是团队成员',
    messageAlreadyDeleted: '消息已被删除或撤回',

    // Not found
    userNotFound: '用户不存在',
    schoolNotFound: '学校不存在',
    notFound: '请求的资源不存在',
    completeProfileFirst: '请先完善个人档案',

    // Self-action
    cannotSelfAction: '不能对自己执行此操作',

    // Permission
    contentPrivate: '该内容为私密内容',
    verifiedUsersOnly: '仅认证用户可访问',
    canOnlyVerifyOwn: '只能认证自己的内容',
    noPermission: '没有权限执行此操作',
    postLocked: '该帖子已锁定',
    cannotMessageUser: '无法向该用户发送消息',
    notParticipant: '您不是此对话的参与者',
    mutualFollowRequired: '需要互相关注后才能执行此操作',
    cannotFollowUser: '无法关注该用户',

    // Chat
    recallExpired: '撤回窗口已过期（2分钟）',

    // Team
    teamNotRecruiting: '该团队暂未招募',
    cannotCancelReviewed: '无法取消已审核的申请',
    teamOwnerCannotLeave: '团队创建者不能退出，请删除帖子',

    // Peer review
    reviewCompleted: '该互评已完成',
    reviewExpired: '该互评已过期',
    pendingReviewExists: '已有进行中的互评请求',

    // AI
    aiFailed: 'AI 处理失败，请重试',

    // Subscription
    noActiveSubscription: '没有有效的订阅可取消',
    cannotSubscribeFree: '无法订阅免费计划',

    // Points
    insufficientPoints: '积分不足',

    // Content moderation
    contentModerated: '内容包含不当词汇，请修改后重试',

    // Rate limit
    rateLimited: '请求过于频繁，请稍后再试',
    requestInProgress: '请求正在处理中，请稍候',
    quotaExceeded: '使用配额已达上限',

    // Validation
    uploadRequired: '请上传证明材料',
    unsupportedFileType: '不支持的文件类型',
    fileTooLarge: '文件过大',
    rejectionReasonRequired: '拒绝时必须填写原因',
    essayContentEmpty: '文书内容不能为空',
    profileIncomplete: '请提供 GPA 或标化成绩',

    // Vault
    invalidPassword: '密码不正确',

    // Security
    unsafeContent: '输入内容包含不安全的模式',

    // Fallback
    fallback: '操作失败，请重试',
  },
  en: {
    // Auth
    emailAlreadyRegistered: 'This email is already registered',
    passwordStrength: PASSWORD_POLICY_MESSAGE_EN,
    invalidCredentials: 'Invalid email or password',
    currentPasswordIncorrect: 'Current password is incorrect',
    emailNotVerified: 'Please verify your email before logging in',
    tooManyAttempts: 'Too many attempts, please try again later',
    invalidVerificationToken: 'Invalid or expired verification link',
    emailAlreadyVerified: 'Email is already verified',
    invalidResetToken: 'Invalid or expired password reset link',
    sessionExpired: 'Session expired, please log in again',

    // Conflict
    schoolAlreadyInList: 'This school is already in your list',
    schoolNameExists: 'A school with this name already exists',
    deadlineAlreadyExists: 'This deadline already exists',
    timelineRoundExists: 'This application round already exists',
    alreadySubscribed: 'Already subscribed',
    caseAlreadyVerified: 'This case is already verified',
    pendingVerificationExists: 'A pending verification request already exists',
    requestAlreadyProcessed: 'This request has already been processed',
    predictionInProgress: 'Prediction is already in progress',
    recommendationInProgress: 'Recommendation is being generated, please do not resubmit',
    alreadyExists: 'This item already exists',

    // Already done
    alreadyBanned: 'User is already banned',
    notBanned: 'User is not currently banned',
    alreadyApplied: 'You have already applied',
    alreadyReviewed: 'This has already been reviewed',
    alreadyReported: 'You have already reported this',
    alreadySubmitted: 'You have already submitted this',
    alreadyPredicted: 'You have already predicted this case',
    alreadyTeamMember: 'You are already a team member',
    messageAlreadyDeleted: 'Message has already been deleted or recalled',

    // Not found
    userNotFound: 'User not found',
    schoolNotFound: 'School not found',
    notFound: 'The requested resource was not found',
    completeProfileFirst: 'Please complete your profile first',

    // Self-action
    cannotSelfAction: 'You cannot perform this action on yourself',

    // Permission
    contentPrivate: 'This content is private',
    verifiedUsersOnly: 'Only verified users can access this',
    canOnlyVerifyOwn: 'You can only verify your own submissions',
    noPermission: 'You do not have permission to perform this action',
    postLocked: 'This post is locked',
    cannotMessageUser: 'Cannot message this user',
    notParticipant: 'You are not a participant in this conversation',
    mutualFollowRequired: 'Mutual follow is required for this action',
    cannotFollowUser: 'Cannot follow this user',

    // Chat
    recallExpired: 'Recall window has expired (2 minutes)',

    // Team
    teamNotRecruiting: 'This team is not currently recruiting',
    cannotCancelReviewed: 'Cannot cancel a reviewed application',
    teamOwnerCannotLeave: 'Team owner cannot leave. Delete the post instead.',

    // Peer review
    reviewCompleted: 'This review is already completed',
    reviewExpired: 'This review has expired',
    pendingReviewExists: 'A pending review request already exists',

    // AI
    aiFailed: 'AI processing failed, please try again',

    // Subscription
    noActiveSubscription: 'No active subscription to cancel',
    cannotSubscribeFree: 'Cannot subscribe to free plan',

    // Points
    insufficientPoints: 'Insufficient points',

    // Content moderation
    contentModerated: 'Content contains inappropriate words, please revise',

    // Rate limit
    rateLimited: 'Too many requests, please try again later',
    requestInProgress: 'Request is being processed, please wait',
    quotaExceeded: 'Usage quota has been reached',

    // Validation
    uploadRequired: 'Please upload supporting documents',
    unsupportedFileType: 'Unsupported file type',
    fileTooLarge: 'File is too large',
    rejectionReasonRequired: 'Reason is required when rejecting',
    essayContentEmpty: 'Essay content cannot be empty',
    profileIncomplete: 'Please provide GPA or test scores',

    // Vault
    invalidPassword: 'Invalid password',

    // Security
    unsafeContent: 'Input contains unsafe patterns',

    // Fallback
    fallback: 'Operation failed, please try again',
  },
};
