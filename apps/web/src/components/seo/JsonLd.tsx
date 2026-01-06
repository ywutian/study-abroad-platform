/**
 * JSON-LD 结构化数据组件
 * 
 * 用于 SEO 优化，支持多种 schema.org 类型
 */

import Script from 'next/script';

// 组织信息
interface OrganizationSchema {
  type: 'Organization';
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}

// 网站信息
interface WebSiteSchema {
  type: 'WebSite';
  name: string;
  url: string;
  description?: string;
  potentialAction?: {
    type: 'SearchAction';
    target: string;
    'query-input': string;
  };
}

// 文章信息 (用于案例展示等)
interface ArticleSchema {
  type: 'Article';
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: {
    name: string;
    url?: string;
  };
}

// 教育组织 (学校)
interface EducationalOrganizationSchema {
  type: 'EducationalOrganization';
  name: string;
  url?: string;
  description?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}

// FAQ 页面
interface FAQPageSchema {
  type: 'FAQPage';
  mainEntity: Array<{
    question: string;
    answer: string;
  }>;
}

// 面包屑导航
interface BreadcrumbListSchema {
  type: 'BreadcrumbList';
  items: Array<{
    name: string;
    url: string;
  }>;
}

type SchemaType =
  | OrganizationSchema
  | WebSiteSchema
  | ArticleSchema
  | EducationalOrganizationSchema
  | FAQPageSchema
  | BreadcrumbListSchema;

interface JsonLdProps {
  data: SchemaType;
}

function generateSchema(data: SchemaType): object {
  const baseContext = 'https://schema.org';

  switch (data.type) {
    case 'Organization':
      return {
        '@context': baseContext,
        '@type': 'Organization',
        name: data.name,
        url: data.url,
        logo: data.logo,
        description: data.description,
        sameAs: data.sameAs,
      };

    case 'WebSite':
      return {
        '@context': baseContext,
        '@type': 'WebSite',
        name: data.name,
        url: data.url,
        description: data.description,
        potentialAction: data.potentialAction
          ? {
              '@type': 'SearchAction',
              target: data.potentialAction.target,
              'query-input': data.potentialAction['query-input'],
            }
          : undefined,
      };

    case 'Article':
      return {
        '@context': baseContext,
        '@type': 'Article',
        headline: data.headline,
        description: data.description,
        image: data.image,
        datePublished: data.datePublished,
        dateModified: data.dateModified,
        author: data.author
          ? {
              '@type': 'Person',
              name: data.author.name,
              url: data.author.url,
            }
          : undefined,
      };

    case 'EducationalOrganization':
      return {
        '@context': baseContext,
        '@type': 'EducationalOrganization',
        name: data.name,
        url: data.url,
        description: data.description,
        address: data.address
          ? {
              '@type': 'PostalAddress',
              ...data.address,
            }
          : undefined,
        aggregateRating: data.aggregateRating
          ? {
              '@type': 'AggregateRating',
              ratingValue: data.aggregateRating.ratingValue,
              reviewCount: data.aggregateRating.reviewCount,
            }
          : undefined,
      };

    case 'FAQPage':
      return {
        '@context': baseContext,
        '@type': 'FAQPage',
        mainEntity: data.mainEntity.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      };

    case 'BreadcrumbList':
      return {
        '@context': baseContext,
        '@type': 'BreadcrumbList',
        itemListElement: data.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      };

    default:
      return {};
  }
}

export function JsonLd({ data }: JsonLdProps) {
  const schema = generateSchema(data);

  return (
    <Script
      id={`json-ld-${data.type}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      strategy="afterInteractive"
    />
  );
}

// 便捷组件
export function OrganizationJsonLd(props: Omit<OrganizationSchema, 'type'>) {
  return <JsonLd data={{ type: 'Organization', ...props }} />;
}

export function WebSiteJsonLd(props: Omit<WebSiteSchema, 'type'>) {
  return <JsonLd data={{ type: 'WebSite', ...props }} />;
}

export function ArticleJsonLd(props: Omit<ArticleSchema, 'type'>) {
  return <JsonLd data={{ type: 'Article', ...props }} />;
}

export function SchoolJsonLd(props: Omit<EducationalOrganizationSchema, 'type'>) {
  return <JsonLd data={{ type: 'EducationalOrganization', ...props }} />;
}

export function FAQJsonLd(props: Omit<FAQPageSchema, 'type'>) {
  return <JsonLd data={{ type: 'FAQPage', ...props }} />;
}

export function BreadcrumbJsonLd(props: Omit<BreadcrumbListSchema, 'type'>) {
  return <JsonLd data={{ type: 'BreadcrumbList', ...props }} />;
}


