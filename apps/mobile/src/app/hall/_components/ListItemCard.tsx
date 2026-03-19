import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCard, CardContent, Badge, Avatar } from '@/components/ui';
import { spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import type { HallList, Colors } from './types';

interface ListItemCardProps {
  item: HallList;
  colors: Colors;
  onOpenDetail: (id: string) => void;
  onVote: (listId: string, direction: 'up' | 'down') => void;
  categoryLabel: (cat: string) => string;
}

export const ListItemCard = memo(function ListItemCard({
  item,
  colors: c,
  onOpenDetail,
  onVote,
  categoryLabel,
}: ListItemCardProps) {
  return (
    <AnimatedCard style={S.listCard} onPress={() => onOpenDetail(item.id)}>
      <CardContent>
        <View style={S.listCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[S.listTitle, { color: c.foreground }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={[S.listDesc, { color: c.foregroundMuted }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
        </View>

        <View style={S.listCardFooter}>
          <View style={S.listCreator}>
            <Avatar source={item.creator.avatarUrl} name={item.creator.nickname} size="sm" />
            <Text style={[S.listCreatorName, { color: c.foregroundMuted }]}>
              {item.creator.nickname}
            </Text>
          </View>

          <View style={S.listMeta}>
            <Ionicons name="list-outline" size={14} color={c.foregroundMuted} />
            <Text style={[S.listMetaText, { color: c.foregroundMuted }]}>{item.itemCount}</Text>
          </View>

          <View style={S.voteContainer}>
            <TouchableOpacity
              onPress={() => onVote(item.id, 'up')}
              style={[
                S.voteBtn,
                { backgroundColor: item.myVote === 'up' ? c.success + '15' : 'transparent' },
              ]}
            >
              <Ionicons
                name={item.myVote === 'up' ? 'caret-up' : 'caret-up-outline'}
                size={18}
                color={item.myVote === 'up' ? c.success : c.foregroundMuted}
              />
            </TouchableOpacity>
            <Text
              style={[
                S.voteCount,
                {
                  color:
                    item.voteCount > 0
                      ? c.success
                      : item.voteCount < 0
                        ? c.error
                        : c.foregroundMuted,
                },
              ]}
            >
              {item.voteCount}
            </Text>
            <TouchableOpacity
              onPress={() => onVote(item.id, 'down')}
              style={[
                S.voteBtn,
                { backgroundColor: item.myVote === 'down' ? c.error + '15' : 'transparent' },
              ]}
            >
              <Ionicons
                name={item.myVote === 'down' ? 'caret-down' : 'caret-down-outline'}
                size={18}
                color={item.myVote === 'down' ? c.error : c.foregroundMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </CardContent>
    </AnimatedCard>
  );
});

const S = StyleSheet.create({
  listCard: {
    marginBottom: spacing.md,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  listTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  listDesc: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.4,
  },
  listCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listCreator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  listCreatorName: {
    fontSize: fontSize.xs,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listMetaText: {
    fontSize: fontSize.xs,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  voteCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    minWidth: 20,
    textAlign: 'center',
  },
});
