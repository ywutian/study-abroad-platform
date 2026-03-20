/**
 * Locale-keyed error messages for NestJS exceptions.
 *
 * Usage:
 *   throw new NotFoundException(ERR.NOT_FOUND.case(locale));
 *
 * Each entry is a function accepting an optional `locale` string.
 * Defaults to 'zh' when locale is not provided.
 */

type LocaleMessage = (locale?: string) => string;

function msg(en: string, zh: string): LocaleMessage {
  return (locale?: string) => (locale === 'en' ? en : zh);
}

// ─── Generic ────────────────────────────────────────────────────
export const ERR = {
  NOT_FOUND: {
    case: msg('Case not found', '案例不存在'),
    school: msg('School not found', '学校不存在'),
    user: msg('User not found', '用户不存在'),
    peerReview: msg('Peer review not found', '互评不存在'),
    verification: msg('Verification request not found', '认证请求不存在'),
    timeline: msg('Timeline not found', '时间线不存在'),
    personalEvent: msg('Personal event not found', '个人事件不存在'),
    globalEvent: msg('Global event not found', '全局事件不存在'),
    task: msg('Task not found', '任务不存在'),
    recommendation: msg('Recommendation not found', '推荐记录不存在'),
    deadline: msg('Deadline not found', '截止日期记录不存在'),
    post: msg('Post not found', '帖子不存在'),
    comment: msg('Comment not found', '评论不存在'),
    essayPrompt: msg('Essay prompt not found', '文书题目不存在'),
    essaySchool: msg(
      'School not found for essay import',
      '导入文书时学校未找到',
    ),
  },

  FORBIDDEN: {
    selfOnly: msg(
      'You can only operate on your own resources',
      '只能认证自己的案例',
    ),
    verifiedOnly: msg(
      'Only verified users can do this',
      '只有认证用户才能发起互评',
    ),
    targetVerifiedOnly: msg(
      'Target must be a verified user',
      '只能对认证用户发起互评',
    ),
    noPermission: msg('No permission for this peer review', '无权操作此互评'),
  },

  CONFLICT: {
    alreadyVerified: msg('This case is already verified', '该案例已认证'),
    pendingVerification: msg(
      'A pending verification request already exists',
      '已有待处理的认证请求',
    ),
    alreadyProcessed: msg(
      'This request has already been processed',
      '该请求已被处理',
    ),
    alreadySubscribed: msg('Already subscribed to this event', '已订阅该事件'),
    duplicateDeadline: msg(
      'A deadline for this school/year/round already exists',
      '该学校此年度轮次的截止日期已存在',
    ),
    duplicateApplication: msg(
      'An application for this school/round already exists',
      '该学校的此轮次申请已存在',
    ),
    essayDuplicate: msg(
      'Duplicate essay prompt, skipped',
      '重复文书题目，已跳过',
    ),
  },

  BAD_REQUEST: {
    cannotReviewSelf: msg(
      'Cannot initiate peer review with yourself',
      '不能对自己发起互评',
    ),
    mutualFollowRequired: msg(
      'Mutual follow required for peer review',
      '需要互相关注后才能发起互评',
    ),
    pendingReviewExists: msg(
      'A pending review request already exists',
      '已有进行中的互评请求',
    ),
    reviewCompleted: msg('This peer review is already completed', '互评已完成'),
    reviewExpired: msg('This peer review has expired', '互评已过期'),
    alreadySubmitted: msg(
      'You have already submitted a review',
      '您已经提交过评价',
    ),
    fileTooLarge: msg('File size cannot exceed 10MB', '文件大小不能超过 10MB'),
    unsupportedFileType: msg(
      'Unsupported file type. Supported: JPEG, PNG, WebP, PDF',
      '不支持的文件类型。支持：JPEG, PNG, WebP, PDF',
    ),
    uploadProof: msg('Please upload proof materials', '请上传证明材料'),
    alreadyPredicted: msg(
      'Already predicted for this case',
      '已经对此案例进行过预测',
    ),
    cannotReportOwn: msg(
      'Cannot report your own content',
      '不能举报自己的帖子',
    ),
    cannotReportOwnComment: msg(
      'Cannot report your own comment',
      '不能举报自己的评论',
    ),
    alreadyReportedPost: msg(
      'You have already reported this post',
      '您已举报过该帖子',
    ),
    alreadyReportedComment: msg(
      'You have already reported this comment',
      '您已举报过该评论',
    ),
    rejectReasonRequired: msg(
      'Rejection reason is required',
      '拒绝时必须填写原因',
    ),
    deleted: msg('Deleted', '删除成功'),
  },
} as const;
