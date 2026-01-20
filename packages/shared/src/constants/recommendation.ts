/**
 * Recommendation feature constants
 * Bilingual suggestion data for regions and majors
 */

export interface SuggestionItem {
  value: string;
  label: string;
  labelZh: string;
}

export interface SuggestionGroup {
  group: string;
  groupZh: string;
  items: SuggestionItem[];
}

// ============================================
// US Regions (all 50 states + DC + major college cities)
// ============================================

export const US_REGIONS: SuggestionGroup[] = [
  {
    group: 'Northeast',
    groupZh: '东北部',
    items: [
      // States
      { value: 'Massachusetts', label: 'Massachusetts', labelZh: '马萨诸塞州' },
      { value: 'New York', label: 'New York', labelZh: '纽约州' },
      { value: 'Pennsylvania', label: 'Pennsylvania', labelZh: '宾夕法尼亚州' },
      { value: 'Connecticut', label: 'Connecticut', labelZh: '康涅狄格州' },
      { value: 'New Jersey', label: 'New Jersey', labelZh: '新泽西州' },
      { value: 'Rhode Island', label: 'Rhode Island', labelZh: '罗德岛州' },
      { value: 'New Hampshire', label: 'New Hampshire', labelZh: '新罕布什尔州' },
      { value: 'Vermont', label: 'Vermont', labelZh: '佛蒙特州' },
      { value: 'Maine', label: 'Maine', labelZh: '缅因州' },
      // Cities
      { value: 'Boston, MA', label: 'Boston, MA', labelZh: '波士顿' },
      { value: 'Cambridge, MA', label: 'Cambridge, MA', labelZh: '剑桥' },
      { value: 'Amherst, MA', label: 'Amherst, MA', labelZh: '阿默斯特' },
      { value: 'Worcester, MA', label: 'Worcester, MA', labelZh: '伍斯特' },
      { value: 'New York City, NY', label: 'New York City, NY', labelZh: '纽约市' },
      { value: 'Ithaca, NY', label: 'Ithaca, NY', labelZh: '伊萨卡' },
      { value: 'Syracuse, NY', label: 'Syracuse, NY', labelZh: '锡拉丘兹' },
      { value: 'Rochester, NY', label: 'Rochester, NY', labelZh: '罗切斯特' },
      { value: 'Philadelphia, PA', label: 'Philadelphia, PA', labelZh: '费城' },
      { value: 'Pittsburgh, PA', label: 'Pittsburgh, PA', labelZh: '匹兹堡' },
      { value: 'New Haven, CT', label: 'New Haven, CT', labelZh: '纽黑文' },
      { value: 'Princeton, NJ', label: 'Princeton, NJ', labelZh: '普林斯顿' },
      { value: 'Providence, RI', label: 'Providence, RI', labelZh: '普罗维登斯' },
      { value: 'Hanover, NH', label: 'Hanover, NH', labelZh: '汉诺威' },
    ],
  },
  {
    group: 'Mid-Atlantic',
    groupZh: '中大西洋',
    items: [
      // States
      { value: 'Maryland', label: 'Maryland', labelZh: '马里兰州' },
      { value: 'Virginia', label: 'Virginia', labelZh: '弗吉尼亚州' },
      { value: 'Washington D.C.', label: 'Washington D.C.', labelZh: '华盛顿特区' },
      { value: 'Delaware', label: 'Delaware', labelZh: '特拉华州' },
      { value: 'West Virginia', label: 'West Virginia', labelZh: '西弗吉尼亚州' },
      // Cities
      { value: 'Baltimore, MD', label: 'Baltimore, MD', labelZh: '巴尔的摩' },
      { value: 'Charlottesville, VA', label: 'Charlottesville, VA', labelZh: '夏洛茨维尔' },
      { value: 'Richmond, VA', label: 'Richmond, VA', labelZh: '里士满' },
    ],
  },
  {
    group: 'Midwest',
    groupZh: '中西部',
    items: [
      // States
      { value: 'Illinois', label: 'Illinois', labelZh: '伊利诺伊州' },
      { value: 'Michigan', label: 'Michigan', labelZh: '密歇根州' },
      { value: 'Ohio', label: 'Ohio', labelZh: '俄亥俄州' },
      { value: 'Indiana', label: 'Indiana', labelZh: '印第安纳州' },
      { value: 'Wisconsin', label: 'Wisconsin', labelZh: '威斯康星州' },
      { value: 'Minnesota', label: 'Minnesota', labelZh: '明尼苏达州' },
      { value: 'Iowa', label: 'Iowa', labelZh: '爱荷华州' },
      { value: 'Missouri', label: 'Missouri', labelZh: '密苏里州' },
      { value: 'Kansas', label: 'Kansas', labelZh: '堪萨斯州' },
      { value: 'Nebraska', label: 'Nebraska', labelZh: '内布拉斯加州' },
      { value: 'North Dakota', label: 'North Dakota', labelZh: '北达科他州' },
      { value: 'South Dakota', label: 'South Dakota', labelZh: '南达科他州' },
      // Cities
      { value: 'Chicago, IL', label: 'Chicago, IL', labelZh: '芝加哥' },
      { value: 'Evanston, IL', label: 'Evanston, IL', labelZh: '埃文斯顿' },
      { value: 'Champaign, IL', label: 'Champaign, IL', labelZh: '香槟' },
      { value: 'Ann Arbor, MI', label: 'Ann Arbor, MI', labelZh: '安娜堡' },
      { value: 'Columbus, OH', label: 'Columbus, OH', labelZh: '哥伦布' },
      { value: 'Bloomington, IN', label: 'Bloomington, IN', labelZh: '布卢明顿' },
      { value: 'West Lafayette, IN', label: 'West Lafayette, IN', labelZh: '西拉法叶' },
      { value: 'Madison, WI', label: 'Madison, WI', labelZh: '麦迪逊' },
      { value: 'Minneapolis, MN', label: 'Minneapolis, MN', labelZh: '明尼阿波利斯' },
      { value: 'St. Louis, MO', label: 'St. Louis, MO', labelZh: '圣路易斯' },
      { value: 'Indianapolis, IN', label: 'Indianapolis, IN', labelZh: '印第安纳波利斯' },
    ],
  },
  {
    group: 'South',
    groupZh: '南部',
    items: [
      // States
      { value: 'Texas', label: 'Texas', labelZh: '德克萨斯州' },
      { value: 'Florida', label: 'Florida', labelZh: '佛罗里达州' },
      { value: 'Georgia', label: 'Georgia', labelZh: '佐治亚州' },
      { value: 'North Carolina', label: 'North Carolina', labelZh: '北卡罗来纳州' },
      { value: 'Tennessee', label: 'Tennessee', labelZh: '田纳西州' },
      { value: 'Louisiana', label: 'Louisiana', labelZh: '路易斯安那州' },
      { value: 'Alabama', label: 'Alabama', labelZh: '阿拉巴马州' },
      { value: 'South Carolina', label: 'South Carolina', labelZh: '南卡罗来纳州' },
      { value: 'Kentucky', label: 'Kentucky', labelZh: '肯塔基州' },
      { value: 'Arkansas', label: 'Arkansas', labelZh: '阿肯色州' },
      { value: 'Mississippi', label: 'Mississippi', labelZh: '密西西比州' },
      { value: 'Oklahoma', label: 'Oklahoma', labelZh: '俄克拉荷马州' },
      // Cities
      { value: 'Houston, TX', label: 'Houston, TX', labelZh: '休斯顿' },
      { value: 'Austin, TX', label: 'Austin, TX', labelZh: '奥斯汀' },
      { value: 'Dallas, TX', label: 'Dallas, TX', labelZh: '达拉斯' },
      { value: 'College Station, TX', label: 'College Station, TX', labelZh: '大学城' },
      { value: 'Atlanta, GA', label: 'Atlanta, GA', labelZh: '亚特兰大' },
      { value: 'Durham, NC', label: 'Durham, NC', labelZh: '达勒姆' },
      { value: 'Chapel Hill, NC', label: 'Chapel Hill, NC', labelZh: '教堂山' },
      { value: 'Raleigh, NC', label: 'Raleigh, NC', labelZh: '罗利' },
      { value: 'Nashville, TN', label: 'Nashville, TN', labelZh: '纳什维尔' },
      { value: 'Miami, FL', label: 'Miami, FL', labelZh: '迈阿密' },
      { value: 'Gainesville, FL', label: 'Gainesville, FL', labelZh: '盖恩斯维尔' },
      { value: 'Orlando, FL', label: 'Orlando, FL', labelZh: '奥兰多' },
      { value: 'Tampa, FL', label: 'Tampa, FL', labelZh: '坦帕' },
      { value: 'Baton Rouge, LA', label: 'Baton Rouge, LA', labelZh: '巴吞鲁日' },
    ],
  },
  {
    group: 'West Coast',
    groupZh: '西海岸',
    items: [
      // States
      { value: 'California', label: 'California', labelZh: '加利福尼亚州' },
      { value: 'Washington', label: 'Washington', labelZh: '华盛顿州' },
      { value: 'Oregon', label: 'Oregon', labelZh: '俄勒冈州' },
      // Cities
      { value: 'Los Angeles, CA', label: 'Los Angeles, CA', labelZh: '洛杉矶' },
      { value: 'San Francisco, CA', label: 'San Francisco, CA', labelZh: '旧金山' },
      { value: 'San Jose, CA', label: 'San Jose, CA', labelZh: '圣何塞' },
      { value: 'San Diego, CA', label: 'San Diego, CA', labelZh: '圣迭戈' },
      { value: 'Palo Alto, CA', label: 'Palo Alto, CA', labelZh: '帕洛阿尔托' },
      { value: 'Berkeley, CA', label: 'Berkeley, CA', labelZh: '伯克利' },
      { value: 'Irvine, CA', label: 'Irvine, CA', labelZh: '尔湾' },
      { value: 'Davis, CA', label: 'Davis, CA', labelZh: '戴维斯' },
      { value: 'Santa Barbara, CA', label: 'Santa Barbara, CA', labelZh: '圣巴巴拉' },
      { value: 'Santa Cruz, CA', label: 'Santa Cruz, CA', labelZh: '圣克鲁兹' },
      { value: 'Pasadena, CA', label: 'Pasadena, CA', labelZh: '帕萨迪纳' },
      { value: 'Sacramento, CA', label: 'Sacramento, CA', labelZh: '萨克拉门托' },
      { value: 'Seattle, WA', label: 'Seattle, WA', labelZh: '西雅图' },
      { value: 'Portland, OR', label: 'Portland, OR', labelZh: '波特兰' },
    ],
  },
  {
    group: 'Mountain & Southwest',
    groupZh: '山地与西南部',
    items: [
      // States
      { value: 'Colorado', label: 'Colorado', labelZh: '科罗拉多州' },
      { value: 'Arizona', label: 'Arizona', labelZh: '亚利桑那州' },
      { value: 'Utah', label: 'Utah', labelZh: '犹他州' },
      { value: 'Nevada', label: 'Nevada', labelZh: '内华达州' },
      { value: 'New Mexico', label: 'New Mexico', labelZh: '新墨西哥州' },
      { value: 'Hawaii', label: 'Hawaii', labelZh: '夏威夷州' },
      { value: 'Idaho', label: 'Idaho', labelZh: '爱达荷州' },
      { value: 'Montana', label: 'Montana', labelZh: '蒙大拿州' },
      { value: 'Wyoming', label: 'Wyoming', labelZh: '怀俄明州' },
      { value: 'Alaska', label: 'Alaska', labelZh: '阿拉斯加州' },
      // Cities
      { value: 'Denver, CO', label: 'Denver, CO', labelZh: '丹佛' },
      { value: 'Boulder, CO', label: 'Boulder, CO', labelZh: '博尔德' },
      { value: 'Phoenix, AZ', label: 'Phoenix, AZ', labelZh: '凤凰城' },
      { value: 'Tucson, AZ', label: 'Tucson, AZ', labelZh: '图森' },
      { value: 'Salt Lake City, UT', label: 'Salt Lake City, UT', labelZh: '盐湖城' },
      { value: 'Albuquerque, NM', label: 'Albuquerque, NM', labelZh: '阿尔伯克基' },
      { value: 'Honolulu, HI', label: 'Honolulu, HI', labelZh: '檀香山' },
    ],
  },
];

