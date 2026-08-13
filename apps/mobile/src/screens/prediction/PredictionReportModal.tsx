import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AnimatedButton, Modal } from '@/components/ui';
import { useColors, withOpacity } from '@/utils/theme';
import { styles } from './PredictionScreen.styles';

export type AdmissionResult = 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN';

interface Props {
  visible: boolean;
  onClose: () => void;
  result: AdmissionResult;
  setResult: (value: AdmissionResult) => void;
  round: string;
  setRound: (value: string) => void;
  isFinal: boolean;
  setIsFinal: (value: boolean) => void;
  notes: string;
  setNotes: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function PredictionReportModal(props: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const resultColors: Record<AdmissionResult, string> = {
    ADMITTED: colors.success,
    REJECTED: colors.error,
    WAITLISTED: colors.warning,
    DEFERRED: colors.info,
    WITHDRAWN: colors.foregroundMuted,
  };
  return (
    <Modal
      visible={props.visible}
      onClose={props.onClose}
      title={t('prediction.reportActualResult')}
    >
      <View style={styles.reportContent}>
        <Text style={[styles.reportLabel, { color: colors.foreground }]}>
          {t('prediction.selectResult')}
        </Text>
        {(Object.keys(resultColors) as AdmissionResult[]).map((result) => {
          const selected = props.result === result;
          return (
            <TouchableOpacity
              key={result}
              onPress={() => props.setResult(result)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`prediction.results.${result.toLowerCase()}`)}
              style={[
                styles.resultOption,
                { borderColor: selected ? resultColors[result] : colors.border },
                selected && { backgroundColor: withOpacity(resultColors[result], 0.1) },
              ]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? resultColors[result] : colors.foregroundMuted}
              />
              <Text
                style={[
                  styles.resultOptionText,
                  { color: selected ? resultColors[result] : colors.foreground },
                ]}
              >
                {t(`prediction.results.${result.toLowerCase()}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
        <Text style={[styles.reportLabel, { color: colors.foreground }]}>
          {t('prediction.round')}
        </Text>
        <View style={styles.roundOptions}>
          {['RD', 'EA', 'ED', 'ED2', 'REA', 'SCEA', 'ROLLING'].map((round) => {
            const selected = props.round === round;
            return (
              <TouchableOpacity
                key={round}
                onPress={() => props.setRound(round)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={round}
                style={[
                  styles.roundOption,
                  selected
                    ? {
                        borderColor: colors.primary,
                        backgroundColor: withOpacity(colors.primary, 0.1),
                      }
                    : { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.roundOptionText,
                    { color: selected ? colors.primary : colors.foreground },
                  ]}
                >
                  {round}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.finalRow}>
          <Text style={[styles.resultOptionText, { color: colors.foreground }]}>
            {t('prediction.finalResult')}
          </Text>
          <Switch value={props.isFinal} onValueChange={props.setIsFinal} />
        </View>
        <TextInput
          value={props.notes}
          onChangeText={props.setNotes}
          placeholder={t('prediction.notesPlaceholder')}
          placeholderTextColor={colors.foregroundMuted}
          multiline
          maxLength={500}
          style={[
            styles.notesInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
          ]}
        />
        <AnimatedButton
          onPress={props.onSubmit}
          loading={props.submitting}
          style={styles.reportSubmitButton}
        >
          {t('prediction.submitResult')}
        </AnimatedButton>
      </View>
    </Modal>
  );
}
