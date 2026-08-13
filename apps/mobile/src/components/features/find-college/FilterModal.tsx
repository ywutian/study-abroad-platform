import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AnimatedButton, Modal, Select } from '@/components/ui';
import { useColors } from '@/utils/theme';
import { styles } from '@/app/find-college.styles';

// ============== Constants ==============

const US_STATES = [
  'California',
  'New York',
  'Massachusetts',
  'Texas',
  'Pennsylvania',
  'Illinois',
  'Florida',
  'Michigan',
  'Ohio',
  'Georgia',
  'North Carolina',
  'Virginia',
  'Washington',
  'Maryland',
  'Connecticut',
  'New Jersey',
  'Indiana',
  'Minnesota',
  'Wisconsin',
  'Colorado',
];

const SCHOOL_TYPE_OPTIONS = [
  { value: 'all', labelKey: 'findCollege.filters.typeAll' },
  { value: 'private', labelKey: 'findCollege.filters.typePrivate' },
  { value: 'public', labelKey: 'findCollege.filters.typePublic' },
];

export const PAGE_LIMIT = 20;

// ============== Types ==============

export interface Filters {
  minRank: string;
  maxRank: string;
  minTuition: string;
  maxTuition: string;
  minAcceptanceRate: string;
  maxAcceptanceRate: string;
  state: string;
  type: string;
}

export const DEFAULT_FILTERS: Filters = {
  minRank: '',
  maxRank: '',
  minTuition: '',
  maxTuition: '',
  minAcceptanceRate: '',
  maxAcceptanceRate: '',
  state: '',
  type: 'all',
};

// ============== Filter Modal ==============

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onReset: () => void;
}

export function FilterModal({ visible, onClose, filters, onApply, onReset }: FilterModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [draft, setDraft] = useState<Filters>(filters);

  // Sync draft when modal opens
  React.useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const updateDraft = (key: keyof Filters, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const stateOptions = [
    { value: '', label: t('findCollege.filters.allStates') },
    ...US_STATES.map((s) => ({ value: s, label: s })),
  ];

  const typeOptions = SCHOOL_TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey, o.value === 'all' ? 'All' : o.value === 'private' ? 'Private' : 'Public'),
  }));

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('findCollege.filters.title')}
      footer={
        <>
          <AnimatedButton variant="outline" onPress={handleReset} style={styles.filterActionButton}>
            {t('findCollege.filters.reset')}
          </AnimatedButton>
          <AnimatedButton onPress={handleApply} style={styles.filterActionButton}>
            {t('findCollege.filters.apply')}
          </AnimatedButton>
        </>
      }
    >
      {/* Rank Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.rankRange')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder={t('findCollege.filters.min')}
            placeholderTextColor={colors.placeholder}
            value={draft.minRank}
            onChangeText={(v) => updateDraft('minRank', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder={t('findCollege.filters.max')}
            placeholderTextColor={colors.placeholder}
            value={draft.maxRank}
            onChangeText={(v) => updateDraft('maxRank', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>

      {/* Tuition Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.tuitionRange')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="$0"
            placeholderTextColor={colors.placeholder}
            value={draft.minTuition}
            onChangeText={(v) => updateDraft('minTuition', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="$80,000"
            placeholderTextColor={colors.placeholder}
            value={draft.maxTuition}
            onChangeText={(v) => updateDraft('maxTuition', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </View>

      {/* Acceptance Rate Range */}
      <Text style={[styles.filterSectionLabel, { color: colors.foreground }]}>
        {t('findCollege.filters.acceptanceRate')}
      </Text>
      <View style={styles.rangeRow}>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="0%"
            placeholderTextColor={colors.placeholder}
            value={draft.minAcceptanceRate}
            onChangeText={(v) => updateDraft('minAcceptanceRate', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <Text style={[styles.rangeSeparator, { color: colors.foregroundMuted }]}>-</Text>
        <View style={styles.rangeInputWrapper}>
          <TextInput
            style={[
              styles.rangeInput,
              {
                backgroundColor: colors.input,
                borderColor: colors.inputBorder,
                color: colors.foreground,
              },
            ]}
            placeholder="100%"
            placeholderTextColor={colors.placeholder}
            value={draft.maxAcceptanceRate}
            onChangeText={(v) => updateDraft('maxAcceptanceRate', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>

      {/* State */}
      <Select
        label={t('findCollege.filters.state')}
        options={stateOptions}
        value={draft.state}
        onChange={(v) => updateDraft('state', v)}
        placeholder={t('findCollege.filters.allStates')}
      />

      {/* School Type */}
      <Select
        label={t('findCollege.filters.type')}
        options={typeOptions}
        value={draft.type}
        onChange={(v) => updateDraft('type', v)}
      />
    </Modal>
  );
}
