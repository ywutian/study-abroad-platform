import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import {
  baseStyles as styles,
  colors,
  translations,
  type ResumeData,
  type ResumeExportOptions,
} from '../styles/pdf-styles';

interface BasicTemplateProps {
  data: ResumeData;
  options: ResumeExportOptions;
}

export function BasicTemplate({ data, options }: BasicTemplateProps) {
  const t = translations[options.language];
  const { includeModules, anonymize } = options;

  const displayName = anonymize ? t.applicant : (data.basic.name || t.applicant);
  const gradeText = data.basic.grade ? t.grades[data.basic.grade as keyof typeof t.grades] || data.basic.grade : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 头部 */}
        {includeModules.basic && (
          <View style={styles.header}>
            <Text style={styles.name}>{displayName}</Text>
            <View style={styles.subtitle}>
              {gradeText && <Text style={styles.subtitleItem}>{gradeText}</Text>}
              {data.basic.school && !anonymize && (
                <Text style={styles.subtitleItem}>• {data.basic.school}</Text>
              )}
              {data.basic.targetMajor && (
                <Text style={styles.subtitleItem}>• {t.targetMajor}: {data.basic.targetMajor}</Text>
              )}
            </View>
          </View>
        )}

        {/* 学术成绩 */}
        {includeModules.academics && (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>📊</Text>
              <Text>{t.academics}</Text>
            </View>

            {/* GPA */}
            {data.academics.gpa && (
              <View style={styles.row}>
                <Text style={styles.label}>{t.gpa}</Text>
                <Text style={styles.value}>
                  {data.academics.gpa.toFixed(2)} / {data.academics.gpaScale || 4.0}
                </Text>
              </View>
            )}

            {/* 标化成绩 */}
            {data.academics.testScores.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>{t.testScores}</Text>
                <View style={styles.value}>
                  {data.academics.testScores.map((score, index) => (
                    <View key={index} style={{ marginBottom: 4 }}>
                      <View style={styles.flexRow}>
                        <Text style={{ fontWeight: 700 }}>{score.type}: </Text>
                        <Text>{score.score}</Text>
                        {score.subScores && Object.keys(score.subScores).length > 0 && (
                          <Text style={{ color: colors.textMuted, fontSize: 8, marginLeft: 8 }}>
                            ({Object.entries(score.subScores).map(([k, v]) => `${k}: ${v}`).join(', ')})
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 活动经历 */}
        {includeModules.activities && data.activities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>🎯</Text>
              <Text>{t.activities}</Text>
            </View>

            {data.activities.map((activity, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.flexBetween}>
                  <View style={styles.flexRow}>
                    <Text style={styles.listItemTitle}>{activity.name}</Text>
                    <Text style={styles.badge}>
                      {t.categories[activity.category as keyof typeof t.categories] || activity.category}
                    </Text>
                    {activity.isOngoing && (
                      <Text style={[styles.badge, { backgroundColor: colors.success, color: colors.white }]}>
                        {t.ongoing}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.listItemSubtitle}>{activity.role}</Text>
                {activity.description && (
                  <Text style={styles.listItemDescription}>{activity.description}</Text>
                )}
                {(activity.hoursPerWeek || activity.weeksPerYear) && (
                  <Text style={[styles.listItemDescription, { marginTop: 2 }]}>
                    {activity.hoursPerWeek && `${activity.hoursPerWeek} ${t.hoursPerWeek}`}
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
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>🏆</Text>
              <Text>{t.awards}</Text>
            </View>

            {data.awards.map((award, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.flexRow}>
                  <Text style={styles.listItemTitle}>{award.name}</Text>
                  <Text style={styles.badge}>
                    {t.levels[award.level as keyof typeof t.levels] || award.level}
                  </Text>
                  {award.year && (
                    <Text style={[styles.badge, { marginLeft: 4 }]}>{award.year}</Text>
                  )}
                </View>
                {award.description && (
                  <Text style={styles.listItemDescription}>{award.description}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 目标学校 */}
        {includeModules.targetSchools && data.targetSchools && data.targetSchools.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>🎓</Text>
              <Text>{t.targetSchools}</Text>
            </View>
            <Text style={{ lineHeight: 1.6 }}>
              {data.targetSchools.join('、')}
            </Text>
          </View>
        )}

        {/* 页脚 */}
        <View style={styles.footer}>
          <Text>{t.generatedBy} • {new Date().toLocaleDateString(options.language === 'zh' ? 'zh-CN' : 'en-US')}</Text>
        </View>
      </Page>
    </Document>
  );
}