// ============================================
// US Majors (grouped by discipline)
// ============================================

export const US_MAJORS: SuggestionGroup[] = [
  {
    group: 'STEM',
    groupZh: '理工科',
    items: [
      { value: 'Computer Science', label: 'Computer Science', labelZh: '计算机科学' },
      { value: 'Computer Engineering', label: 'Computer Engineering', labelZh: '计算机工程' },
      { value: 'Software Engineering', label: 'Software Engineering', labelZh: '软件工程' },
      { value: 'Artificial Intelligence', label: 'Artificial Intelligence', labelZh: '人工智能' },
      { value: 'Data Science', label: 'Data Science', labelZh: '数据科学' },
      { value: 'Information Systems', label: 'Information Systems', labelZh: '信息系统' },
      { value: 'Electrical Engineering', label: 'Electrical Engineering', labelZh: '电气工程' },
      { value: 'Mechanical Engineering', label: 'Mechanical Engineering', labelZh: '机械工程' },
      { value: 'Civil Engineering', label: 'Civil Engineering', labelZh: '土木工程' },
      { value: 'Chemical Engineering', label: 'Chemical Engineering', labelZh: '化学工程' },
      { value: 'Biomedical Engineering', label: 'Biomedical Engineering', labelZh: '生物医学工程' },
      { value: 'Aerospace Engineering', label: 'Aerospace Engineering', labelZh: '航空航天工程' },
      { value: 'Industrial Engineering', label: 'Industrial Engineering', labelZh: '工业工程' },
      { value: 'Materials Science', label: 'Materials Science', labelZh: '材料科学' },
      {
        value: 'Environmental Engineering',
        label: 'Environmental Engineering',
        labelZh: '环境工程',
      },
      { value: 'Mathematics', label: 'Mathematics', labelZh: '数学' },
      { value: 'Applied Mathematics', label: 'Applied Mathematics', labelZh: '应用数学' },
      { value: 'Statistics', label: 'Statistics', labelZh: '统计学' },
      { value: 'Physics', label: 'Physics', labelZh: '物理学' },
      { value: 'Chemistry', label: 'Chemistry', labelZh: '化学' },
      { value: 'Biology', label: 'Biology', labelZh: '生物学' },
      { value: 'Neuroscience', label: 'Neuroscience', labelZh: '神经科学' },
      { value: 'Environmental Science', label: 'Environmental Science', labelZh: '环境科学' },
      { value: 'Astronomy', label: 'Astronomy', labelZh: '天文学' },
      { value: 'Geology', label: 'Geology', labelZh: '地质学' },
    ],
  },
  {
    group: 'Business & Economics',
    groupZh: '商科与经济',
    items: [
      { value: 'Business Administration', label: 'Business Administration', labelZh: '工商管理' },
      { value: 'Finance', label: 'Finance', labelZh: '金融' },
      { value: 'Accounting', label: 'Accounting', labelZh: '会计' },
      { value: 'Marketing', label: 'Marketing', labelZh: '市场营销' },
      { value: 'Economics', label: 'Economics', labelZh: '经济学' },
      { value: 'International Business', label: 'International Business', labelZh: '国际商务' },
      { value: 'Management', label: 'Management', labelZh: '管理学' },
      { value: 'Supply Chain Management', label: 'Supply Chain Management', labelZh: '供应链管理' },
      { value: 'Entrepreneurship', label: 'Entrepreneurship', labelZh: '创业学' },
      { value: 'Real Estate', label: 'Real Estate', labelZh: '房地产' },
      { value: 'Hospitality Management', label: 'Hospitality Management', labelZh: '酒店管理' },
      {
        value: 'Human Resource Management',
        label: 'Human Resource Management',
        labelZh: '人力资源管理',
      },
      { value: 'Actuarial Science', label: 'Actuarial Science', labelZh: '精算学' },
    ],
  },
  {
    group: 'Social Sciences',
    groupZh: '社会科学',
    items: [
      { value: 'Psychology', label: 'Psychology', labelZh: '心理学' },
      { value: 'Sociology', label: 'Sociology', labelZh: '社会学' },
      { value: 'Political Science', label: 'Political Science', labelZh: '政治学' },
      { value: 'International Relations', label: 'International Relations', labelZh: '国际关系' },
      { value: 'Anthropology', label: 'Anthropology', labelZh: '人类学' },
      { value: 'Public Policy', label: 'Public Policy', labelZh: '公共政策' },
      { value: 'Criminal Justice', label: 'Criminal Justice', labelZh: '刑事司法' },
      { value: 'Linguistics', label: 'Linguistics', labelZh: '语言学' },
      { value: 'Urban Planning', label: 'Urban Planning', labelZh: '城市规划' },
      { value: 'Geography', label: 'Geography', labelZh: '地理学' },
      { value: 'Gender Studies', label: 'Gender Studies', labelZh: '性别研究' },
      { value: 'Public Administration', label: 'Public Administration', labelZh: '公共管理' },
    ],
  },
  {
    group: 'Humanities & Arts',
    groupZh: '人文与艺术',
    items: [
      { value: 'English Literature', label: 'English Literature', labelZh: '英语文学' },
      { value: 'History', label: 'History', labelZh: '历史学' },
      { value: 'Philosophy', label: 'Philosophy', labelZh: '哲学' },
      { value: 'Communications', label: 'Communications', labelZh: '传播学' },
      { value: 'Journalism', label: 'Journalism', labelZh: '新闻学' },
      { value: 'Fine Arts', label: 'Fine Arts', labelZh: '美术' },
      { value: 'Music', label: 'Music', labelZh: '音乐' },
      { value: 'Film Studies', label: 'Film Studies', labelZh: '电影学' },
      { value: 'Architecture', label: 'Architecture', labelZh: '建筑学' },
      { value: 'Art History', label: 'Art History', labelZh: '艺术史' },
      { value: 'Creative Writing', label: 'Creative Writing', labelZh: '创意写作' },
      { value: 'Theater', label: 'Theater', labelZh: '戏剧' },
      { value: 'Graphic Design', label: 'Graphic Design', labelZh: '平面设计' },
      { value: 'Religious Studies', label: 'Religious Studies', labelZh: '宗教学' },
      { value: 'Dance', label: 'Dance', labelZh: '舞蹈' },
      { value: 'Comparative Literature', label: 'Comparative Literature', labelZh: '比较文学' },
    ],
  },
  {
    group: 'Health & Medicine',
    groupZh: '健康与医学',
    items: [
      { value: 'Pre-Medicine', label: 'Pre-Medicine', labelZh: '医学预科' },
      { value: 'Nursing', label: 'Nursing', labelZh: '护理学' },
      { value: 'Public Health', label: 'Public Health', labelZh: '公共卫生' },
      { value: 'Pharmacy', label: 'Pharmacy', labelZh: '药学' },
      { value: 'Kinesiology', label: 'Kinesiology', labelZh: '运动学' },
      { value: 'Nutrition', label: 'Nutrition', labelZh: '营养学' },
      { value: 'Pre-Dental', label: 'Pre-Dental', labelZh: '牙医预科' },
      { value: 'Physical Therapy', label: 'Physical Therapy', labelZh: '物理治疗' },
      { value: 'Pre-Veterinary', label: 'Pre-Veterinary', labelZh: '兽医预科' },
      { value: 'Speech Pathology', label: 'Speech Pathology', labelZh: '言语病理学' },
      { value: 'Biomedical Sciences', label: 'Biomedical Sciences', labelZh: '生物医学' },
    ],
  },
  {
    group: 'Education & Law',
    groupZh: '教育与法律',
    items: [
      { value: 'Education', label: 'Education', labelZh: '教育学' },
      { value: 'Pre-Law', label: 'Pre-Law', labelZh: '法律预科' },
      { value: 'Social Work', label: 'Social Work', labelZh: '社会工作' },
      { value: 'Library Science', label: 'Library Science', labelZh: '图书馆学' },
      { value: 'Special Education', label: 'Special Education', labelZh: '特殊教育' },
      { value: 'Counseling', label: 'Counseling', labelZh: '心理咨询' },
      { value: 'TESOL', label: 'TESOL', labelZh: '对外英语教学' },
      {
        value: 'Early Childhood Education',
        label: 'Early Childhood Education',
        labelZh: '学前教育',
      },
    ],
  },
];
