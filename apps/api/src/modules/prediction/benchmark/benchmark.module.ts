import { BenchmarkController } from './benchmark.controller';
import { BenchmarkService } from './benchmark.service';
import { AdapterRegistryService } from './adapter-registry.service';
import { BrowserRunnerService } from './browser-runner.service';
import { PredictionBenchmarkEvaluatorService } from './prediction-benchmark-evaluator.service';
import { SchoolMatcherService } from './school-matcher.service';
import { AblationRunnerService } from './ablation-runner.service';
import { HistoricalBacktestService } from './historical-backtest.service';
import { CollegeVineAdapter } from './adapters/collegevine.adapter';
import { MockCompetitorAdapter } from './adapters/mock-competitor.adapter';
import { SampleCompetitorAdapter } from './adapters/sample-competitor.adapter';
import { CampusReelStaticAdapter } from './adapters/campusreel-static.adapter';
import { StaticTeacherRegistryService } from './static-teacher-registry.service';
import { ProfileBankService } from './profile-bank.service';
import { DistillationService } from './distillation.service';

export const BENCHMARK_CONTROLLERS = [BenchmarkController];

export const BENCHMARK_PROVIDERS = [
  MockCompetitorAdapter,
  SampleCompetitorAdapter,
  CollegeVineAdapter,
  CampusReelStaticAdapter,
  AdapterRegistryService,
  StaticTeacherRegistryService,
  BrowserRunnerService,
  PredictionBenchmarkEvaluatorService,
  SchoolMatcherService,
  BenchmarkService,
  ProfileBankService,
  DistillationService,
  AblationRunnerService,
  HistoricalBacktestService,
];
