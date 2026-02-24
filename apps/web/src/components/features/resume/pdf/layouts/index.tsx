import React from 'react';
import type { LayoutType, LayoutProps } from '../types';
import { SingleColumnLayout } from './single-column';
import { SidebarLeftLayout } from './sidebar-left';
import { SidebarRightLayout } from './sidebar-right';
import { HeaderBannerSingleLayout } from './header-banner-single';
import { HeaderBannerColumnsLayout } from './header-banner-columns';
import { EqualColumnsLayout } from './equal-columns';
import { TimelineLayout } from './timeline';

type LayoutComponent = React.FC<LayoutProps>;

const LAYOUT_REGISTRY: Record<LayoutType, LayoutComponent> = {
  'single-column': SingleColumnLayout,
  'sidebar-left': SidebarLeftLayout,
  'sidebar-right': SidebarRightLayout,
  'header-banner-single': HeaderBannerSingleLayout,
  'header-banner-columns': HeaderBannerColumnsLayout,
  'equal-columns': EqualColumnsLayout,
  timeline: TimelineLayout,
};

export function getLayout(type: LayoutType): LayoutComponent {
  return LAYOUT_REGISTRY[type] ?? SingleColumnLayout;
}

export function ResumeDocument({ layout, ...props }: LayoutProps & { layout: LayoutType }) {
  const Layout = getLayout(layout);
  return <Layout {...props} />;
}
