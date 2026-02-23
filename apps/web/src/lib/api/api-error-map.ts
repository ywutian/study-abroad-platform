type ErrorPattern = {
  /** Substring or regex to match against error.message */
  match: string | RegExp;
  /** Key in API_ERROR_MESSAGES */
  key: string;
};

/**
 * Maps raw backend error messages to translation keys.
 * Order matters: more specific patterns should come before generic ones.
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // ── Auth ──
  { match: 'Email already registered', key: 'emailAlreadyRegistered' },
  { match: 'Invalid credentials', key: 'invalidCredentials' },
  { match: 'Current password is incorrect', key: 'currentPasswordIncorrect' },
  { match: 'verify your email', key: 'emailNotVerified' },
  { match: 'Too many login attempts', key: 'tooManyAttempts' },
  { match: 'Invalid verification token', key: 'invalidVerificationToken' },
  { match: 'Email is already verified', key: 'emailAlreadyVerified' },
  { match: 'Invalid or expired reset token', key: 'invalidResetToken' },
  { match: 'Invalid or expired refresh token', key: 'sessionExpired' },
  { match: 'No refresh token provided', key: 'sessionExpired' },
  { match: 'Session expired', key: 'sessionExpired' },

  // ── Conflict / already exists ──
  { match: 'School already exists in your list', key: 'schoolAlreadyInList' },
  { match: 'School with name', key: 'schoolNameExists' },
  { match: '该学校此年度轮次的截止日期已存在', key: 'deadlineAlreadyExists' },
  { match: '该学校的此轮次申请已存在', key: 'timelineRoundExists' },
  { match: '已订阅该事件', key: 'alreadySubscribed' },
  { match: '该案例已认证', key: 'caseAlreadyVerified' },
  { match: '已有待处理的认证请求', key: 'pendingVerificationExists' },
  { match: '该请求已被处理', key: 'requestAlreadyProcessed' },
  { match: 'Prediction already in progress', key: 'predictionInProgress' },
  { match: '推荐正在生成中', key: 'recommendationInProgress' },
  { match: /already exists/i, key: 'alreadyExists' },
  { match: '已存在', key: 'alreadyExists' },

  // ── Already done / submitted ──
  { match: 'User is already banned', key: 'alreadyBanned' },
  { match: 'User is not banned', key: 'notBanned' },
  { match: 'You have already applied', key: 'alreadyApplied' },
  { match: 'Application already reviewed', key: 'alreadyReviewed' },
  { match: '您已举报过', key: 'alreadyReported' },
  { match: '您已经提交过评价', key: 'alreadySubmitted' },
  { match: '已经对此案例进行过预测', key: 'alreadyPredicted' },
  { match: 'already a team member', key: 'alreadyTeamMember' },
  { match: 'Message already deleted or recalled', key: 'messageAlreadyDeleted' },

  // ── Not found ──
  { match: '用户不存在', key: 'userNotFound' },
  { match: '互评不存在', key: 'notFound' },
  { match: '学校不存在', key: 'schoolNotFound' },
  { match: '时间线不存在', key: 'notFound' },
  { match: '任务不存在', key: 'notFound' },
  { match: '全局事件不存在', key: 'notFound' },
  { match: '个人事件不存在', key: 'notFound' },
  { match: '推荐记录不存在', key: 'notFound' },
  { match: '案例不存在', key: 'notFound' },
  { match: '帖子不存在', key: 'notFound' },
  { match: '评论不存在', key: 'notFound' },
  { match: '截止日期记录不存在', key: 'notFound' },
  { match: '文书题目不存在', key: 'notFound' },
  { match: '认证请求不存在', key: 'notFound' },
  { match: '请先完善个人档案', key: 'completeProfileFirst' },
  { match: 'Please complete your profile', key: 'completeProfileFirst' },
  { match: /not found/i, key: 'notFound' },

  // ── Self-action prevention ──
  { match: 'Cannot start conversation with yourself', key: 'cannotSelfAction' },
  { match: 'Cannot review yourself', key: 'cannotSelfAction' },
  { match: 'Cannot react to your own review', key: 'cannotSelfAction' },
  { match: 'Cannot vote on your own list', key: 'cannotSelfAction' },
  { match: 'Cannot follow yourself', key: 'cannotSelfAction' },
  { match: 'Cannot block yourself', key: 'cannotSelfAction' },
  { match: 'You cannot apply to your own team', key: 'cannotSelfAction' },
  { match: 'Cannot modify your own role', key: 'cannotSelfAction' },
  { match: 'Cannot ban your own account', key: 'cannotSelfAction' },
  { match: 'Cannot delete your own account', key: 'cannotSelfAction' },
  { match: '不能对自己', key: 'cannotSelfAction' },
  { match: '不能举报自己', key: 'cannotSelfAction' },

  // ── Permission / access ──
  { match: 'This case is private', key: 'contentPrivate' },
  { match: 'This profile is private', key: 'contentPrivate' },
  { match: 'Only verified users', key: 'verifiedUsersOnly' },
  { match: '仅认证用户', key: 'verifiedUsersOnly' },
  { match: '只有认证用户', key: 'verifiedUsersOnly' },
  { match: '只能认证自己', key: 'canOnlyVerifyOwn' },
  { match: '只能对认证用户', key: 'verifiedUsersOnly' },
  { match: '无权操作', key: 'noPermission' },
  { match: 'Post is locked', key: 'postLocked' },
  { match: 'Cannot message this user', key: 'cannotMessageUser' },
  { match: 'Not a participant', key: 'notParticipant' },
  { match: 'Mutual follow required', key: 'mutualFollowRequired' },
  { match: '需要互相关注', key: 'mutualFollowRequired' },
  { match: 'Can only delete your own', key: 'noPermission' },
  { match: 'Can only recall your own', key: 'noPermission' },
  { match: 'Cannot follow this user', key: 'cannotFollowUser' },
  { match: 'Cannot reorder', key: 'noPermission' },
  { match: 'do not have permission', key: 'noPermission' },

  // ── Chat ──
  { match: 'Recall window expired', key: 'recallExpired' },

  // ── Team ──
  { match: 'Team is not recruiting', key: 'teamNotRecruiting' },
  { match: 'Cannot cancel a reviewed application', key: 'cannotCancelReviewed' },
  { match: 'Team owner cannot leave', key: 'teamOwnerCannotLeave' },

  // ── Peer review ──
  { match: '互评已完成', key: 'reviewCompleted' },
  { match: '互评已过期', key: 'reviewExpired' },
  { match: '已有进行中的互评', key: 'pendingReviewExists' },

  // ── AI / generation failures ──
  { match: /Failed to (review|analyze|generate|polish|rewrite|continue|match)/i, key: 'aiFailed' },
  { match: '生成选校建议失败', key: 'aiFailed' },
  { match: 'AI service error', key: 'aiFailed' },
  { match: 'AI service not configured', key: 'aiFailed' },

  // ── Subscription ──
  { match: 'No active subscription', key: 'noActiveSubscription' },
  { match: 'Cannot subscribe to free plan', key: 'cannotSubscribeFree' },

  // ── Points ──
  { match: '积分不足', key: 'insufficientPoints' },

  // ── Content moderation ──
  { match: '包含不当词汇', key: 'contentModerated' },
  { match: 'inappropriate words', key: 'contentModerated' },

  // ── Rate limit ──
  { match: '请求过于频繁', key: 'rateLimited' },
  { match: '正在处理中', key: 'requestInProgress' },
  { match: '使用配额已达上限', key: 'quotaExceeded' },

  // ── Validation ──
  { match: '请上传证明材料', key: 'uploadRequired' },
  { match: '不支持的文件类型', key: 'unsupportedFileType' },
  { match: '文件大小不能超过', key: 'fileTooLarge' },
  { match: '拒绝时必须填写原因', key: 'rejectionReasonRequired' },
  { match: 'Essay content is empty', key: 'essayContentEmpty' },
  { match: 'provide GPA or test scores', key: 'profileIncomplete' },

  // ── Vault ──
  { match: 'Invalid password', key: 'invalidPassword' },

  // ── Security ──
  { match: '不安全的模式', key: 'unsafeContent' },
];

/**
 * Given a raw API error message, return the matching translation key,
 * or null if no match.
 */
export function mapApiErrorToKey(rawMessage: string): string | null {
  for (const pattern of ERROR_PATTERNS) {
    if (typeof pattern.match === 'string') {
      if (rawMessage.includes(pattern.match)) {
        return pattern.key;
      }
    } else {
      if (pattern.match.test(rawMessage)) {
        return pattern.key;
      }
    }
  }
  return null;
}
