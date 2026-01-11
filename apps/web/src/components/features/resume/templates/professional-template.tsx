import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  professionalStyles as styles,
  baseStyles,
  colors,
  translations,
  type ResumeData,
  type ResumeExportOptions,
} from '../styles/pdf-styles';

interface ProfessionalTemplateProps {
  data: ResumeData;
  options: ResumeExportOptions;
}

export function ProfessionalTemplate({ data, options }: ProfessionalTemplateProps) {
  const t = translations[options.language];
  const { includeModules, anonymize } = options;

  const displayName = anonymize ? t.applicant : (data.basic.name || t.applicant);
  const gradeText = data.basic.grade ? t.grades[data.basic.grade as keyof typeof t.grades] || data.basic.grade : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 左侧装饰条 */}
        <View style={styles.sidebar} />

        {/* 头部 */}
        {includeModules.basic && (
          <View style={styles.header}>
            <Text style={styles.name}>{displayName}</Text>
            <View style={[baseStyles.subtitle, { marginTop: 8 }]}>
              {gradeText && <Text style={baseStyles.subtitleItem}>{gradeText}</Text>}
              {data.basic.school && !anonymize && (
                <Text style={baseStyles.subtitleItem}>• {data.basic.school}</Text>
              )}
              {data.basic.targetMajor && (
                <Text style={baseStyles.subtitleItem}>• {t.targetMajor}: {data.basic.targetMajor}</Text>
              )}
            </View>
          </View>
        )}

        {/* 学术成绩 */}
        {includeModules.academics && (
          <View style={baseStyles.section}>
            <Text style={styles.sectionTitle}>{t.academics}</Text>

            <View style={baseStyles.grid}>
              {/* GPA 卡片 */}
              {data.academics.gpa && (
                <View style={[styles.scoreCard, { width: '48%', marginRight: '2%' }]}>
                  <Text style={styles.scoreType}>{t.gpa}</Text>
                  <Text style={styles.scoreValue}>
                    {data.academics.gpa.toFixed(2)} / {data.academics.gpaScale || 4.0}
                  </Text>
                </View>
              )}

              {/* 标化成绩卡片 */}
              {data.academics.testScores.map((score, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.scoreCard, 
                    { width: '48%', marginRight: index % 2 === 0 ? '2%' : 0 }
                  ]}
                >
                  <View>
                    <Text style={styles.scoreType}>{score.type}</Text>
                    {score.subScores && Object.keys(score.subScores).length > 0 && (
                      <Text style={{ fontSize: 7, color: colors.textMuted, marginTop: 2 }}>
                        {Object.entries(score.subScores).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.scoreValue}>{score.score}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 活动经历 */}
        {includeModules.activities && data.activities.length > 0 && (
          <View style={baseStyles.section}>
            <Text style={styles.sectionTitle}>{t.activities}</Text>

            {data.activities.map((activity, index) => (
              <View key={index} style={styles.activityCard}>
                <View style={baseStyles.flexBetween}>
                  <View style={baseStyles.flexRow}>
                    <Text style={{ fontWeight: 700, fontSize: 11 }}>{activity.name}</Text>
                    {activity.isOngoing && (
                      <View style={{
                        backgroundColor: colors.success,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        marginLeft: 6,
                      }}>
                        <Text style={{ fontSize: 7, color: colors.white }}>{t.ongoing}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 8, color: colors.textMuted }}>
                    {t.categories[activity.category as keyof typeof t.categories] || activity.category}
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: colors.secondary, marginTop: 2 }}>
                  {activity.role}
                </Text>
                {activity.description && (
                  <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                    {activity.description}
                  </Text>
                )}
                {(activity.hoursPerWeek || activity.weeksPerYear) && (
                  <Text style={{ fontSize: 7, color: colors.textMuted, marginTop: 4 }}>
                    ⏱ {activity.hoursPerWeek && `${activity.hoursPerWeek} ${t.hoursPerWeek}`}
                    {activity.hoursPerWeek && activity.weeksPerYear && ' · '}
                    {activity.weeksPerYear && `${activity.weeksPerYear} ${t.weeksPerYear}`}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 获奖情况 */}
        {includeModules.awards && data.awards.length > 0 && (
          <View style={baseStyles.section}>
            <Text style={styles.sectionTitle}>{t.awards}</Text>

            {data.awards.map((award, index) => (
              <View key={index} style={styles.awardCard}>
                <View style={styles.awardBullet} />
                <View style={{ flex: 1 }}>
                  <View style={baseStyles.flexBetween}>
                    <Text style={{ fontWeight: 700, fontSize: 10 }}>{award.name}</Text>
                    <View style={baseStyles.flexRow}>
                      <View style={{
                        backgroundColor: colors.warning,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}>
                        <Text style={{ fontSize: 7, color: colors.white }}>
                          {t.levels[award.level as keyof typeof t.levels] || award.level}
                        </Text>
                      </View>
                      {award.year && (
                        <Text style={{ fontSize: 8, color: colors.textMuted, marginLeft: 6 }}>
                          {award.year}
                        </Text>
                      )}
                    </View>
                  </View>
                  {award.description && (
                    <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 2 }}>
                      {award.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 目标学校 */}
        {includeModules.targetSchools && data.targetSchools && data.targetSchools.length > 0 && (
          <View style={baseStyles.section}>
            <Text style={styles.sectionTitle}>{t.targetSchools}</Text>
            <View style={[baseStyles.grid, { marginTop: 4 }]}>
              {data.targetSchools.map((school, index) => (
                <View 
                  key={index} 
                  style={{
                    backgroundColor: colors.background,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 4,
                    marginRight: 8,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 9 }}>{school}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 页脚 */}
        <View style={baseStyles.footer}>
          <Text>{t.generatedBy} • {new Date().toLocaleDateString(options.language === 'zh' ? 'zh-CN' : 'en-US')}</Text>
        </View>
      </Page>
    </Document>
  );
}



