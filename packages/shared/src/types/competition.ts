// Competition

export enum CompetitionCategory {
  MATH = 'MATH',
  BIOLOGY = 'BIOLOGY',
  PHYSICS = 'PHYSICS',
  CHEMISTRY = 'CHEMISTRY',
  COMPUTER_SCIENCE = 'COMPUTER_SCIENCE',
  ENGINEERING_RESEARCH = 'ENGINEERING_RESEARCH',
  ECONOMICS_BUSINESS = 'ECONOMICS_BUSINESS',
  DEBATE_SPEECH = 'DEBATE_SPEECH',
  WRITING_ESSAY = 'WRITING_ESSAY',
  GENERAL_ACADEMIC = 'GENERAL_ACADEMIC',
  ARTS_MUSIC = 'ARTS_MUSIC',
  OTHER = 'OTHER',
}

export interface Competition {
  id: string;
  name: string;
  abbreviation: string;
  nameZh?: string;
  category: CompetitionCategory;
  level: string;
  tier: number;
  description?: string;
  descriptionZh?: string;
  website?: string;
  isActive: boolean;
}
